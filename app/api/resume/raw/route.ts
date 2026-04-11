import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const filePath = searchParams.get('file_path')
  const anonymousId = searchParams.get('anonymous_id')
  const userId = searchParams.get('user_id')

  if (!filePath) {
    return NextResponse.json({ error: 'Missing file_path' }, { status: 400 })
  }

  // Ownership check: file path must start with uploads/{anonymousId}/
  // OR verify via DB that userId owns the upload
  if (anonymousId) {
    if (!filePath.startsWith(`uploads/${anonymousId}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (userId) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('resume_uploads')
      .select('id')
      .eq('user_id', userId)
      .eq('file_path', filePath)
      .limit(1)
      .single()
    if (!data) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Missing anonymous_id or user_id' }, { status: 400 })
  }

  try {
    const supabase = createServiceClient()

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(filePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer())
    const fileExt = filePath.split('.').pop()?.toLowerCase() ?? ''
    const contentType = MIME_MAP[fileExt] ?? 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, max-age=3600'
      }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load file'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
