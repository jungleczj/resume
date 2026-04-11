import pdf from 'pdf-parse'
import mammoth from 'mammoth'

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
 * Extract the profile photo from a PDF file.
 *
 * PDF stores JPEG images as raw DCTDecode streams — the JPEG bytes appear
 * verbatim in the file binary, making marker-based scanning reliable.
 * PNG images also appear as-is in most PDFs (stored without additional compression).
 */
export async function extractFirstImageFromPDF(
  buffer: Buffer
): Promise<{ data: Buffer; contentType: string } | null> {
  const result = pickLargestImage(buffer)
  if (result) {
    console.log(
      '[extractFirstImageFromPDF] found image:',
      result.data.length,
      'bytes,',
      result.contentType
    )
  } else {
    console.log('[extractFirstImageFromPDF] no image found in PDF')
  }
  return result
}
