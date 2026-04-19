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

// ── Scale: HTML canvas 794×1123 px → PDF A4 595×842 pt ──────────────────────
// 1 HTML px = S PDF pt   (72 dpi / 96 dpi = 0.75)
const S = 595 / 794 // ≈ 0.7494

// ── Page ─────────────────────────────────────────────────────────────────────
const PW = 595
const PH = 842

// ── Margins (HTML: padding 36 px sides) ──────────────────────────────────────
const MX = Math.round(36 * S)           // 27

// ── Cobalt palette (matches ResumePreview.tsx) ───────────────────────────────
const ACCENT      = rgb(0.145, 0.388, 0.922)  // #2563eb
const TEXT_MAIN   = rgb(0.204, 0.255, 0.341)  // #334155
const TEXT_BRIGHT = rgb(0.059, 0.090, 0.165)  // #0f172a
const TEXT_MUTED  = rgb(0.392, 0.455, 0.545)  // #64748b
const SURFACE     = rgb(0.973, 0.980, 0.988)  // #f8fafc
const BORDER      = rgb(0.886, 0.910, 0.941)  // #e2e8f0
const MUTED_LIGHT = rgb(0.580, 0.639, 0.722)  // #94a3b8

// ── Two-column layout (HTML: sidebar 32 %, paddingRight 24 px) ───────────────
const CONTENT_W    = PW - 2 * MX                          // ~541
const SIDEBAR_W    = Math.round(CONTENT_W * 0.32)         // ~173
const SIDEBAR_GAP  = Math.round(24 * S)                   // ~18
const SIDEBAR_X    = MX
const MAIN_X       = SIDEBAR_X + SIDEBAR_W + SIDEBAR_GAP
const MAIN_W       = PW - MAIN_X - MX

// ── Font-size helpers (HTML px → PDF pt, rounded to 0.5) ─────────────────────
const px = (v: number) => Math.round(v * S * 2) / 2

// ── CJK detection ────────────────────────────────────────────────────────────
function isCJK(code: number): boolean {
  return (code >= 0x4e00 && code <= 0x9fff) ||
         (code >= 0x3400 && code <= 0x4dbf) ||
         (code >= 0xf900 && code <= 0xfaff) ||
         (code >= 0x3000 && code <= 0x303f) ||
         (code >= 0xff00 && code <= 0xffef)
}

// ── Text wrapping (CJK-aware) ────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  if (!text || maxW <= 0) return ['']
  try { if (font.widthOfTextAtSize(text, size) <= maxW) return [text] } catch { return [text] }

  const lines: string[] = []
  let lineStart = 0
  let lastBreak = -1

  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (text[i] === ' ' || isCJK(c)) lastBreak = i + 1

    try {
      if (font.widthOfTextAtSize(text.slice(lineStart, i + 1), size) > maxW) {
        if (lastBreak > lineStart) {
          lines.push(text.slice(lineStart, lastBreak).trimEnd())
          lineStart = lastBreak
          lastBreak = -1
        } else if (i > lineStart) {
          lines.push(text.slice(lineStart, i).trimEnd())
          lineStart = i
        } else {
          lines.push(text[i])
          lineStart = i + 1
        }
      }
    } catch { /* skip unmeasurable chars */ }
  }
  const tail = text.slice(lineStart).trimEnd()
  if (tail) lines.push(tail)
  return lines.length ? lines : ['']
}

// ── Draw wrapped text block, returns new Y ───────────────────────────────────
function drawWrapped(
  page: PDFPage, text: string,
  x: number, y: number, maxW: number,
  font: PDFFont, size: number,
  color: ReturnType<typeof rgb>,
  lineH: number,
  minY = MX,
): number {
  for (const line of wrapText(text, font, size, maxW)) {
    if (y < minY) break
    page.drawText(line, { x, y, size, font, color })
    y -= lineH
  }
  return y
}

// ═════════════════════════════════════════════════════════════════════════════
export async function generatePDF(data: PDFData): Promise<Blob> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  // ── Load fonts ─────────────────────────────────────────────────────────────
  let sansR: PDFFont, sansB: PDFFont, serifR: PDFFont, serifB: PDFFont

  if (data.lang === 'zh') {
    try {
      const fontBytes = readFileSync(join(process.cwd(), 'public', 'fonts', 'SimHei.ttf'))
      const emb = await doc.embedFont(fontBytes)
      sansR = emb; sansB = emb; serifR = emb; serifB = emb
    } catch {
      sansR  = await doc.embedFont(StandardFonts.Helvetica)
      sansB  = await doc.embedFont(StandardFonts.HelveticaBold)
      serifR = await doc.embedFont(StandardFonts.TimesRoman)
      serifB = await doc.embedFont(StandardFonts.TimesRomanBold)
    }
  } else {
    sansR  = await doc.embedFont(StandardFonts.Helvetica)
    sansB  = await doc.embedFont(StandardFonts.HelveticaBold)
    serifR = await doc.embedFont(StandardFonts.TimesRoman)
    serifB = await doc.embedFont(StandardFonts.TimesRomanBold)
  }
  const monoR = await doc.embedFont(StandardFonts.Courier)

  const page = doc.addPage([PW, PH])

  // ═══ HEADER STRIP ══════════════════════════════════════════════════════════
  // HTML: padding 18px 36px 14px, name 13px Noto Serif 900 uppercase, accent line 2px
  const hdrTopY = PH - Math.round(18 * S) // top edge minus 18px padding

  // Name (left)
  page.drawText(
    (data.name || (data.lang === 'zh' ? '候选人' : 'Candidate')).toUpperCase(),
    { x: MX, y: hdrTopY - px(13), size: px(13), font: serifB, color: ACCENT },
  )

  // CV_2024 label (right) — monospace, 9px, textMain 50% opacity
  const cvLabel = 'CV_2024'
  const cvW = monoR.widthOfTextAtSize(cvLabel, px(9))
  page.drawText(cvLabel, {
    x: PW - MX - cvW, y: hdrTopY - px(9), size: px(9), font: monoR,
    color: TEXT_MUTED, opacity: 0.5,
  })

  // Accent line — HTML: height 2px, margin 0 36px, opacity 0.5
  const hdrLineY = hdrTopY - Math.round(14 * S) - Math.round(13 * S) // below name + bottom padding
  page.drawLine({
    start: { x: MX, y: hdrLineY },
    end: { x: PW - MX, y: hdrLineY },
    thickness: Math.round(2 * S), color: ACCENT, opacity: 0.5,
  })

  // ═══ BODY (two-column, starts below header) ════════════════════════════════
  // HTML: padding 28px 36px 28px
  const bodyTopY = hdrLineY - Math.round(28 * S)

  // Footer zone
  const ftrZoneH = Math.round(10 * S) + px(8) + Math.round(10 * S) + 1 // padding + text + padding + border
  const minY = MX + ftrZoneH

  // ═══ LEFT SIDEBAR ══════════════════════════════════════════════════════════
  let sy = bodyTopY

  // ── Contact card (background rectangle) ─────────────────────────────────
  // HTML: bg #f8fafc, border 1px #e2e8f0, borderRadius 6px, padding 18px 14px
  const cardPadT = Math.round(18 * S)
  const cardPadX = Math.round(14 * S)

  // Estimate card height for background drawing
  const contactLines = [
    data.contact.email, data.contact.phone, data.contact.location,
    data.contact.linkedin, data.contact.website,
  ].filter(Boolean) as string[]

  const photoH = (data.showPhoto && data.photoUrl) ? Math.round(96 * S) + Math.round(12 * S) : 0
  const nameH = px(18) + 4
  const titleH = (data.experiences[0]?.job_title) ? px(9) + 6 : 0
  const contactH = contactLines.length * (px(10) + 3)
  const innerGap = Math.round(12 * S) // gap between sections inside card
  const cardInnerH = photoH + nameH + titleH + innerGap + contactH
  const cardH = cardPadT * 2 + cardInnerH

  // Draw card background
  page.drawRectangle({
    x: SIDEBAR_X, y: sy - cardH,
    width: SIDEBAR_W, height: cardH,
    color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
  })

  let cy = sy - cardPadT // cursor inside card

  // Photo
  if (data.showPhoto && data.photoUrl) {
    const phW = Math.round(80 * S)
    const phH = Math.round(96 * S)
    try {
      const res = await fetch(data.photoUrl)
      if (res.ok) {
        const imgBytes = new Uint8Array(await res.arrayBuffer())
        const ct = res.headers.get('content-type') ?? ''
        const image = ct.includes('png')
          ? await doc.embedPng(imgBytes)
          : await doc.embedJpg(imgBytes)
        // Photo border box
        page.drawRectangle({
          x: SIDEBAR_X + cardPadX, y: cy - phH,
          width: phW, height: phH,
          borderColor: BORDER, borderWidth: 0.5,
        })
        page.drawImage(image, {
          x: SIDEBAR_X + cardPadX + 0.5, y: cy - phH + 0.5,
          width: phW - 1, height: phH - 1,
        })
        cy -= phH + Math.round(12 * S)
      }
    } catch { /* skip photo */ }
  }

  // Name — HTML: Noto Serif 700, 18px, accent
  page.drawText(data.name || (data.lang === 'zh' ? '候选人' : 'Candidate'), {
    x: SIDEBAR_X + cardPadX, y: cy - px(18), size: px(18), font: serifB, color: ACCENT,
  })
  cy -= px(18) + 4

  // Job title — HTML: 600 weight, 9px, uppercase, textMain
  const firstTitle = data.experiences.find(e => (e.achievements ?? []).some(a => a.status === 'confirmed'))?.job_title
  if (firstTitle) {
    page.drawText(firstTitle.toUpperCase(), {
      x: SIDEBAR_X + cardPadX, y: cy - px(9), size: px(9), font: sansB, color: TEXT_MAIN,
    })
    cy -= px(9) + 6
  }

  cy -= innerGap

  // Contact items — HTML: fontSize 10px, icon gap 6px, color textMain cc
  for (const line of contactLines) {
    if (cy < minY) break
    cy = drawWrapped(page, line, SIDEBAR_X + cardPadX, cy, SIDEBAR_W - cardPadX * 2, sansR, px(10), TEXT_MUTED, px(10) + 3, minY)
  }

  sy = sy - cardH - Math.round(20 * S) // gap 20px between sidebar sections

  // ── Helper: sidebar section heading ─────────────────────────────────────
  function sidebarHeading(label: string, y: number): number {
    // HTML: Noto Serif 700, 11px, uppercase, letterSpacing 0.05em
    // Left accent bar: 3px wide, paddingLeft 8px
    const barW = Math.round(3 * S)
    const padL = Math.round(8 * S)
    page.drawRectangle({
      x: SIDEBAR_X, y: y - px(11) - 2,
      width: barW, height: px(11) + 4,
      color: ACCENT,
    })
    page.drawText(label.toUpperCase(), {
      x: SIDEBAR_X + barW + padL, y: y - px(11),
      size: px(11), font: serifB, color: TEXT_BRIGHT,
    })
    return y - px(11) - Math.round(8 * S) // marginBottom 8px
  }

  // ── Skills ──────────────────────────────────────────────────────────────
  if (data.skills.length > 0) {
    sy = sidebarHeading(data.lang === 'zh' ? '核心技能' : 'Core Skills', sy)

    for (const group of data.skills) {
      if (sy < minY) break
      // Category label — HTML: 8px, 700, uppercase, accent ~70%
      page.drawText((group.category + ':').toUpperCase(), {
        x: SIDEBAR_X, y: sy - px(8), size: px(8), font: sansB, color: ACCENT, opacity: 0.7,
      })
      sy -= px(8) + Math.round(5 * S)

      // Skill pills — HTML: padding 2px 7px, bg surface, border, fontSize 9px
      const pillPadX = Math.round(7 * S)
      const pillPadY = Math.round(2 * S)
      const pillH = px(9) + pillPadY * 2
      const pillGap = Math.round(4 * S)
      let pillX = SIDEBAR_X
      let pillRowY = sy

      for (const item of group.items) {
        if (pillRowY < minY) break
        const tw = sansR.widthOfTextAtSize(item, px(9))
        const pillW = tw + pillPadX * 2

        // Wrap to next row if needed
        if (pillX + pillW > SIDEBAR_X + SIDEBAR_W && pillX > SIDEBAR_X) {
          pillRowY -= pillH + pillGap
          pillX = SIDEBAR_X
        }

        // Draw pill background
        page.drawRectangle({
          x: pillX, y: pillRowY - pillH,
          width: pillW, height: pillH,
          color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
        })
        page.drawText(item, {
          x: pillX + pillPadX, y: pillRowY - pillPadY - px(9),
          size: px(9), font: sansR, color: TEXT_MAIN,
        })

        pillX += pillW + pillGap
      }

      sy = pillRowY - pillH - Math.round(10 * S) // gap between skill groups
    }
    sy -= Math.round(10 * S)
  }

  // ── Certifications + Awards ─────────────────────────────────────────────
  const certAward = [
    ...(data.certifications?.filter(c => c.name) ?? []).map(c => ({
      title: c.name, sub: c.issuing_org ? `${c.issuing_org}${c.issue_year ? ' · ' + c.issue_year : ''}` : c.issue_year ? String(c.issue_year) : '',
    })),
    ...(data.awards?.filter(a => a.title) ?? []).map(a => ({
      title: a.title, sub: a.issuing_org ? `${a.issuing_org}${a.award_year ? ' · ' + a.award_year : ''}` : a.award_year ? String(a.award_year) : '',
    })),
  ]
  if (certAward.length > 0) {
    sy = sidebarHeading(data.lang === 'zh' ? '证书与荣誉' : 'Awards & Certs', sy)
    const itemPad = Math.round(5 * S)
    const itemPadX = Math.round(8 * S)

    for (const item of certAward) {
      if (sy < minY) break
      const titleLines = wrapText(item.title, sansB, px(9), SIDEBAR_W - itemPadX * 2)
      const subLines = item.sub ? wrapText(item.sub, sansR, px(8), SIDEBAR_W - itemPadX * 2) : []
      const itemH = itemPad * 2 + titleLines.length * (px(9) + 2) + (subLines.length > 0 ? subLines.length * (px(8) + 1) + 1 : 0)

      // Card background
      page.drawRectangle({
        x: SIDEBAR_X, y: sy - itemH,
        width: SIDEBAR_W, height: itemH,
        color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
        opacity: 0.5,
      })

      let iy = sy - itemPad
      for (const line of titleLines) {
        page.drawText(line, { x: SIDEBAR_X + itemPadX, y: iy - px(9), size: px(9), font: sansB, color: TEXT_BRIGHT })
        iy -= px(9) + 2
      }
      if (item.sub) {
        iy -= 1
        for (const line of subLines) {
          page.drawText(line, { x: SIDEBAR_X + itemPadX, y: iy - px(8), size: px(8), font: sansR, color: MUTED_LIGHT })
          iy -= px(8) + 1
        }
      }

      sy -= itemH + Math.round(5 * S)
    }
    sy -= Math.round(8 * S)
  }

  // ── Languages ───────────────────────────────────────────────────────────
  const langs = data.spokenLanguages?.filter(l => l.language_name) ?? []
  if (langs.length > 0) {
    sy = sidebarHeading(data.lang === 'zh' ? '语言能力' : 'Languages', sy)
    const itemPad = Math.round(5 * S)
    const itemPadX = Math.round(8 * S)

    for (const l of langs) {
      if (sy < minY) break
      const prof = l.is_native
        ? (data.lang === 'zh' ? '母语' : 'Native')
        : l.proficiency.replace(/_/g, ' ')
      const label = `${l.language_name}  (${prof})`
      const itemH = itemPad * 2 + px(9)

      page.drawRectangle({
        x: SIDEBAR_X, y: sy - itemH,
        width: SIDEBAR_W, height: itemH,
        color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
        opacity: 0.5,
      })
      page.drawText(l.language_name, {
        x: SIDEBAR_X + itemPadX, y: sy - itemPad - px(9),
        size: px(9), font: sansB, color: TEXT_BRIGHT,
      })
      const nameW = sansB.widthOfTextAtSize(l.language_name, px(9))
      page.drawText(`  (${prof})`, {
        x: SIDEBAR_X + itemPadX + nameW, y: sy - itemPad - px(9),
        size: px(9), font: sansR, color: TEXT_MUTED,
      })

      sy -= itemH + Math.round(5 * S)
    }
  }

  // ═══ RIGHT MAIN CONTENT ════════════════════════════════════════════════════
  let my = bodyTopY

  // ── Helper: main section heading ────────────────────────────────────────
  function mainHeading(label: string, y: number): number {
    // HTML: Noto Serif 700, 15px, with horizontal divider line, marginBottom 16px
    const sz = px(15)
    page.drawText(label, { x: MAIN_X, y: y - sz, size: sz, font: serifB, color: TEXT_BRIGHT })
    const textW = serifB.widthOfTextAtSize(label, sz)
    const lineStartX = MAIN_X + textW + Math.round(10 * S)
    page.drawLine({
      start: { x: lineStartX, y: y - sz + sz / 2 },
      end: { x: MAIN_X + MAIN_W, y: y - sz + sz / 2 },
      thickness: 0.5, color: BORDER,
    })
    return y - sz - Math.round(16 * S) // marginBottom 16px
  }

  // ── Executive Summary ───────────────────────────────────────────────────
  if (data.summary) {
    // HTML: bg surface, border, borderLeft 3px accent, borderRadius 5, padding 14px 16px
    const sPadT = Math.round(14 * S)
    const sPadX = Math.round(16 * S)
    const summaryLines = wrapText(data.summary, sansR, px(10.5), MAIN_W - sPadX * 2 - Math.round(3 * S))
    const summaryLH = px(10.5) * 1.65
    const headingH = px(13) + Math.round(7 * S)
    const summaryCardH = sPadT * 2 + headingH + summaryLines.length * summaryLH

    // Card background
    page.drawRectangle({
      x: MAIN_X, y: my - summaryCardH,
      width: MAIN_W, height: summaryCardH,
      color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
    })
    // Left accent bar
    page.drawRectangle({
      x: MAIN_X, y: my - summaryCardH,
      width: Math.round(3 * S), height: summaryCardH,
      color: ACCENT,
    })

    let scy = my - sPadT
    // Heading — HTML: Noto Serif 700, 13px, textBright
    page.drawText(data.lang === 'zh' ? '个人简介' : 'Executive Summary', {
      x: MAIN_X + Math.round(3 * S) + sPadX, y: scy - px(13),
      size: px(13), font: serifB, color: TEXT_BRIGHT,
    })
    scy -= headingH

    // Body text — HTML: 10.5px, lineHeight 1.65, textMain
    for (const line of summaryLines) {
      page.drawText(line, {
        x: MAIN_X + Math.round(3 * S) + sPadX, y: scy - px(10.5),
        size: px(10.5), font: sansR, color: TEXT_MAIN,
      })
      scy -= summaryLH
    }

    my -= summaryCardH + Math.round(24 * S) // gap 24px between main sections
  }

  // ── Work Experience ─────────────────────────────────────────────────────
  const confirmedExps = data.experiences
    .map(exp => ({ ...exp, achievements: (exp.achievements ?? []).filter(a => a.status === 'confirmed') }))
    .filter(exp => exp.achievements.length > 0)

  if (confirmedExps.length > 0) {
    my = mainHeading(data.lang === 'zh' ? '工作经历' : 'Professional Experience', my)

    const expPadL = Math.round(18 * S) // paddingLeft for timeline
    const dotSize = Math.round(8 * S)

    for (let i = 0; i < confirmedExps.length; i++) {
      if (my < minY + 30) break
      const exp = confirmedExps[i]

      // Timeline dot — HTML: 8×8px, first=accent, rest=border
      const dotCX = MAIN_X + dotSize / 2
      const dotCY = my - dotSize / 2 + 2
      page.drawCircle({
        x: dotCX, y: dotCY, size: dotSize / 2,
        color: i === 0 ? ACCENT : BORDER,
      })

      // Connecting line between dots
      if (i < confirmedExps.length - 1) {
        page.drawLine({
          start: { x: dotCX, y: dotCY - dotSize / 2 },
          end: { x: dotCX, y: dotCY - 60 }, // approximate, will be overlapped
          thickness: Math.round(1 * S), color: ACCENT, opacity: 0.19,
        })
      }

      // Job title — HTML: 700, 12px, textBright
      const titleX = MAIN_X + expPadL
      const titleMaxW = MAIN_W - expPadL
      page.drawText(exp.job_title || '', {
        x: titleX, y: my - px(12), size: px(12), font: sansB, color: TEXT_BRIGHT,
      })
      my -= px(12) + 3

      // Company (left, accent uppercase) + Date badge (right)
      page.drawText((exp.company || '').toUpperCase(), {
        x: titleX, y: my - px(10), size: px(10), font: sansB, color: ACCENT,
      })

      const dateStr = exp.original_tenure ?? (() => {
        const sy2 = exp.start_date ? new Date(exp.start_date).getFullYear() : null
        const ey = exp.end_date ? new Date(exp.end_date).getFullYear() : null
        const endLbl = exp.is_current ? (data.lang === 'zh' ? '至今' : 'Present') : ey ? String(ey) : ''
        return sy2 ? `${sy2}${endLbl ? ` – ${endLbl}` : ''}` : endLbl
      })()
      if (dateStr) {
        // Date badge — HTML: monospace 8px, bg surface, border, padding 2px 7px
        const dtSize = px(8)
        const dtW = monoR.widthOfTextAtSize(dateStr, dtSize)
        const badgePadX = Math.round(7 * S)
        const badgePadY = Math.round(2 * S)
        const badgeW = dtW + badgePadX * 2
        const badgeH = dtSize + badgePadY * 2
        const badgeX = MAIN_X + MAIN_W - badgeW
        const badgeY = my - badgeH + badgePadY

        page.drawRectangle({
          x: badgeX, y: badgeY,
          width: badgeW, height: badgeH,
          color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
        })
        page.drawText(dateStr, {
          x: badgeX + badgePadX, y: badgeY + badgePadY,
          size: dtSize, font: monoR, color: TEXT_MAIN,
        })
      }
      my -= px(10) + Math.round(7 * S)

      // Achievement bullets
      type PG = { projectName: string | null; items: typeof exp.achievements }
      const groups: PG[] = []
      for (const a of exp.achievements) {
        const last = groups[groups.length - 1]
        if (last && last.projectName === (a.project_name ?? null)) last.items.push(a)
        else groups.push({ projectName: a.project_name ?? null, items: [a] })
      }

      for (const group of groups) {
        if (my < minY + 10) break

        // Project name — HTML: 10px, accent, fontWeight 600
        if (group.projectName) {
          page.drawText(`▸ ${group.projectName}`, {
            x: titleX + 4, y: my - px(10), size: px(10), font: sansB, color: ACCENT,
          })
          my -= px(10) + Math.round(4 * S)
        }

        for (const ach of group.items) {
          if (my < minY + 10) break

          // Slash bullet — HTML: accent, 900 weight, 11px
          page.drawText('/', {
            x: titleX, y: my - px(11), size: px(11), font: sansB, color: ACCENT,
          })

          // Tier dot — HTML: 5×5px circle, green/yellow/red
          const tierColor = ach.tier === 1 ? rgb(0.063, 0.725, 0.506) // #10b981
            : ach.tier === 2 ? rgb(0.961, 0.620, 0.043) // #f59e0b
            : rgb(0.973, 0.443, 0.443) // #f87171
          const dotR = Math.round(5 * S) / 2
          page.drawCircle({
            x: titleX + px(11) + 4 + dotR,
            y: my - px(11) / 2 - 1,
            size: dotR, color: tierColor,
          })

          // Achievement text
          const achX = titleX + px(11) + 4 + dotR * 2 + 5
          const achMaxW = titleMaxW - (achX - titleX)
          const achLH = px(10.5) * 1.5
          my = drawWrapped(page, ach.text, achX, my, achMaxW, sansR, px(10.5), TEXT_MAIN, achLH, minY)
          my -= Math.round(4 * S) // gap between achievements
        }
      }

      my -= Math.round(20 * S) // gap between experiences
    }
    my -= Math.round(4 * S)
  }

  // ── Education (2-column grid) ───────────────────────────────────────────
  if (data.education.length > 0) {
    my = mainHeading(data.lang === 'zh' ? '教育背景' : 'Academic Background', my)

    const eduGap = Math.round(12 * S) // gap between cards
    const eduColW = Math.floor((MAIN_W - eduGap) / 2)
    const eduPadT = Math.round(12 * S)
    const eduPadX = Math.round(14 * S)

    for (let i = 0; i < data.education.length; i += 2) {
      if (my < minY + 40) break

      // Calculate card height (use max of pair)
      const cardH = eduPadT * 2 + px(8) + 3 + px(11) + 2 + px(9.5) + 5 + px(8) + 4

      for (let col = 0; col < 2 && i + col < data.education.length; col++) {
        const edu = data.education[i + col]
        const isFirst = (i + col) === 0
        const cx = MAIN_X + col * (eduColW + eduGap)

        // Card background — HTML: bg surface, border, bottom border accent/gray
        page.drawRectangle({
          x: cx, y: my - cardH,
          width: eduColW, height: cardH,
          color: SURFACE, borderColor: BORDER, borderWidth: 0.5,
        })
        // Bottom accent border — HTML: borderBottom 2px solid accent/gray30
        page.drawRectangle({
          x: cx, y: my - cardH,
          width: eduColW, height: Math.round(2 * S),
          color: isFirst ? ACCENT : TEXT_MUTED,
          opacity: isFirst ? 1 : 0.3,
        })

        let ey = my - eduPadT

        // Degree — HTML: 8px, 700, uppercase, accent
        if (edu.degree) {
          page.drawText(edu.degree.toUpperCase(), {
            x: cx + eduPadX, y: ey - px(8), size: px(8), font: sansB, color: ACCENT,
          })
          ey -= px(8) + 3
        }

        // Major / School — HTML: 700, 11px, textBright
        const majorText = edu.major || edu.school
        if (majorText) {
          page.drawText(majorText, {
            x: cx + eduPadX, y: ey - px(11), size: px(11), font: sansB, color: TEXT_BRIGHT,
          })
          ey -= px(11) + 2
        }

        // School (if major was shown) — HTML: 9.5px, textMain
        if (edu.major && edu.school) {
          page.drawText(edu.school, {
            x: cx + eduPadX, y: ey - px(9.5), size: px(9.5), font: sansR, color: TEXT_MAIN,
          })
          ey -= px(9.5) + 5
        }

        // GPA + Year — HTML: monospace, 8px, #94a3b8
        const gpaRankParts: string[] = []
        if (edu.gpa_score) gpaRankParts.push(`GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}`)
        const yearText = [edu.start_year, edu.end_year].filter(Boolean).join('–')
        const bottomLine = [...gpaRankParts.map(p => p), yearText].filter(Boolean).join(' • ')
        if (bottomLine) {
          // GPA part in accent, rest in muted
          if (gpaRankParts.length > 0) {
            const gpaStr = gpaRankParts.join(' · ')
            page.drawText(gpaStr, {
              x: cx + eduPadX, y: ey - px(8), size: px(8), font: monoR, color: ACCENT,
            })
            if (yearText) {
              const gpaW = monoR.widthOfTextAtSize(gpaStr + ' • ', px(8))
              page.drawText(yearText, {
                x: cx + eduPadX + gpaW, y: ey - px(8), size: px(8), font: monoR, color: MUTED_LIGHT,
              })
            }
          } else if (yearText) {
            page.drawText(yearText, {
              x: cx + eduPadX, y: ey - px(8), size: px(8), font: monoR, color: MUTED_LIGHT,
            })
          }
        }
      }

      my -= cardH + eduGap
    }
    my -= Math.round(4 * S)
  }

  // ── Publications ────────────────────────────────────────────────────────
  const pubs = data.publications?.filter(p => p.title) ?? []
  if (pubs.length > 0) {
    my = mainHeading(data.lang === 'zh' ? '学术成果' : 'Publications & Research', my)

    for (const pub of pubs) {
      if (my < minY + 10) break

      // Marker — HTML: material icon "description", 13px, accent
      page.drawText('›', {
        x: MAIN_X, y: my - px(9.5), size: px(13), font: serifB, color: ACCENT,
      })

      // Title — HTML: 9.5px, 700, textBright
      const pubTitleX = MAIN_X + Math.round(13 * S) + Math.round(10 * S)
      const pubMaxW = MAIN_W - (pubTitleX - MAIN_X)
      const titleStr = pub.title.length > 80 ? pub.title.slice(0, 77) + '...' : pub.title
      my = drawWrapped(page, titleStr, pubTitleX, my, pubMaxW, sansB, px(9.5), TEXT_BRIGHT, px(9.5) + 2, minY)

      // Venue + year — HTML: 8.5px, italic, textMain
      if (pub.publication_venue) {
        const venueText = `${pub.publication_venue}${pub.pub_year ? `, ${pub.pub_year}` : ''}`
        page.drawText(venueText, {
          x: pubTitleX, y: my - px(8.5), size: px(8.5), font: sansR, color: TEXT_MAIN,
        })
        my -= px(8.5) + 2
      }

      my -= Math.round(6 * S)
    }
  }

  // ═══ FOOTER ════════════════════════════════════════════════════════════════
  // HTML: borderTop 1px border, padding 10px 36px, monospace 8px, textMain 25%
  const ftrY = MX + Math.round(10 * S) + px(8)
  page.drawLine({
    start: { x: MX, y: ftrY + Math.round(10 * S) },
    end: { x: PW - MX, y: ftrY + Math.round(10 * S) },
    thickness: 0.5, color: BORDER,
  })
  const ftrText = 'CareerFlow · Professional Portfolio System · 2024'
  const ftrW = monoR.widthOfTextAtSize(ftrText, px(8))
  page.drawText(ftrText, {
    x: (PW - ftrW) / 2, y: MX + Math.round(10 * S),
    size: px(8), font: monoR, color: TEXT_MUTED, opacity: 0.4,
  })

  // ── Generate ───────────────────────────────────────────────────────────
  const bytes = await doc.save()
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
}
