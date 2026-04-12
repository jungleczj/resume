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

// ── Page constants ────────────────────────────────────────────────────────────
const PAGE_W = 595
const PAGE_H = 842
const MARGIN  = 36       // outer margin (matches 36px padding in HTML)
const LINE_H  = 12

// ── Cobalt palette ────────────────────────────────────────────────────────────
const ACCENT     = rgb(0.145, 0.388, 0.922)   // #2563eb
const TEXT_MAIN  = rgb(0.204, 0.255, 0.341)   // #334155
const TEXT_BRIGHT= rgb(0.059, 0.090, 0.165)   // #0f172a
const TEXT_MUTED = rgb(0.392, 0.455, 0.545)   // #64748b
const SURFACE    = rgb(0.973, 0.980, 0.988)   // #f8fafc
const BORDER     = rgb(0.886, 0.910, 0.941)   // #e2e8f0

// ── Layout constants ──────────────────────────────────────────────────────────
const SIDEBAR_W   = Math.round((PAGE_W - MARGIN * 2) * 0.32)
const MAIN_X      = MARGIN + SIDEBAR_W + 18
const MAIN_W      = PAGE_W - MAIN_X - MARGIN
const SIDEBAR_X   = MARGIN
const HEADER_H    = 38   // header strip height

// ── Helpers ───────────────────────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w
    if (font.widthOfTextAtSize(test, size) > maxW) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxW: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
  lh = LINE_H,
): number {
  for (const line of wrapText(text, font, size, maxW)) {
    if (y < MARGIN) break
    page.drawText(line, { x, y, size, font, color })
    y -= lh
  }
  return y
}

function sectionHeading(
  page: PDFPage,
  label: string,
  x: number,
  y: number,
  maxW: number,
  font: PDFFont,
  isSidebar = false
): number {
  // Left accent bar
  page.drawRectangle({ x, y: y - 7, width: 2.5, height: 9, color: ACCENT })
  page.drawText(label, { x: x + 7, y, size: 8, font, color: TEXT_BRIGHT })
  y -= 10
  if (!isSidebar) {
    // Horizontal rule for main column
    page.drawLine({
      start: { x: x + font.widthOfTextAtSize(label, 8) + 12, y: y + 3 },
      end: { x: x + maxW, y: y + 3 },
      thickness: 0.4,
      color: BORDER,
    })
  }
  y -= 4
  return y
}

export async function generatePDF(data: PDFData): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  let regular: PDFFont
  let bold: PDFFont

  if (data.lang === 'zh') {
    try {
      const fontBytes = readFileSync(join(process.cwd(), 'public', 'fonts', 'SimHei.ttf'))
      const emb = await doc.embedFont(fontBytes)
      regular = emb
      bold = emb
    } catch {
      regular = await doc.embedFont(StandardFonts.Helvetica)
      bold = await doc.embedFont(StandardFonts.HelveticaBold)
    }
  } else {
    regular = await doc.embedFont(StandardFonts.Helvetica)
    bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  }

  const page = doc.addPage([PAGE_W, PAGE_H])

  // ── HEADER STRIP ─────────────────────────────────────────────────────────
  const headerY = PAGE_H - MARGIN

  // Name in accent
  page.drawText((data.name || (data.lang === 'zh' ? '候选人' : 'Candidate')).toUpperCase(), {
    x: MARGIN, y: headerY - 12, size: 10, font: bold, color: ACCENT,
  })

  // Thin accent underline
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN - HEADER_H },
    end:   { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - HEADER_H },
    thickness: 1, color: ACCENT, opacity: 0.5,
  })

  const bodyTopY = PAGE_H - MARGIN - HEADER_H - 14

  // ── LEFT SIDEBAR ─────────────────────────────────────────────────────────
  let sy = bodyTopY

  // Photo
  if (data.showPhoto && data.photoUrl) {
    try {
      const res = await fetch(data.photoUrl)
      if (res.ok) {
        const imgBytes = new Uint8Array(await res.arrayBuffer())
        const ct = res.headers.get('content-type') ?? ''
        const image = ct.includes('png') ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes)
        page.drawRectangle({ x: SIDEBAR_X - 1, y: sy - 82, width: 62, height: 82, color: SURFACE, borderColor: BORDER, borderWidth: 0.5 })
        page.drawImage(image, { x: SIDEBAR_X, y: sy - 80, width: 60, height: 78 })
        sy -= 88
      }
    } catch { /* skip */ }
  }

  // Name
  page.drawText(data.name || (data.lang === 'zh' ? '候选人' : 'Candidate'), {
    x: SIDEBAR_X, y: sy, size: 13, font: bold, color: ACCENT,
  })
  sy -= 14

  // Contact
  const contactLines = [
    data.contact.email,
    data.contact.phone,
    data.contact.location,
    data.contact.linkedin,
    data.contact.website,
  ].filter(Boolean) as string[]

  for (const c of contactLines) {
    if (sy < MARGIN) break
    sy = drawWrapped(page, c, SIDEBAR_X, sy, SIDEBAR_W - 4, regular, 7.5, TEXT_MUTED, 10)
  }
  sy -= 8

  // Skills
  if (data.skills.length > 0) {
    sy = sectionHeading(page, data.lang === 'zh' ? '核心技能' : 'Core Skills', SIDEBAR_X, sy, SIDEBAR_W, bold, true)
    for (const group of data.skills) {
      if (sy < MARGIN) break
      page.drawText(group.category + ':', { x: SIDEBAR_X, y: sy, size: 7.5, font: bold, color: TEXT_BRIGHT })
      sy -= 9
      for (const item of group.items) {
        if (sy < MARGIN) break
        sy = drawWrapped(page, `· ${item}`, SIDEBAR_X + 3, sy, SIDEBAR_W - 6, regular, 7.5, TEXT_MAIN, 9)
      }
      sy -= 3
    }
    sy -= 4
  }

  // Certifications + Awards
  const certAward = [
    ...(data.certifications?.filter(c => c.name) ?? []).map(c => ({ title: c.name, sub: c.issuing_org ?? '' })),
    ...(data.awards?.filter(a => a.title) ?? []).map(a => ({ title: a.title, sub: a.issuing_org ?? '' })),
  ]
  if (certAward.length > 0) {
    sy = sectionHeading(page, data.lang === 'zh' ? '证书与荣誉' : 'Awards & Certs', SIDEBAR_X, sy, SIDEBAR_W, bold, true)
    for (const item of certAward) {
      if (sy < MARGIN) break
      sy = drawWrapped(page, item.title, SIDEBAR_X, sy, SIDEBAR_W - 4, bold, 7.5, TEXT_BRIGHT, 9)
      if (item.sub) {
        sy = drawWrapped(page, item.sub, SIDEBAR_X, sy, SIDEBAR_W - 4, regular, 7, TEXT_MUTED, 9)
      }
      sy -= 3
    }
    sy -= 4
  }

  // Languages
  const langs = data.spokenLanguages?.filter(l => l.language_name) ?? []
  if (langs.length > 0) {
    sy = sectionHeading(page, data.lang === 'zh' ? '语言能力' : 'Languages', SIDEBAR_X, sy, SIDEBAR_W, bold, true)
    for (const l of langs) {
      if (sy < MARGIN) break
      const prof = l.is_native
        ? (data.lang === 'zh' ? '母语' : 'Native')
        : l.proficiency.replace(/_/g, ' ')
      page.drawText(`${l.language_name}  (${prof})`, { x: SIDEBAR_X, y: sy, size: 7.5, font: regular, color: TEXT_MAIN })
      sy -= 10
    }
  }

  // ── RIGHT MAIN CONTENT ────────────────────────────────────────────────────
  let my = bodyTopY

  // Summary
  if (data.summary) {
    // Summary card background
    const summaryLines = wrapText(data.summary, regular, 8.5, MAIN_W - 16)
    const cardH = summaryLines.length * 11 + 22
    page.drawRectangle({ x: MAIN_X - 4, y: my - cardH, width: MAIN_W + 8, height: cardH, color: SURFACE, borderColor: BORDER, borderWidth: 0.5 })
    page.drawRectangle({ x: MAIN_X - 4, y: my - cardH, width: 2.5, height: cardH, color: ACCENT })
    page.drawText(data.lang === 'zh' ? '个人简介' : 'Executive Summary', {
      x: MAIN_X + 4, y: my - 10, size: 9, font: bold, color: TEXT_BRIGHT,
    })
    my -= 20
    my = drawWrapped(page, data.summary, MAIN_X + 4, my, MAIN_W - 12, regular, 8.5, TEXT_MAIN, 11)
    my -= 12
  }

  // Work Experience
  const confirmedExps = data.experiences
    .map(exp => ({ ...exp, achievements: (exp.achievements ?? []).filter(a => a.status === 'confirmed') }))
    .filter(exp => exp.achievements.length > 0)

  if (confirmedExps.length > 0) {
    my = sectionHeading(page, data.lang === 'zh' ? '工作经历' : 'Professional Experience', MAIN_X, my, MAIN_W, bold)

    for (let i = 0; i < confirmedExps.length; i++) {
      if (my < MARGIN + 20) break
      const exp = confirmedExps[i]

      // Timeline dot
      page.drawCircle({ x: MAIN_X - 10, y: my + 3, size: 3.5, color: i === 0 ? ACCENT : BORDER })

      // Job title
      page.drawText(exp.job_title || '', { x: MAIN_X, y: my, size: 9.5, font: bold, color: TEXT_BRIGHT })
      my -= 11

      // Company + tenure
      const dateStr = exp.original_tenure ?? (() => {
        const sy2 = exp.start_date ? new Date(exp.start_date).getFullYear() : null
        const ey = exp.end_date ? new Date(exp.end_date).getFullYear() : null
        const endLbl = exp.is_current ? (data.lang === 'zh' ? '至今' : 'Present') : ey ? String(ey) : ''
        return sy2 ? `${sy2}${endLbl ? ` – ${endLbl}` : ''}` : endLbl
      })()

      page.drawText((exp.company || '').toUpperCase(), { x: MAIN_X, y: my, size: 8, font: bold, color: ACCENT })
      if (dateStr) {
        const dw = regular.widthOfTextAtSize(dateStr, 7.5)
        page.drawText(dateStr, { x: MAIN_X + MAIN_W - dw, y: my, size: 7.5, font: regular, color: TEXT_MUTED })
      }
      my -= 11

      // Achievement bullets
      type PG = { projectName: string | null; items: typeof exp.achievements }
      const groups: PG[] = []
      for (const a of exp.achievements) {
        const last = groups[groups.length - 1]
        if (last && last.projectName === (a.project_name ?? null)) last.items.push(a)
        else groups.push({ projectName: a.project_name ?? null, items: [a] })
      }

      for (const group of groups) {
        if (my < MARGIN + 10) break
        if (group.projectName) {
          page.drawText(`▸ ${group.projectName}`, { x: MAIN_X + 4, y: my, size: 8, font: bold, color: ACCENT })
          my -= 10
        }
        for (const ach of group.items) {
          if (my < MARGIN + 10) break
          // "/" bullet matching Cobalt HTML
          page.drawText('/', { x: MAIN_X + 2, y: my, size: 8.5, font: bold, color: ACCENT })
          const maxW = MAIN_W - 14
          my = drawWrapped(page, ach.text, MAIN_X + 10, my, maxW, regular, 8.5, TEXT_MAIN, 11)
        }
      }
      my -= 8
    }
    my -= 4
  }

  // Education (2-column grid simulation)
  if (data.education.length > 0) {
    my = sectionHeading(page, data.lang === 'zh' ? '教育背景' : 'Academic Background', MAIN_X, my, MAIN_W, bold)

    const colW = Math.floor((MAIN_W - 8) / 2)
    for (let i = 0; i < data.education.length; i++) {
      if (my < MARGIN + 30) break
      const edu = data.education[i]
      const col = i % 2
      const ex = MAIN_X + col * (colW + 8)

      // Card
      const cardH = 48
      page.drawRectangle({ x: ex - 2, y: my - cardH, width: colW + 4, height: cardH, color: SURFACE, borderColor: BORDER, borderWidth: 0.5 })
      page.drawRectangle({ x: ex - 2, y: my - cardH, width: colW + 4, height: 1.5, color: i === 0 ? ACCENT : rgb(0.5, 0.5, 0.5) })

      if (edu.degree) {
        page.drawText(edu.degree.toUpperCase(), { x: ex + 2, y: my - 8, size: 6.5, font: bold, color: ACCENT })
      }
      page.drawText([edu.major, edu.school].filter(Boolean).join(' · ') || edu.school, {
        x: ex + 2, y: my - 18, size: 8.5, font: bold, color: TEXT_BRIGHT,
      })

      const yearText = [edu.start_year, edu.end_year].filter(Boolean).join('–')
      const gpa = edu.gpa_score ? `GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}` : ''
      page.drawText([gpa, yearText].filter(Boolean).join(' • '), {
        x: ex + 2, y: my - 30, size: 7, font: regular, color: TEXT_MUTED,
      })

      if (col === 1 || i === data.education.length - 1) {
        my -= cardH + 8
      }
    }
    my -= 4
  }

  // Publications
  const pubs = data.publications?.filter(p => p.title) ?? []
  if (pubs.length > 0) {
    my = sectionHeading(page, data.lang === 'zh' ? '学术成果' : 'Publications & Research', MAIN_X, my, MAIN_W, bold)
    for (const pub of pubs) {
      if (my < MARGIN + 10) break
      page.drawText('›', { x: MAIN_X + 2, y: my, size: 8.5, font: bold, color: ACCENT })
      const titleLine = pub.title.length > 72 ? pub.title.slice(0, 69) + '...' : pub.title
      page.drawText(titleLine, { x: MAIN_X + 10, y: my, size: 8.5, font: bold, color: TEXT_BRIGHT })
      my -= 10
      if (pub.publication_venue) {
        page.drawText(`${pub.publication_venue}${pub.pub_year ? `, ${pub.pub_year}` : ''}`, {
          x: MAIN_X + 10, y: my, size: 7.5, font: regular, color: TEXT_MUTED,
        })
        my -= 9
      }
      my -= 3
    }
  }

  // Footer
  page.drawLine({
    start: { x: MARGIN, y: MARGIN + 14 },
    end:   { x: PAGE_W - MARGIN, y: MARGIN + 14 },
    thickness: 0.4, color: BORDER,
  })
  page.drawText('CareerFlow · Professional Portfolio System · 2024', {
    x: PAGE_W / 2 - 95, y: MARGIN + 5, size: 6.5, font: regular, color: rgb(0.7, 0.75, 0.8),
  })

  const bytes = await doc.save()
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}
