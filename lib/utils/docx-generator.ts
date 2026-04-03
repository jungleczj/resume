import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import type { WorkExperience } from '../types/domain'

export async function generateDOCX(data: {
  name: string
  contact: { email: string; phone: string; linkedin?: string }
  experiences: WorkExperience[]
  lang: 'zh' | 'en'
}): Promise<Blob> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: data.name,
          heading: HeadingLevel.HEADING_1
        }),
        new Paragraph({
          children: [
            new TextRun(`${data.contact.email} | ${data.contact.phone}`)
          ]
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: data.lang === 'zh' ? '工作经历' : 'Work Experience',
          heading: HeadingLevel.HEADING_2
        }),
        ...data.experiences.flatMap(exp => [
          new Paragraph({
            children: [
              new TextRun({ text: `${exp.company} - ${exp.job_title}`, bold: true })
            ]
          }),
          ...(exp.achievements?.filter(a => a.status === 'confirmed') || []).map(
            ach => new Paragraph({ text: `• ${ach.text}`, spacing: { before: 100 } })
          )
        ])
      ]
    }]
  })

  return await Packer.toBlob(doc)
}
