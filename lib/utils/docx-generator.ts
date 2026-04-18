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

// Color constants (hex without #)
const INDIGO = '4f46e5'
const DARK = '111827'
const MID = '4b5563'
const LIGHT = '9ca3af'

// Section heading paragraph with bottom border
function sectionHeading(label: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: label,
        bold: true,
        size: 16,   // half-points = 8pt
        color: INDIGO,
        allCaps: true,
      })
    ],
    spacing: { before: 200, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: INDIGO, space: 1 }
    }
  })
}

// Contact row separator
function dot(): TextRun {
  return new TextRun({ text: '  ·  ', color: LIGHT, size: 18 })
}

export async function generateDOCX(data: DOCXData): Promise<Blob> {
  const sectionLabel = (zh: string, en: string) =>
    data.lang === 'zh' ? zh : en

  const contactParts = [
    data.contact.email,
    data.contact.phone,
    data.contact.location,
    data.contact.linkedin,
    data.contact.website,
  ].filter(Boolean) as string[]

  const contactChildren: TextRun[] = []
  contactParts.forEach((part, i) => {
    contactChildren.push(new TextRun({ text: part, size: 18, color: MID }))
    if (i < contactParts.length - 1) contactChildren.push(dot())
  })

  // ── Photo fetch (optional) ─────────────────────────────────────────────
  let photoImageBytes: ArrayBuffer | null = null
  if (data.showPhoto && data.photoUrl) {
    try {
      const res = await fetch(data.photoUrl)
      if (res.ok) {
        photoImageBytes = await res.arrayBuffer()
      }
    } catch {
      // Photo fetch failed — skip
    }
  }

  // ── Header: name + contact (left) + photo (right) ──────────────────────
  const headerChildren: Paragraph[] = []

  if (photoImageBytes) {
    // Use a table: left cell = name/contact, right cell = photo
    const nameContactCell = new TableCell({
      children: [
        new Paragraph({
          children: [new TextRun({ text: data.name || 'Candidate', bold: true, size: 44, color: DARK })],
          spacing: { after: 60 }
        }),
        ...(contactChildren.length
          ? [new Paragraph({ children: contactChildren, spacing: { after: 60 } })]
          : []),
        ...(data.summary
          ? [new Paragraph({ children: [new TextRun({ text: data.summary, size: 19, color: MID })], spacing: { after: 60 } })]
          : [])
      ],
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
      },
      width: { size: 80, type: WidthType.PERCENTAGE }
    })

    const photoCell = new TableCell({
      children: [
        new Paragraph({
          children: [
            new ImageRun({
              data: photoImageBytes,
              transformation: { width: 72, height: 88 }
            })
          ],
          alignment: AlignmentType.RIGHT
        })
      ],
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
      },
      width: { size: 20, type: WidthType.PERCENTAGE }
    })

    headerChildren.push(
      new Paragraph({ children: [] }) // spacer handled by table
    )
    // We'll add the table to the document sections directly
    const headerTable = new Table({
      rows: [new TableRow({ children: [nameContactCell, photoCell] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }
      }
    })

    const confirmedExps = data.experiences
      .map(exp => ({
        ...exp,
        achievements: (exp.achievements ?? []).filter(a => a.status === 'confirmed')
      }))
      .filter(exp => exp.achievements.length > 0)

    const doc = buildDocument(data, sectionLabel, confirmedExps, headerTable, contactChildren)
    return await Packer.toBlob(doc)
  }

  // No photo — simple header paragraphs
  const confirmedExps = data.experiences
    .map(exp => ({
      ...exp,
      achievements: (exp.achievements ?? []).filter(a => a.status === 'confirmed')
    }))
    .filter(exp => exp.achievements.length > 0)

  const doc = buildDocument(data, sectionLabel, confirmedExps, null, contactChildren)
  return await Packer.toBlob(doc)
}

type ExperienceWithFiltered = WorkExperience & { achievements: NonNullable<WorkExperience['achievements']> }

function buildDocument(
  data: DOCXData,
  sectionLabel: (zh: string, en: string) => string,
  confirmedExps: ExperienceWithFiltered[],
  headerTable: Table | null,
  contactChildren: TextRun[]
): Document {
  const headerParagraphs: Paragraph[] = headerTable ? [] : [
    new Paragraph({
      children: [new TextRun({ text: data.name || 'Candidate', bold: true, size: 44, color: DARK })],
      spacing: { after: 60 }
    }),
    ...(contactChildren.length
      ? [new Paragraph({ children: contactChildren, spacing: { after: 60 } })]
      : []),
    ...(data.summary
      ? [new Paragraph({ children: [new TextRun({ text: data.summary, size: 19, color: '4b5563' })], spacing: { after: 80 } })]
      : [])
  ]

  // ── Education paragraphs ──────────────────────────────────────────────
  const eduParagraphs: (Paragraph)[] = data.education.length > 0 ? [
    sectionHeading(sectionLabel('教育背景', 'Education')),
    ...data.education.flatMap(edu => {
      const yearText = [edu.start_year, edu.end_year].filter(Boolean).join(' – ')
      const degreeText = [edu.degree, edu.major].filter(Boolean).join(' ')
      const extras: string[] = []
      if (edu.gpa_score) extras.push(`GPA ${edu.gpa_score}${edu.gpa_scale ? `/${edu.gpa_scale}` : ''}`)
      if (edu.class_rank_text) extras.push(edu.class_rank_text)
      if (edu.academic_honors) extras.push(edu.academic_honors)

      const rows: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({ text: edu.school, bold: true, size: 22, color: DARK }),
            ...(degreeText ? [
              new TextRun({ text: '  ', size: 22 }),
              new TextRun({ text: degreeText, size: 20, color: '6b7280' })
            ] : []),
            ...(yearText ? [
              new TextRun({ text: '\t' + yearText, size: 18, color: LIGHT })
            ] : [])
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 40 }
        })
      ]
      if (extras.length) {
        rows.push(new Paragraph({
          children: [new TextRun({ text: extras.join('  ·  '), size: 18, color: LIGHT })],
          spacing: { after: 100 }
        }))
      } else {
        rows.push(new Paragraph({ children: [], spacing: { after: 80 } }))
      }
      return rows
    })
  ] : []

  // ── Work experience paragraphs ────────────────────────────────────────
  const expParagraphs: Paragraph[] = confirmedExps.length > 0 ? [
    sectionHeading(sectionLabel('工作经历', 'Work Experience')),
    ...confirmedExps.flatMap(exp => {
      const dateStr = exp.original_tenure ?? (() => {
        const sy = exp.start_date ? new Date(exp.start_date).getFullYear() : null
        const ey = exp.end_date ? new Date(exp.end_date).getFullYear() : null
        const el = exp.is_current ? (data.lang === 'zh' ? '至今' : 'Present') : ey ? String(ey) : ''
        return sy ? `${sy}${el ? ` – ${el}` : ''}` : el
      })()

      // Group achievements by project
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

      return [
        new Paragraph({
          children: [
            new TextRun({ text: exp.company, bold: true, size: 22, color: DARK }),
            ...(exp.job_title ? [
              new TextRun({ text: '  ·  ', size: 20, color: LIGHT }),
              new TextRun({ text: exp.job_title, size: 20, color: MID })
            ] : []),
            ...(dateStr ? [
              new TextRun({ text: '\t' + dateStr, size: 18, color: LIGHT })
            ] : [])
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: 60 }
        }),
        ...groups.flatMap(group => [
          ...(group.projectName ? [
            new Paragraph({
              children: [new TextRun({ text: `▸ ${group.projectName}`, size: 19, color: INDIGO, bold: true })],
              spacing: { before: 80, after: 40 }
            })
          ] : []),
          ...group.items.map(ach =>
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: ach.text, size: 19, color: '374151' })],
              spacing: { after: 30 }
            })
          )
        ]),
        new Paragraph({ children: [], spacing: { after: 120 } })
      ]
    })
  ] : []

  // ── Skills paragraphs ────────────────────────────────────────────────
  const skillsParagraphs: Paragraph[] = data.skills.length > 0 ? [
    sectionHeading(sectionLabel('技能与证书', 'Skills & Certifications')),
    ...data.skills.map(group =>
      new Paragraph({
        children: [
          new TextRun({ text: `${group.category}: `, bold: true, size: 19, color: DARK }),
          new TextRun({ text: group.items.join(' · '), size: 19, color: MID })
        ],
        spacing: { after: 60 }
      })
    )
  ] : []

  // ── Certifications ──────────────────────────────────────────────────────
  const PROF_LABELS: Record<string, string> = {
    native_bilingual: data.lang === 'zh' ? '母语 / 双语' : 'Native / Bilingual',
    full_professional: data.lang === 'zh' ? '完全专业能力' : 'Full Professional',
    professional_working: data.lang === 'zh' ? '专业工作能力' : 'Professional Working',
    limited_working: data.lang === 'zh' ? '有限工作能力' : 'Limited Working',
    elementary: data.lang === 'zh' ? '初级' : 'Elementary',
  }

  const certs = (data.certifications ?? []).filter(c => c.name)
  const certParagraphs: Paragraph[] = certs.length > 0 ? [
    sectionHeading(sectionLabel('证书', 'Certifications')),
    ...certs.map(cert => {
      const orgText = cert.issuing_org ? `  ·  ${cert.issuing_org}` : ''
      const yearText = cert.issue_year ? String(cert.issue_year) : ''
      return new Paragraph({
        children: [
          new TextRun({ text: cert.name + orgText, size: 19, color: DARK }),
          ...(yearText ? [new TextRun({ text: '\t' + yearText, size: 18, color: LIGHT })] : [])
        ],
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { after: 60 }
      })
    })
  ] : []

  // ── Spoken Languages ─────────────────────────────────────────────────────
  const langs = (data.spokenLanguages ?? []).filter(l => l.language_name)
  const langParagraphs: Paragraph[] = langs.length > 0 ? [
    sectionHeading(sectionLabel('语言能力', 'Languages')),
    new Paragraph({
      children: langs.flatMap((l, i) => [
        new TextRun({ text: l.language_name, bold: true, size: 19, color: DARK }),
        new TextRun({ text: ` (${PROF_LABELS[l.proficiency] ?? l.proficiency})`, size: 18, color: MID }),
        ...(i < langs.length - 1 ? [new TextRun({ text: '   ·   ', size: 18, color: LIGHT })] : [])
      ]),
      spacing: { after: 100 }
    })
  ] : []

  // ── Awards & Honors ───────────────────────────────────────────────────────
  const awards = (data.awards ?? []).filter(a => a.title)
  const awardParagraphs: Paragraph[] = awards.length > 0 ? [
    sectionHeading(sectionLabel('荣誉奖项', 'Awards & Honors')),
    ...awards.flatMap(award => {
      const orgText = award.issuing_org ? `  ·  ${award.issuing_org}` : ''
      const yearText = award.award_year ? String(award.award_year) : ''
      return [
        new Paragraph({
          children: [
            new TextRun({ text: award.title + orgText, size: 19, color: DARK }),
            ...(yearText ? [new TextRun({ text: '\t' + yearText, size: 18, color: LIGHT })] : [])
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: award.description ? 30 : 80 }
        }),
        ...(award.description ? [
          new Paragraph({
            children: [new TextRun({ text: award.description, size: 18, color: MID })],
            spacing: { after: 80 }
          })
        ] : [])
      ]
    })
  ] : []

  // ── Publications ──────────────────────────────────────────────────────────
  const pubs = (data.publications ?? []).filter(p => p.title)
  const pubParagraphs: Paragraph[] = pubs.length > 0 ? [
    sectionHeading(sectionLabel('论文出版', 'Publications')),
    ...pubs.flatMap(pub => {
      const venueText = pub.publication_venue ? `  ·  ${pub.publication_venue}` : ''
      const yearText = pub.pub_year ? String(pub.pub_year) : ''
      const authLine = pub.authors?.length
        ? pub.authors.slice(0, 5).join(', ') + (pub.authors.length > 5 ? ', et al.' : '')
        : null
      return [
        new Paragraph({
          children: [
            new TextRun({ text: pub.title + venueText, size: 19, color: DARK }),
            ...(yearText ? [new TextRun({ text: '\t' + yearText, size: 18, color: LIGHT })] : [])
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          spacing: { after: authLine ? 30 : 80 }
        }),
        ...(authLine ? [
          new Paragraph({
            children: [new TextRun({ text: authLine, size: 18, color: MID })],
            spacing: { after: 80 }
          })
        ] : [])
      ]
    })
  ] : []

  const allChildren: (Paragraph | Table)[] = [
    ...(headerTable ? [headerTable] : headerParagraphs),
    ...eduParagraphs,
    ...expParagraphs,
    ...skillsParagraphs,
    ...certParagraphs,
    ...langParagraphs,
    ...awardParagraphs,
    ...pubParagraphs,
  ]

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: data.lang === 'zh' ? 'SimHei' : 'Calibri', size: 20 }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 540, right: 540, bottom: 540, left: 540 } // 540 twips = 0.375in = 36px@96dpi
        }
      },
      children: allChildren
    }]
  })
}
