import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopPosition,
  TabStopType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  ShadingType,
  convertMillimetersToTwip,
} from 'docx'
import type { WorkExperience, ResumeEducation, ResumeSkillGroup, Certification, SpokenLanguage, Award, Publication } from '../types/domain'

interface DOCXData {
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

// ── Cobalt palette (matches ResumePreview.tsx exactly) ───────────────────────
const ACCENT      = '2563eb'
const TEXT_BRIGHT  = '0f172a'
const TEXT_MAIN    = '334155'
const TEXT_MUTED   = '64748b'
const MUTED_LIGHT  = '94a3b8'
const SURFACE      = 'f8fafc'
const BORDER_COLOR = 'e2e8f0'

// ── Font helpers ─────────────────────────────────────────────────────────────
// DOCX sizes are in half-points (1 pt = 2 half-points)
// HTML preview px → DOCX half-points: px * 0.75 * 2 = px * 1.5
const hp = (px: number) => Math.round(px * 1.5)

// ── No-border preset (reused for table cells) ───────────────────────────────
const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const CELL_BORDERS = {
  top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER,
}

// ── Proficiency labels ───────────────────────────────────────────────────────
const PROF_LABELS: Record<string, { zh: string; en: string }> = {
  elementary:            { zh: '初级',     en: 'Elementary' },
  limited_working:       { zh: '日常沟通', en: 'Limited Working' },
  professional_working:  { zh: '工作交流', en: 'Professional' },
  full_professional:     { zh: '流利',     en: 'Full Professional' },
  native_bilingual:      { zh: '母语',     en: 'Native' },
}

// ── Sidebar section heading (left accent bar effect via paragraph border) ────
function sidebarHeading(label: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: label.toUpperCase(),
        bold: true,
        size: hp(11), // 11px in preview
        color: TEXT_BRIGHT,
        font: 'Georgia', // closest standard serif to Noto Serif
      }),
    ],
    spacing: { before: 200, after: 80 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 },
    },
  })
}

// ── Main section heading (text + horizontal rule) ────────────────────────────
function mainHeading(label: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: label,
        bold: true,
        size: hp(15), // 15px in preview
        color: TEXT_BRIGHT,
        font: 'Georgia',
      }),
    ],
    spacing: { before: 200, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR, space: 4 },
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
export async function generateDOCX(data: DOCXData): Promise<Blob> {
  const lbl = (zh: string, en: string) => data.lang === 'zh' ? zh : en
  const fontFamily = data.lang === 'zh' ? 'SimHei' : 'Calibri'
  const serifFont  = data.lang === 'zh' ? 'SimHei' : 'Georgia'

  // ── Filter confirmed experiences ───────────────────────────────────────
  const confirmedExps = data.experiences
    .map(exp => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter(a => a.status === 'confirmed'),
    }))
    .filter(exp => exp.achievements.length > 0)

  // ── Fetch photo ────────────────────────────────────────────────────────
  let photoBytes: ArrayBuffer | null = null
  if (data.showPhoto && data.photoUrl) {
    try {
      const res = await fetch(data.photoUrl)
      if (res.ok) photoBytes = await res.arrayBuffer()
    } catch { /* skip */ }
  }

  // ═══ BUILD LEFT SIDEBAR CONTENT ════════════════════════════════════════
  const leftChildren: Paragraph[] = []

  // Photo
  if (photoBytes) {
    leftChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: photoBytes,
            transformation: { width: 60, height: 72 }, // 80×96 px × 0.75
          }),
        ],
        spacing: { after: 120 },
      }),
    )
  }

  // Name — HTML: Noto Serif 700, 18px, accent
  leftChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.name || (data.lang === 'zh' ? '候选人' : 'Candidate'),
          bold: true,
          size: hp(18),
          color: ACCENT,
          font: serifFont,
        }),
      ],
      spacing: { after: 40 },
    }),
  )

  // Job title
  const firstTitle = confirmedExps[0]?.job_title
  if (firstTitle) {
    leftChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: firstTitle.toUpperCase(),
            bold: true,
            size: hp(9),
            color: TEXT_MAIN,
            allCaps: true,
          }),
        ],
        spacing: { after: 80 },
      }),
    )
  }

  // Contact info — HTML: 10px, textMain with opacity
  const contactParts = [
    data.contact.email, data.contact.phone, data.contact.location,
    data.contact.linkedin, data.contact.website,
  ].filter(Boolean) as string[]

  for (const c of contactParts) {
    leftChildren.push(
      new Paragraph({
        children: [new TextRun({ text: c, size: hp(10), color: TEXT_MUTED })],
        spacing: { after: 30 },
      }),
    )
  }
  if (contactParts.length > 0) {
    leftChildren.push(new Paragraph({ children: [], spacing: { after: 80 } }))
  }

  // Skills — HTML: sidebar heading + category + pill tags
  if (data.skills.length > 0) {
    leftChildren.push(sidebarHeading(lbl('核心技能', 'Core Skills')))

    for (const group of data.skills) {
      // Category label
      leftChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: group.category.toUpperCase() + ':',
              bold: true,
              size: hp(8),
              color: ACCENT,
            }),
          ],
          spacing: { before: 60, after: 30 },
        }),
      )
      // Skill items inline
      const skillRuns: TextRun[] = []
      group.items.forEach((item, i) => {
        skillRuns.push(
          new TextRun({
            text: item,
            size: hp(9),
            color: TEXT_MAIN,
            shading: { type: ShadingType.CLEAR, fill: SURFACE },
          }),
        )
        if (i < group.items.length - 1) {
          skillRuns.push(new TextRun({ text: '  ·  ', size: hp(9), color: MUTED_LIGHT }))
        }
      })
      leftChildren.push(
        new Paragraph({ children: skillRuns, spacing: { after: 60 } }),
      )
    }
    leftChildren.push(new Paragraph({ children: [], spacing: { after: 40 } }))
  }

  // Certifications + Awards
  const certAward = [
    ...(data.certifications?.filter(c => c.name) ?? []).map(c => ({
      title: c.name,
      sub: c.issuing_org
        ? `${c.issuing_org}${c.issue_year ? ' · ' + c.issue_year : ''}`
        : c.issue_year ? String(c.issue_year) : '',
    })),
    ...(data.awards?.filter(a => a.title) ?? []).map(a => ({
      title: a.title,
      sub: a.issuing_org
        ? `${a.issuing_org}${a.award_year ? ' · ' + a.award_year : ''}`
        : a.award_year ? String(a.award_year) : '',
    })),
  ]
  if (certAward.length > 0) {
    leftChildren.push(sidebarHeading(lbl('证书与荣誉', 'Awards & Certs')))
    for (const item of certAward) {
      leftChildren.push(
        new Paragraph({
          children: [new TextRun({ text: item.title, bold: true, size: hp(9), color: TEXT_BRIGHT })],
          spacing: { after: item.sub ? 10 : 60 },
          shading: { type: ShadingType.CLEAR, fill: SURFACE },
        }),
      )
      if (item.sub) {
        leftChildren.push(
          new Paragraph({
            children: [new TextRun({ text: item.sub, size: hp(8), color: MUTED_LIGHT })],
            spacing: { after: 60 },
          }),
        )
      }
    }
    leftChildren.push(new Paragraph({ children: [], spacing: { after: 40 } }))
  }

  // Languages
  const langs = (data.spokenLanguages ?? []).filter(l => l.language_name)
  if (langs.length > 0) {
    leftChildren.push(sidebarHeading(lbl('语言能力', 'Languages')))
    for (const l of langs) {
      const prof = l.is_native
        ? (data.lang === 'zh' ? '母语' : 'Native')
        : PROF_LABELS[l.proficiency]
          ? (data.lang === 'zh' ? PROF_LABELS[l.proficiency].zh : PROF_LABELS[l.proficiency].en)
          : l.proficiency.replace(/_/g, ' ')
      leftChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: l.language_name, bold: true, size: hp(9), color: TEXT_BRIGHT }),
            new TextRun({ text: `  (${prof})`, size: hp(9), color: TEXT_MUTED }),
          ],
          spacing: { after: 40 },
          shading: { type: ShadingType.CLEAR, fill: SURFACE },
        }),
      )
    }
  }

  // ═══ BUILD RIGHT MAIN CONTENT ══════════════════════════════════════════
  const rightChildren: (Paragraph | Table)[] = []

  // Executive Summary — HTML: card with left accent bar
  if (data.summary) {
    rightChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: lbl('个人简介', 'Executive Summary'),
            bold: true,
            size: hp(13),
            color: TEXT_BRIGHT,
            font: serifFont,
          }),
        ],
        spacing: { before: 0, after: 60 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 },
        },
        shading: { type: ShadingType.CLEAR, fill: SURFACE },
      }),
    )
    rightChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: data.summary,
            size: hp(10.5),
            color: TEXT_MAIN,
          }),
        ],
        spacing: { after: 160 },
        border: {
          left: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 6 },
        },
        shading: { type: ShadingType.CLEAR, fill: SURFACE },
      }),
    )
  }

  // Work Experience
  if (confirmedExps.length > 0) {
    rightChildren.push(mainHeading(lbl('工作经历', 'Professional Experience')))

    for (const exp of confirmedExps) {
      const dateStr = exp.original_tenure ?? (() => {
        const sy = exp.start_date ? new Date(exp.start_date).getFullYear() : null
        const ey = exp.end_date ? new Date(exp.end_date).getFullYear() : null
        const el = exp.is_current ? (data.lang === 'zh' ? '至今' : 'Present') : ey ? String(ey) : ''
        return sy ? `${sy}${el ? ` – ${el}` : ''}` : el
      })()

      // Job title
      rightChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: exp.job_title || '', bold: true, size: hp(12), color: TEXT_BRIGHT }),
          ],
          spacing: { before: 60, after: 20 },
        }),
      )

      // Company + date
      rightChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: (exp.company || '').toUpperCase(), bold: true, size: hp(10), color: ACCENT }),
            ...(dateStr ? [
              new TextRun({ text: '\t' + dateStr, size: hp(8), color: MUTED_LIGHT, font: 'Courier New' }),
            ] : []),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 60 },
        }),
      )

      // Achievement bullets (grouped by project)
      type ProjectGroup = { projectName: string | null; items: typeof exp.achievements }
      const groups: ProjectGroup[] = []
      for (const a of exp.achievements) {
        const last = groups[groups.length - 1]
        if (last && last.projectName === (a.project_name ?? null)) last.items.push(a)
        else groups.push({ projectName: a.project_name ?? null, items: [a] })
      }

      for (const group of groups) {
        if (group.projectName) {
          rightChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `▸ ${group.projectName}`, size: hp(10), color: ACCENT, bold: true }),
              ],
              spacing: { before: 60, after: 30 },
            }),
          )
        }
        for (const ach of group.items) {
          // Tier color dot prefix
          const tierChar = ach.tier === 1 ? '●' : ach.tier === 2 ? '●' : '●'
          const tierColor = ach.tier === 1 ? '10b981' : ach.tier === 2 ? 'f59e0b' : 'f87171'

          rightChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: '/ ', bold: true, size: hp(11), color: ACCENT }),
                new TextRun({ text: tierChar + ' ', size: hp(7), color: tierColor }),
                new TextRun({ text: ach.text, size: hp(10.5), color: TEXT_MAIN }),
              ],
              spacing: { after: 30 },
              indent: { left: convertMillimetersToTwip(2) },
            }),
          )
        }
      }

      rightChildren.push(new Paragraph({ children: [], spacing: { after: 100 } }))
    }
  }

  // Education (2-column via nested table)
  if (data.education.length > 0) {
    rightChildren.push(mainHeading(lbl('教育背景', 'Academic Background')))

    // Build education rows (2 per row)
    for (let i = 0; i < data.education.length; i += 2) {
      const cells: TableCell[] = []

      for (let col = 0; col < 2; col++) {
        const edu = data.education[i + col]
        if (!edu) {
          // Empty cell for odd count
          cells.push(
            new TableCell({
              children: [new Paragraph({ children: [] })],
              width: { size: 50, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS,
            }),
          )
          continue
        }

        const isFirst = (i + col) === 0
        const gpaRankParts: string[] = []
        if (edu.gpa_score) gpaRankParts.push(`GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}`)
        const yearText = [edu.start_year, edu.end_year].filter(Boolean).join('–')

        const cellParagraphs: Paragraph[] = []

        // Degree
        if (edu.degree) {
          cellParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({ text: edu.degree.toUpperCase(), bold: true, size: hp(8), color: ACCENT }),
              ],
              spacing: { after: 20 },
            }),
          )
        }

        // Major / School
        cellParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({ text: edu.major || edu.school, bold: true, size: hp(11), color: TEXT_BRIGHT }),
            ],
            spacing: { after: 20 },
          }),
        )
        if (edu.major && edu.school) {
          cellParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: edu.school, size: hp(9.5), color: TEXT_MAIN })],
              spacing: { after: 30 },
            }),
          )
        }

        // GPA + Year
        const bottomParts: TextRun[] = []
        if (gpaRankParts.length > 0) {
          bottomParts.push(new TextRun({ text: gpaRankParts.join(' · '), size: hp(8), color: ACCENT, font: 'Courier New' }))
          if (yearText) bottomParts.push(new TextRun({ text: ' • ', size: hp(8), color: MUTED_LIGHT }))
        }
        if (yearText) {
          bottomParts.push(new TextRun({ text: yearText, size: hp(8), color: MUTED_LIGHT, font: 'Courier New' }))
        }
        if (bottomParts.length > 0) {
          cellParagraphs.push(new Paragraph({ children: bottomParts, spacing: { after: 20 } }))
        }

        cells.push(
          new TableCell({
            children: cellParagraphs,
            width: { size: 50, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: SURFACE },
            borders: {
              top: NONE_BORDER,
              left: NONE_BORDER,
              right: NONE_BORDER,
              bottom: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: isFirst ? ACCENT : MUTED_LIGHT,
                space: 0,
              },
            },
            margins: {
              top: convertMillimetersToTwip(2),
              bottom: convertMillimetersToTwip(2),
              left: convertMillimetersToTwip(3),
              right: convertMillimetersToTwip(3),
            },
          }),
        )
      }

      // Wrap the pair in a mini table (inside the right column)
      const eduRow = new Table({
        rows: [new TableRow({ children: cells })],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: NONE_BORDER, bottom: NONE_BORDER,
          left: NONE_BORDER, right: NONE_BORDER,
          insideHorizontal: NONE_BORDER,
          insideVertical: NONE_BORDER,
        },
      })
      rightChildren.push(eduRow)
      rightChildren.push(new Paragraph({ children: [], spacing: { after: 80 } }))
    }
  }

  // Publications
  const pubs = (data.publications ?? []).filter(p => p.title)
  if (pubs.length > 0) {
    rightChildren.push(mainHeading(lbl('学术成果', 'Publications & Research')))

    for (const pub of pubs) {
      const venueText = pub.publication_venue
        ? `${pub.publication_venue}${pub.pub_year ? `, ${pub.pub_year}` : ''}`
        : pub.pub_year ? String(pub.pub_year) : ''

      rightChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: '›  ', bold: true, size: hp(13), color: ACCENT }),
            new TextRun({ text: pub.title, bold: true, size: hp(9.5), color: TEXT_BRIGHT }),
          ],
          spacing: { after: venueText ? 10 : 60 },
        }),
      )
      if (venueText) {
        rightChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: '     ' + venueText, size: hp(8.5), color: TEXT_MAIN, italics: true }),
            ],
            spacing: { after: 60 },
          }),
        )
      }
    }
  }

  // ═══ ASSEMBLE TWO-COLUMN TABLE ═════════════════════════════════════════
  // HTML: sidebar 32%, main 68% (with 24px gap = paddingRight on sidebar)
  const sidebarCell = new TableCell({
    children: leftChildren,
    width: { size: 32, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    margins: {
      top: convertMillimetersToTwip(0),
      bottom: convertMillimetersToTwip(0),
      left: convertMillimetersToTwip(0),
      right: convertMillimetersToTwip(5), // ~18pt gap
    },
  })

  const mainCell = new TableCell({
    children: rightChildren.length > 0 ? rightChildren : [new Paragraph({ children: [] })],
    width: { size: 68, type: WidthType.PERCENTAGE },
    borders: CELL_BORDERS,
    margins: {
      top: convertMillimetersToTwip(0),
      bottom: convertMillimetersToTwip(0),
      left: convertMillimetersToTwip(0),
      right: convertMillimetersToTwip(0),
    },
  })

  const bodyTable = new Table({
    rows: [new TableRow({ children: [sidebarCell, mainCell] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: NONE_BORDER, bottom: NONE_BORDER,
      left: NONE_BORDER, right: NONE_BORDER,
      insideHorizontal: NONE_BORDER,
      insideVertical: NONE_BORDER,
    },
  })

  // ═══ HEADER (above table) ══════════════════════════════════════════════
  // HTML: name 13px Noto Serif 900 uppercase accent, + CV_2024 right, + 2px accent line
  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: (data.name || (data.lang === 'zh' ? '候选人' : 'Candidate')).toUpperCase(),
          bold: true,
          size: hp(13),
          color: ACCENT,
          font: serifFont,
          characterSpacing: 80, // letterSpacing 0.12em ≈ 80 twips
        }),
        new TextRun({
          text: '\tCV_2024',
          size: hp(9),
          color: MUTED_LIGHT,
          font: 'Courier New',
        }),
      ],
      tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
      spacing: { after: 80 },
    }),
    // Accent line
    new Paragraph({
      children: [],
      spacing: { after: 160 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 4 },
      },
    }),
  ]

  // ═══ FOOTER ════════════════════════════════════════════════════════════
  const footerParagraphs: Paragraph[] = [
    new Paragraph({
      children: [],
      spacing: { before: 120 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 2, color: BORDER_COLOR, space: 4 },
      },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'CareerFlow · Professional Portfolio System · 2024',
          size: hp(8),
          color: MUTED_LIGHT,
          font: 'Courier New',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40 },
    }),
  ]

  // ═══ BUILD DOCUMENT ════════════════════════════════════════════════════
  // Page margins: 36px at 96dpi → 0.375in → 540 twips (matching preview)
  const allChildren: (Paragraph | Table)[] = [
    ...headerParagraphs,
    bodyTable,
    ...footerParagraphs,
  ]

  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: fontFamily,
            size: hp(10), // default 10px body text
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 540,    // 0.375in = 36px at 96dpi
            right: 540,
            bottom: 540,
            left: 540,
          },
        },
      },
      children: allChildren,
    }],
  })

  return await Packer.toBlob(document)
}
