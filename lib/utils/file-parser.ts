import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import { inflateSync } from 'zlib'

export async function extractTextFromFile(
  blob: Blob,
  filePath: string
): Promise<string> {
  const ext = filePath.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    return await extractPDF(blob)
  } else if (ext === 'docx' || ext === 'doc') {
    return await extractDOCX(blob)
  } else if (ext === 'txt') {
    return await blob.text()
  }

  throw new Error(`Unsupported file type: ${ext}`)
}

async function extractPDF(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const data = await pdf(Buffer.from(buffer))
  return data.text.slice(0, 50000)
}

async function extractDOCX(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
  return result.value.slice(0, 50000)
}

// ─── Image extraction utilities ──────────────────────────────────────────────

/**
 * Scan a binary buffer for all JPEG images (FF D8 FF … FF D9).
 * Returns them sorted largest-first. Works for both raw PDF streams
 * and DOCX/ZIP entries (which store JPEG uncompressed by default).
 */
function scanJPEGsInBuffer(
  buffer: Buffer,
  minSizeBytes = 8 * 1024   // skip thumbnails / icons (<8 KB)
): Buffer[] {
  const results: Buffer[] = []

  for (let i = 0; i <= buffer.length - 4; i++) {
    // JPEG SOI marker: FF D8 FF
    if (buffer[i] !== 0xFF || buffer[i + 1] !== 0xD8 || buffer[i + 2] !== 0xFF) continue

    // Scan forward for EOI marker: FF D9
    // Limit search to 10 MB to avoid runaway loops
    const maxEnd = Math.min(i + 10 * 1024 * 1024, buffer.length - 1)
    for (let j = i + 4; j < maxEnd; j++) {
      if (buffer[j] === 0xFF && buffer[j + 1] === 0xD9) {
        const chunk = buffer.slice(i, j + 2)
        if (chunk.length >= minSizeBytes) {
          results.push(chunk)
        }
        i = j   // advance outer loop past this JPEG
        break
      }
    }
  }

  // Return largest first (profile photo > logo > thumbnail)
  return results.sort((a, b) => b.length - a.length)
}

/**
 * Scan a binary buffer for PNG images (89 50 4E 47 … 49 45 4E 44 AE 42 60 82).
 * Returns them sorted largest-first.
 */
function scanPNGsInBuffer(
  buffer: Buffer,
  minSizeBytes = 8 * 1024
): Buffer[] {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
  // IEND chunk data + CRC: 49 45 4E 44 AE 42 60 82
  const PNG_END = Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82])

  const results: Buffer[] = []

  for (let i = 0; i <= buffer.length - PNG_SIG.length; i++) {
    // Quick check first byte before full compare
    if (buffer[i] !== 0x89) continue
    if (!buffer.slice(i, i + PNG_SIG.length).equals(PNG_SIG)) continue

    // Found PNG start — find IEND
    const maxEnd = Math.min(i + 10 * 1024 * 1024, buffer.length - PNG_END.length)
    for (let j = i + PNG_SIG.length; j <= maxEnd; j++) {
      if (buffer[j] === 0x49 && buffer.slice(j, j + PNG_END.length).equals(PNG_END)) {
        const chunk = buffer.slice(i, j + PNG_END.length)
        if (chunk.length >= minSizeBytes) {
          results.push(chunk)
        }
        i = j
        break
      }
    }
  }

  return results.sort((a, b) => b.length - a.length)
}

/**
 * Pick the single largest image from JPEG + PNG candidates combined.
 */
function pickLargestImage(
  buffer: Buffer
): { data: Buffer; contentType: string } | null {
  const jpegs = scanJPEGsInBuffer(buffer)
  const pngs  = scanPNGsInBuffer(buffer)

  const all = [
    ...jpegs.map(d => ({ data: d, contentType: 'image/jpeg' })),
    ...pngs.map(d  => ({ data: d, contentType: 'image/png'  })),
  ]

  if (!all.length) return null

  all.sort((a, b) => b.data.length - a.data.length)
  return all[0]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fast binary scan: find the largest embedded image (JPEG or PNG) in any buffer.
 * Works for raw PDF streams and DOCX/ZIP archives (JPEG stored uncompressed inside zip).
 * Returns null if no image found. No external dependencies — pure Buffer scan.
 */
export function extractImageFromBuffer(
  buffer: Buffer
): { data: Buffer; contentType: string } | null {
  return pickLargestImage(buffer)
}

/**
 * Extract COMPLETE styled HTML from DOCX preserving ALL original formatting.
 */
export async function extractDOCXToFullHTML(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer },
    { styleMap: [] }
  )
  return result.value
}

/** Alias for backward compatibility */
export async function convertDOCXToStyledHTML(
  buffer: Buffer
): Promise<{ html: string }> {
  const html = await extractDOCXToFullHTML(buffer)
  return { html }
}

/**
 * Extract the profile photo from a DOCX file.
 *
 * Strategy:
 *  1. Use mammoth's convertImage callback to capture images it knows about
 *     (inline images, most anchor images).
 *  2. Fall back to binary JPEG/PNG scanning of the raw DOCX buffer — since
 *     DOCX is a ZIP file and ZIP typically stores JPEG uncompressed, the raw
 *     image bytes appear verbatim in the buffer.
 *  3. Return the largest image found (profile photos are always larger than
 *     logos, icons, or thumbnails).
 */
export async function extractFirstImageFromDOCX(
  buffer: Buffer
): Promise<{ data: Buffer; contentType: string } | null> {
  // Approach 1: mammoth image callback
  const mammothImages: Array<{ data: Buffer; contentType: string }> = []

  try {
    await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(function (image) {
          return image.read().then(function (imgBuffer) {
            const data = Buffer.isBuffer(imgBuffer)
              ? imgBuffer
              : Buffer.from(imgBuffer as ArrayBuffer)
            mammothImages.push({ data, contentType: image.contentType ?? 'image/jpeg' })
            return { src: '' }
          })
        })
      }
    )
  } catch (err) {
    console.warn('[extractFirstImageFromDOCX] mammoth pass failed:', err)
  }

  // Filter out tiny images (icons / bullets) and pick largest
  const filtered = mammothImages
    .filter(img => img.data.length >= 8 * 1024)
    .sort((a, b) => b.data.length - a.data.length)

  if (filtered.length > 0) {
    console.log(
      '[extractFirstImageFromDOCX] mammoth found',
      filtered.length,
      'image(s), largest:',
      filtered[0].data.length,
      'bytes'
    )
    return filtered[0]
  }

  // Approach 2: raw binary scan (catches floating/anchor images mammoth may miss)
  console.log('[extractFirstImageFromDOCX] mammoth found nothing, trying binary scan…')
  const fromBinary = pickLargestImage(buffer)
  if (fromBinary) {
    console.log(
      '[extractFirstImageFromDOCX] binary scan found image:',
      fromBinary.data.length,
      'bytes,',
      fromBinary.contentType
    )
  } else {
    console.log('[extractFirstImageFromDOCX] binary scan: no image found')
  }
  return fromBinary
}

/**
 * Decompress all FlateDecode streams in a PDF binary and scan each for JPEG/PNG.
 *
 * Some PDF exporters (Canva, Adobe InDesign, certain Word versions) store
 * images inside zlib-compressed (FlateDecode) object streams rather than as
 * raw DCTDecode bytes. Direct binary scan misses those entirely.
 *
 * Strategy:
 *  1. Locate every "/FlateDecode" token in the PDF.
 *  2. Find the "stream … endstream" block that follows.
 *  3. Try inflateSync on the raw stream bytes.
 *  4. Scan the decompressed buffer for JPEG/PNG markers.
 *  5. Return the largest image found across all streams.
 */
function extractImagesFromPDFFlateDecode(
  buffer: Buffer
): { data: Buffer; contentType: string } | null {
  const FLATE  = Buffer.from('/FlateDecode')
  const STREAM = Buffer.from('stream')
  const ENDSTREAM = Buffer.from('endstream')

  const candidates: { data: Buffer; contentType: string }[] = []
  let pos = 0

  while (pos < buffer.length) {
    const flateIdx = buffer.indexOf(FLATE, pos)
    if (flateIdx === -1) break

    // Find "stream" keyword within 512 bytes after /FlateDecode
    const searchEnd = Math.min(flateIdx + 512, buffer.length - STREAM.length - 2)
    let streamKeywordEnd = -1
    for (let k = flateIdx; k < searchEnd; k++) {
      if (buffer.slice(k, k + STREAM.length).equals(STREAM)) {
        // Data starts after the newline(s) following "stream"
        const afterKeyword = k + STREAM.length
        if (buffer[afterKeyword] === 0x0D && buffer[afterKeyword + 1] === 0x0A) {
          streamKeywordEnd = afterKeyword + 2  // \r\n
        } else if (buffer[afterKeyword] === 0x0A) {
          streamKeywordEnd = afterKeyword + 1  // \n
        } else {
          streamKeywordEnd = afterKeyword
        }
        break
      }
    }

    if (streamKeywordEnd === -1) { pos = flateIdx + 1; continue }

    // Find "endstream" — limit to 20 MB to avoid huge streams
    const endIdx = buffer.indexOf(ENDSTREAM, streamKeywordEnd)
    if (endIdx === -1 || endIdx - streamKeywordEnd > 20 * 1024 * 1024) {
      pos = flateIdx + 1; continue
    }

    // Strip optional trailing \n or \r\n before endstream
    let dataEnd = endIdx
    if (dataEnd > streamKeywordEnd && buffer[dataEnd - 1] === 0x0A) dataEnd--
    if (dataEnd > streamKeywordEnd && buffer[dataEnd - 1] === 0x0D) dataEnd--

    const compressed = buffer.slice(streamKeywordEnd, dataEnd)
    if (compressed.length < 16) { pos = flateIdx + FLATE.length; continue }

    try {
      const decompressed = inflateSync(compressed)
      // Scan decompressed content with lower size threshold (photos inside streams
      // can be cropped/compressed; 5 KB is safe against icon noise but catches small photos)
      const jpegs = scanJPEGsInBuffer(decompressed, 5 * 1024)
      const pngs  = scanPNGsInBuffer(decompressed,  5 * 1024)
      for (const d of jpegs) candidates.push({ data: d, contentType: 'image/jpeg' })
      for (const d of pngs)  candidates.push({ data: d, contentType: 'image/png'  })
    } catch {
      // Not valid zlib / different filter — skip silently
    }

    pos = flateIdx + FLATE.length
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.data.length - a.data.length)
  return candidates[0]
}

/**
 * Extract the profile photo from a PDF file.
 *
 * Two-pass strategy:
 *  Pass 1 — Direct binary scan: works for PDFs that store JPEG as raw
 *    DCTDecode streams (Microsoft Word, Google Docs, LaTeX, most resume builders).
 *    The JPEG bytes appear verbatim in the file so JPEG SOI/EOI markers are found.
 *  Pass 2 — FlateDecode decompress + scan: handles PDFs where images are inside
 *    zlib-compressed object streams (Canva exports, some Adobe InDesign PDFs).
 *    We decompress each FlateDecode stream and scan the result for JPEG/PNG.
 */
export async function extractFirstImageFromPDF(
  buffer: Buffer
): Promise<{ data: Buffer; contentType: string } | null> {
  // Pass 1: direct binary scan
  const direct = pickLargestImage(buffer)
  if (direct) {
    console.log('[extractFirstImageFromPDF] direct scan found image:', direct.data.length, 'bytes,', direct.contentType)
    return direct
  }

  // Pass 2: FlateDecode decompress + scan
  console.log('[extractFirstImageFromPDF] direct scan found nothing, trying FlateDecode streams...')
  const flate = extractImagesFromPDFFlateDecode(buffer)
  if (flate) {
    console.log('[extractFirstImageFromPDF] FlateDecode found image:', flate.data.length, 'bytes,', flate.contentType)
    return flate
  }

  console.log('[extractFirstImageFromPDF] no image found in PDF')
  return null
}
