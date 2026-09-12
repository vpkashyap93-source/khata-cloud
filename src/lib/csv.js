// Quote a field only when it needs it (per RFC 4180) - keeps plain numbers
// and simple text readable in the raw file, while still handling commas,
// quotes, and newlines inside narrations/account names correctly.
const escapeCell = (value) => {
  const str = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export const toCsv = (rows) => rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

// Client-side download - no backend/export service needed. A BOM is
// prepended so Excel (which guesses encoding from the first bytes) opens
// the file as UTF-8 instead of mangling the rupee sign or names with
// accented characters.
export const downloadCsv = (filename, rows) => {
  const blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
