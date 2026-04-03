import jsPDF from 'jspdf'
import type { WorkExperience } from '../types/domain'

export async function generatePDF(data: {
  name: string
  contact: { email: string; phone: string; linkedin?: string }
  experiences: WorkExperience[]
  photoUrl?: string
  showPhoto: boolean
  lang: 'zh' | 'en'
}): Promise<Blob> {
  const doc = new jsPDF()
  let y = 20

  // Header
  doc.setFontSize(20)
  doc.text(data.name, 20, y)
  y += 10

  doc.setFontSize(10)
  doc.text(`${data.contact.email} | ${data.contact.phone}`, 20, y)
  y += 15

  // Work experiences
  doc.setFontSize(12)
  doc.text(data.lang === 'zh' ? '工作经历' : 'Work Experience', 20, y)
  y += 8

  for (const exp of data.experiences) {
    doc.setFontSize(11)
    doc.text(`${exp.company} - ${exp.job_title}`, 20, y)
    y += 6

    doc.setFontSize(9)
    const achievements = exp.achievements?.filter(a => a.status === 'confirmed') || []
    for (const ach of achievements) {
      const lines = doc.splitTextToSize(ach.text, 170)
      doc.text(`• ${lines[0]}`, 25, y)
      y += 5
      for (let i = 1; i < lines.length; i++) {
        doc.text(lines[i], 27, y)
        y += 5
      }
    }
    y += 5
  }

  return doc.output('blob')
}
