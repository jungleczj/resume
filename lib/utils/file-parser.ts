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

/**
 * Extract the first embedded image from a DOCX file.
 * Returns null if no image found or file is not DOCX.
 */
export async function extractFirstImageFromDOCX(
  buffer: Buffer
): Promise<{ data: Buffer; contentType: string } | null> {
  let firstImage: { data: Buffer; contentType: string } | null = null

  try {
    await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(function (image) {
          return image.read().then(function (imgBuffer) {
            if (!firstImage) {
              firstImage = {
                data: Buffer.isBuffer(imgBuffer) ? imgBuffer : Buffer.from(imgBuffer as ArrayBuffer),
                contentType: image.contentType ?? 'image/jpeg'
              }
            }
            return { src: '' }
          })
        })
      }
    )
  } catch {
    // ignore — image extraction is best-effort
  }

  return firstImage
}
