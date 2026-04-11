import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { WorkExperience, ResumeEducation, ResumeSkillGroup, Certification, SpokenLanguage, Award, Publication } from '../types/domain'

interface PDFData {
  name: string
  contact: {
    email?: string | null
    phone?: string | null
    location?: string | null
    linkedin?: string | null
    website?: string | null
  }
  summary?: string | null
  experiences: WorkExperience[]
  education: ResumeEducation[]
  skills: ResumeSkillGroup[]
  certifications?: Certification[]
  spokenLanguages?: SpokenLanguage[]
  awards?: Award[]
  publications?: Publication[]
  photoUrl?: string | null
  showPhoto: boolean
  lang: 'zh' | 'en'
}

const PAGE_WIDTH = 595   // A4 in points
const PAGE_HEIGHT = 842
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_H = 13        // base line height

// ── Text wrapping helper ────────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (current) lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

// ── Draw wrapped text, returning new y position ────────────────────────────
function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lineHeight = LINE_H,
  indent = 0
): number {
  const lines = wrapText(text, font, size, maxWidth)
  for (let i = 0; i < lines.length; i++) {
    if (y < MARGIN + 10) break
    page.drawText(lines[i], {
      x: i === 0 ? x : x + indent,
      y,
      size,
      font,
      color
    })
    y -= lineHeight
  }
  return y
}

// ── Section heading ─────────────────────────────────────────────────────────
function drawSectionHeading(
  page: PDFPage,
  label: string,
  y: number,
  font: PDFFont
): number {
  page.drawText(label, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: rgb(0.31, 0.27, 0.80)  // indigo accent
  })
  y -= 8
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.4,
    color: rgb(0.31, 0.27, 0.80)
  })
  y -= 10
  return y
}

export async function generatePDF(data: PDFData): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  let regularFont: PDFFont
  let boldFont: PDFFont

  if (data.lang === 'zh') {
    try {
      const fontPath = join(process.cwd(), 'public', 'fonts', 'SimHei.ttf')
      const fontBytes = readFileSync(fontPath)
      const embedded = await doc.embedFont(fontBytes)
      regularFont = embedded
      boldFont = embedded
    } catch {
      regularFont = await doc.embedFont(StandardFonts.Helvetica)
      boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
    }
  } else {
    regularFont = await doc.embedFont(StandardFonts.Helvetica)
    boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
  }

  const darkGray = rgb(0.07, 0.07, 0.14)
  const midGray  = rgb(0.27, 0.27, 0.33)
  const lightGray = rgb(0.40, 0.40, 0.46)

  let y = PAGE_HEIGHT - MARGIN

  // ── PHOTO (top-right, drawn before text so text can overlap if needed) ─────
  const PHOTO_W = 72
  const PHOTO_H = 88
  let headerContentWidth = CONTENT_WIDTH

  if (data.showPhoto && data.photoUrl) {
    try {
      const res = await fetch(data.photoUrl)
      if (res.ok) {
        const imgBytes = new Uint8Array(await res.arrayBuffer())
        const ct = res.headers.get('content-type') ?? ''
        const image = ct.includes('png')
          ? await doc.embedPng(imgBytes)
          : await doc.embedJpg(imgBytes)
        page.drawImage(image, {
          x: PAGE_WIDTH - MARGIN - PHOTO_W,
          y: PAGE_HEIGHT - MARGIN - PHOTO_H,
          width: PHOTO_W,
          height: PHOTO_H
        })
        headerContentWidth = CONTENT_WIDTH - PHOTO_W - 8
      }
    } catch {
      // Photo fetch failed — skip, continue without photo
    }
  }

  // ── NAME ─────────────────────────────────────────────────────────────────
  const nameText = data.name || (data.lang === 'zh' ? '候选人' : 'Candidate')
  page.drawText(nameText, {
    x: MARGIN,
    y,
    size: 20,
    font: boldFont,
    color: darkGray
  })
  y -= 26

  // ── CONTACT ROW ──────────────────────────────────────────────────────────
  const contactParts = [
    data.contact.email,
    data.contact.phone,
    data.contact.location,
    data.contact.linkedin,
    data.contact.website
  ].filter(Boolean) as string[]

  if (contactParts.length) {
    const contactLine = contactParts.join('  ·  ')
    // Wrap if too long for header width
    y = drawWrapped(page, contactLine, MARGIN, y, headerContentWidth, regularFont, 9, midGray, 12)
    y -= 2
  }

  // ── SUMMARY ──────────────────────────────────────────────────────────────
  if (data.summary) {
    y = drawWrapped(page, data.summary, MARGIN, y, headerContentWidth, regularFont, 9.5, midGray, 12)
    y -= 4
  }

  // Ensure y is below photo bottom before divider
  const photoBotY = PAGE_HEIGHT - MARGIN - PHOTO_H - 8
  if (data.showPhoto && data.photoUrl && y > photoBotY) {
    y = photoBotY
  }

  // ── ACCENT DIVIDER ────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1.0,
    color: rgb(0.31, 0.27, 0.80)
  })
  y -= 16

  // ── EDUCATION ─────────────────────────────────────────────────────────────
  if (data.education.length > 0) {
    const label = data.lang === 'zh' ? 'EDUCATION / 教育背景' : 'EDUCATION'
    y = drawSectionHeading(page, label, y, boldFont)

    for (const edu of data.education) {
      if (y < MARGIN + 20) break
      // School + degree + major on left; years on right
      const schoolText = edu.school
      const degreeText = [edu.degree, edu.major].filter(Boolean).join(' ')
      const yearText = [edu.start_year, edu.end_year].filter(Boolean).join(' – ')

      // School name
      page.drawText(schoolText, {
        x: MARGIN,
        y,
        size: 11,
        font: boldFont,
        color: darkGray
      })

      // Years right-aligned
      if (yearText) {
        const yw = regularFont.widthOfTextAtSize(yearText, 9)
        page.drawText(yearText, {
          x: PAGE_WIDTH - MARGIN - yw,
          y,
          size: 9,
          font: regularFont,
          color: lightGray
        })
      }
      y -= LINE_H + 1

      // Degree · Major
      if (degreeText) {
        page.drawText(degreeText, {
          x: MARGIN,
          y,
          size: 10,
          font: regularFont,
          color: midGray
        })
        y -= LINE_H
      }

      // GPA / rank / honors
      const extras: string[] = []
      if (edu.gpa_score) extras.push(`GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}`)
      if (edu.class_rank_text) extras.push(edu.class_rank_text)
      if (edu.academic_honors) extras.push(edu.academic_honors)
      if (extras.length) {
        page.drawText(extras.join('  ·  '), {
          x: MARGIN,
          y,
          size: 9,
          font: regularFont,
          color: lightGray
        })
        y -= LINE_H
      }

      y -= 6
    }

    y -= 4
  }

  // ── WORK EXPERIENCE ───────────────────────────────────────────────────────
  const confirmedExps = data.experiences
    .map(exp => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter(a => a.status === 'confirmed')
    }))
    .filter(exp => exp.achievements.length > 0)

  if (confirmedExps.length > 0) {
    const label = data.lang === 'zh' ? 'WORK EXPERIENCE / 工作经历' : 'WORK EXPERIENCE'
    y = drawSectionHeading(page, label, y, boldFont)

    for (const exp of confirmedExps) {
      if (y < MARGIN + 20) break

      // Company + date row
      page.drawText(exp.company, {
        x: MARGIN,
        y,
        size: 11,
        font: boldFont,
        color: darkGray
      })

      const dateStr = exp.original_tenure ?? (() => {
        const startYear = exp.start_date ? new Date(exp.start_date).getFullYear() : null
        const endYear = exp.end_date ? new Date(exp.end_date).getFullYear() : null
        const endLabel = exp.is_current
          ? (data.lang === 'zh' ? '至今' : 'Present')
          : endYear ? String(endYear) : ''
        return startYear ? `${startYear}${endLabel ? ` – ${endLabel}` : ''}` : endLabel
      })()

      if (dateStr) {
        const dw = regularFont.widthOfTextAtSize(dateStr, 9)
        page.drawText(dateStr, {
          x: PAGE_WIDTH - MARGIN - dw,
          y,
          size: 9,
          font: regularFont,
          color: lightGray
        })
      }
      y -= LINE_H + 1

      // Job title
      if (exp.job_title) {
        page.drawText(exp.job_title, {
          x: MARGIN,
          y,
          size: 10,
          font: regularFont,
          color: midGray
        })
        y -= LINE_H + 1
      }

      // Achievement bullets — grouped by project
      type ProjectGroup = { projectName: string | null; items: typeof exp.achievements }
      const groups: ProjectGroup[] = []
      for (const a of exp.achievements) {
        const last = groups[groups.length - 1]
        if (last && last.projectName === (a.project_name ?? null)) {
          last.items.push(a)
        } else {
          groups.push({ projectName: a.project_name ?? null, items: [a] })
        }
      }

      for (const group of groups) {
        if (y < MARGIN + 10) break

        // Project sub-header
        if (group.projectName) {
          page.drawText(`▸ ${group.projectName}`, {
            x: MARGIN + 4,
            y,
            size: 9.5,
            font: boldFont,
            color: rgb(0.31, 0.27, 0.80)
          })
          y -= LINE_H
        }

        for (const ach of group.items) {
          if (y < MARGIN + 10) break
          const bullet = '• '
          const bulletW = regularFont.widthOfTextAtSize(bullet, 9)
          const maxW = CONTENT_WIDTH - bulletW - 8
          const lines = wrapText(ach.text, regularFont, 9, maxW)

          for (let i = 0; i < lines.length; i++) {
            if (y < MARGIN + 10) break
            page.drawText(i === 0 ? bullet + lines[i] : '  ' + lines[i], {
              x: MARGIN + 4,
              y,
              size: 9,
              font: regularFont,
              color: rgb(0.2, 0.2, 0.26)
            })
            y -= LINE_H
          }
        }
      }

      y -= 8
    }

    y -= 4
  }

  // ── SKILLS ────────────────────────────────────────────────────────────────
  if (data.skills.length > 0) {
    const label = data.lang === 'zh' ? 'SKILLS / 技能与证书' : 'SKILLS & CERTIFICATIONS'
    y = drawSectionHeading(page, label, y, boldFont)

    for (const group of data.skills) {
      if (y < MARGIN + 10) break
      const catText = `${group.category}: `
      const catW = boldFont.widthOfTextAtSize(catText, 9.5)
      page.drawText(catText, {
        x: MARGIN,
        y,
        size: 9.5,
        font: boldFont,
        color: darkGray
      })
      const itemsText = group.items.join(' · ')
      const itemsMaxW = CONTENT_WIDTH - catW
      const itemsLines = wrapText(itemsText, regularFont, 9.5, itemsMaxW)
      for (let i = 0; i < itemsLines.length; i++) {
        if (y < MARGIN + 10) break
        page.drawText(itemsLines[i], {
          x: i === 0 ? MARGIN + catW : MARGIN + catW,
          y,
          size: 9.5,
          font: regularFont,
          color: midGray
        })
        if (i < itemsLines.length - 1) y -= LINE_H
      }
      y -= LINE_H + 2
    }
  }

  // ── CERTIFICATIONS ────────────────────────────────────────────────────────
  const certs = data.certifications?.filter(c => c.name) ?? []
  if (certs.length > 0) {
    y -= 6
    const label = data.lang === 'zh' ? 'CERTIFICATIONS / 证书' : 'CERTIFICATIONS'
    y = drawSectionHeading(page, label, y, boldFont)
    for (const cert of certs) {
      if (y < MARGIN + 10) break
      const dateStr = cert.issue_year ? String(cert.issue_year) : ''
      const orgText = cert.issuing_org ? ` · ${cert.issuing_org}` : ''
      const expiryText = cert.expiry_year ? ` (exp. ${cert.expiry_year})` : (cert.is_current ? '' : '')
      const rightText = [dateStr, expiryText].filter(Boolean).join('')
      page.drawText(cert.name + orgText, { x: MARGIN, y, size: 9.5, font: regularFont, color: darkGray })
      if (rightText) {
        const rw = regularFont.widthOfTextAtSize(rightText, 9)
        page.drawText(rightText, { x: PAGE_WIDTH - MARGIN - rw, y, size: 9, font: regularFont, color: lightGray })
      }
      y -= LINE_H + 2
    }
    y -= 4
  }

  // ── SPOKEN LANGUAGES ──────────────────────────────────────────────────────
  const langs = data.spokenLanguages?.filter(l => l.language_name) ?? []
  if (langs.length > 0) {
    y -= 2
    const label = data.lang === 'zh' ? 'LANGUAGES / 语言能力' : 'LANGUAGES'
    y = drawSectionHeading(page, label, y, boldFont)
    const PROF_LABELS: Record<string, string> = {
      native_bilingual: data.lang === 'zh' ? '母语 / 双语' : 'Native / Bilingual',
      full_professional: data.lang === 'zh' ? '完全专业能力' : 'Full Professional',
      professional_working: data.lang === 'zh' ? '专业工作能力' : 'Professional Working',
      limited_working: data.lang === 'zh' ? '有限工作能力' : 'Limited Working',
      elementary: data.lang === 'zh' ? '初级' : 'Elementary',
    }
    const langLine = langs.map(l => `${l.language_name} (${PROF_LABELS[l.proficiency] ?? l.proficiency})`).join('  ·  ')
    y = drawWrapped(page, langLine, MARGIN, y, CONTENT_WIDTH, regularFont, 9.5, midGray, LINE_H)
    y -= 8
  }

  // ── AWARDS & HONORS ───────────────────────────────────────────────────────
  const awards = data.awards?.filter(a => a.title) ?? []
  if (awards.length > 0) {
    y -= 2
    const label = data.lang === 'zh' ? 'AWARDS & HONORS / 荣誉奖项' : 'AWARDS & HONORS'
    y = drawSectionHeading(page, label, y, boldFont)
    for (const award of awards) {
      if (y < MARGIN + 10) break
      const yearText = award.award_year ? String(award.award_year) : ''
      const orgText = award.issuing_org ? ` · ${award.issuing_org}` : ''
      page.drawText(award.title + orgText, { x: MARGIN, y, size: 9.5, font: regularFont, color: darkGray })
      if (yearText) {
        const rw = regularFont.widthOfTextAtSize(yearText, 9)
        page.drawText(yearText, { x: PAGE_WIDTH - MARGIN - rw, y, size: 9, font: regularFont, color: lightGray })
      }
      y -= LINE_H
      if (award.description) {
        y = drawWrapped(page, award.description, MARGIN + 4, y, CONTENT_WIDTH - 4, regularFont, 9, lightGray, LINE_H)
      }
      y -= 4
    }
    y -= 2
  }

  // ── PUBLICATIONS ──────────────────────────────────────────────────────────
  const pubs = data.publications?.filter(p => p.title) ?? []
  if (pubs.length > 0) {
    y -= 2
    const label = data.lang === 'zh' ? 'PUBLICATIONS / 论文出版' : 'PUBLICATIONS'
    y = drawSectionHeading(page, label, y, boldFont)
    for (const pub of pubs) {
      if (y < MARGIN + 10) break
      const yearText = pub.pub_year ? String(pub.pub_year) : ''
      const venueText = pub.publication_venue ? ` · ${pub.publication_venue}` : ''
      const titleLine = pub.title + venueText
      page.drawText(titleLine.length > 80 ? titleLine.slice(0, 77) + '...' : titleLine, {
        x: MARGIN, y, size: 9.5, font: regularFont, color: darkGray
      })
      if (yearText) {
        const rw = regularFont.widthOfTextAtSize(yearText, 9)
        page.drawText(yearText, { x: PAGE_WIDTH - MARGIN - rw, y, size: 9, font: regularFont, color: lightGray })
      }
      y -= LINE_H
      if (pub.authors?.length) {
        const authLine = pub.authors.slice(0, 5).join(', ') + (pub.authors.length > 5 ? ', et al.' : '')
        y = drawWrapped(page, authLine, MARGIN + 4, y, CONTENT_WIDTH - 4, regularFont, 8.5, lightGray, LINE_H)
      }
      y -= 4
    }
  }

  const bytes = await doc.save()
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}
