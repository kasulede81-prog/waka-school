import * as XLSX from 'xlsx'

type Row = Record<string, string | number | boolean | null | undefined>

export function exportToCsv(filename: string, rows: Row[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? ''
          const escaped = String(value).replace(/"/g, '""')
          return `"${escaped}"`
        })
        .join(','),
    ),
  ]
  downloadBlob(filename, new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' }))
}

export function exportToXlsx(filename: string, rows: Row[]) {
  if (!rows.length) return
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data')
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  downloadBlob(filename, new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
}

export function printRows(title: string, rows: Row[]) {
  const headers = rows.length ? Object.keys(rows[0]) : []
  const html = `
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
        h1 { font-size: 16px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <table>
        <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map((row) => `<tr>${headers.map((h) => `<td>${String(row[h] ?? '')}</td>`).join('')}</tr>`)
            .join('')}
        </tbody>
      </table>
    </body>
    </html>
  `
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function downloadBlob(filename: string, blob: Blob) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

