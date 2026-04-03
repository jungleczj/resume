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
  const buffer = await blob.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  return result.value.slice(0, 50000)
}
