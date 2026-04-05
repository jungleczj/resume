import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { WorkExperience } from '../types/domain'

interface PDFData {
  name: string
  contact: { email: string; phone: string; linkedin?: string }
  experiences: WorkExperience[]
  photoUrl?: string
  showPhoto: boolean
  lang: 'zh' | 'en'
}

const PAGE_WIDTH = 595  // A4 in points
const PAGE_HEIGHT = 842
const MARGIN = 50
const LINE_HEIGHT = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

export async function generatePDF(data: PDFData): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  let regularFont: Awaited<ReturnType<typeof doc.embedFont>>
  let boldFont: Awaited<ReturnType<typeof doc.embedFont>>

  if (data.lang === 'zh') {
    // Embed SimHei for CJK support (bundled in public/fonts/)
    try {
      const fontPath = join(process.cwd(), 'public', 'fonts', 'SimHei.ttf')
      const fontBytes = readFileSync(fontPath)
      const embedded = await doc.embedFont(fontBytes)
      regularFont = embedded
      boldFont = embedded
    } catch {
      // Fallback to Helvetica (Chinese chars will be missing glyphs but won't crash)
      regularFont = await doc.embedFont(StandardFonts.Helvetica)
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
    }
  } else {
    regularFont = await doc.embedFont(StandardFonts.Helvetica)
    boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  }

  let y = PAGE_HEIGHT - MARGIN

  // ── Name ──────────────────────────────────────────────────────────────────
  page.drawText(data.name || (data.lang === 'zh' ? '候选人' : 'Candidate'), {
    x: MARGIN,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0.07, 0.07, 0.14)
  })
  y -= 24

  // ── Contact ───────────────────────────────────────────────────────────────
  const contactParts = [data.contact.email, data.contact.phone, data.contact.linkedin].filter(Boolean)
  const contactLine = contactParts.join('  |  ')
  if (contactLine) {
    page.drawText(contactLine, {
      x: MARGIN,
      y,
      size: 9,
      font: regularFont,
      color: rgb(0.27, 0.27, 0.33)
    })
    y -= 18
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.85)
  })
  y -= 20

  // ── Work Experience Section ────────────────────────────────────────────────
  if (data.experiences.length > 0) {
    const sectionLabel = data.lang === 'zh' ? '工作经历' : 'WORK EXPERIENCE'
    page.drawText(sectionLabel, {
      x: MARGIN,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.07, 0.07, 0.14)
    })
    y -= LINE_HEIGHT + 4

    for (const exp of data.experiences) {
      const confirmed = (exp.achievements ?? []).filter(a => a.status === 'confirmed')
      if (confirmed.length === 0) continue

      // ── Company + Title ──
      page.drawText(`${exp.company}`, {
        x: MARGIN,
        y,
        size: 11,
        font: boldFont,
        color: rgb(0.07, 0.07, 0.14)
      })

      if (exp.job_title) {
        const companyWidth = boldFont.widthOfTextAtSize(exp.company, 11)
        page.drawText(`  ${exp.job_title}`, {
          x: MARGIN + companyWidth,
          y,
          size: 10,
          font: regularFont,
          color: rgb(0.27, 0.27, 0.33)
        })
      }

      // ── Date range (right-aligned) ──
      const endLabel = exp.is_current
        ? (data.lang === 'zh' ? '至今' : 'Present')
        : exp.end_year ? String(exp.end_year) : ''
      const dateStr = exp.start_year
        ? `${exp.start_year}${endLabel ? ` – ${endLabel}` : ''}`
        : endLabel
      const dateWidth = regularFont.widthOfTextAtSize(dateStr, 9)
      page.drawText(dateStr, {
        x: PAGE_WIDTH - MARGIN - dateWidth,
        y,
        size: 9,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.46)
      })
      y -= LINE_HEIGHT + 2

      // ── Achievements ──
      for (const ach of confirmed) {
        const bullet = '•  '
        const bulletWidth = regularFont.widthOfTextAtSize(bullet, 9)
        const maxTextWidth = CONTENT_WIDTH - bulletWidth - 4
        const words = ach.text.split(/\s+/)
        const lines: string[] = []
        let current = ''

        for (const word of words) {
          const test = current ? `${current} ${word}` : word
          if (regularFont.widthOfTextAtSize(test, 9) > maxTextWidth) {
            if (current) lines.push(current)
            current = word
          } else {
            current = test
          }
        }
        if (current) lines.push(current)

        for (let i = 0; i < lines.length; i++) {
          if (y < MARGIN + 20) break // simple page-break guard
          page.drawText(i === 0 ? bullet + lines[i] : '     ' + lines[i], {
            x: MARGIN + 4,
            y,
            size: 9,
            font: regularFont,
            color: rgb(0.2, 0.2, 0.26)
          })
          y -= LINE_HEIGHT
        }
      }
      y -= 8
    }
  }

  const bytes = await doc.save()
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}
