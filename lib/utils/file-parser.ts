import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import { PDFDocument } from 'pdf-lib'

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

export async function extractPhotoFromPDF(
  blob: Blob,
  anonymousId: string,
  supabase: any
): Promise<string | null> {
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const pdfDoc = await PDFDocument.load(arrayBuffer)
    const pageCount = pdfDoc.getPageCount()

    for (let i = 0; i < pageCount && i < 3; i++) {
      const page = pdfDoc.getPage(i)
      const images = page.node.Annots?.array?.filter(
        (annot: any) => annot.get?.('/Subtype')?.toString?.() === '/Image'
      )

      if (images && images.length > 0) {
        for (const img of images) {
          const imgObj = img.getXObject?.()
          if (imgObj && imgObj.get?.('/Width') && imgObj.get?.('/Height')) {
            const width = imgObj.get('/Width')
            const height = imgObj.get('/Height')

            if (width >= 100 && height >= 100) {
              const imgData = imgObj.getBytes()
              const subtype = imgObj.get('/Filter')?.toString()

              let mimeType = 'image/jpeg'
              if (subtype?.includes('DCT')) {
                mimeType = 'image/jpeg'
              } else if (subtype?.includes('Flate')) {
                mimeType = 'image/png'
              }

              const photoPath = `photos/${anonymousId}/${Date.now()}.${mimeType.split('/')[1]}`
              const { error } = await supabase.storage
                .from('photos')
                .upload(photoPath, imgData, { contentType: mimeType })

              if (!error) {
                return photoPath
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Photo extraction error:', error)
  }
  return null
}
