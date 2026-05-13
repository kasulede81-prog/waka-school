import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

type Row = Record<string, string | number | null | undefined>

export async function exportInstitutionalPdf(options: {
  filename: string
  title: string
  subtitle?: string
  schoolName?: string
  verificationCode?: string
  columns: string[]
  rows: Row[]
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const margin = 48
  let y = margin

  doc.setFontSize(10)
  doc.setTextColor(80, 120, 90)
  if (options.schoolName) {
    doc.text(options.schoolName, margin, y)
    y += 16
  }
  doc.setFontSize(16)
  doc.setTextColor(20, 30, 40)
  doc.text(options.title, margin, y)
  y += 22
  if (options.subtitle) {
    doc.setFontSize(10)
    doc.setTextColor(80, 90, 100)
    doc.text(options.subtitle, margin, y)
    y += 18
  }
  if (options.verificationCode) {
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Verification: ${options.verificationCode}`, margin, y)
    y += 14
  }

  const body = options.rows.map((row) => options.columns.map((c) => String(row[c] ?? '')))
  autoTable(doc, {
    startY: y + 8,
    head: [options.columns],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [16, 100, 70] },
  })

  doc.save(options.filename)
}
