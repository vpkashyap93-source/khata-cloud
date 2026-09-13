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

// Reverses the quoting toCsv applies - handles fields with commas, quotes,
// or newlines inside them, and strips a leading UTF-8 BOM (added by
// downloadCsv, and by Excel's own CSV exports). Returns an array of row
// arrays; parseCsvObjects below is what callers normally want.
export const parseCsv = (text) => {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => { pushField(); rows.push(row); row = [] }
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1 } else { inQuotes = false }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushField()
    } else if (ch === '\r') {
      // skip - the \n that follows (or ends the file) closes the row
    } else if (ch === '\n') {
      pushRow()
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) pushRow()
  return rows.filter((cells) => cells.length > 1 || cells[0] !== '')
}

// Parses CSV text with a header row into objects keyed by the (trimmed,
// lowercased) header name, so "Name", "name " and "NAME" all import the
// same way regardless of how the source spreadsheet wrote them.
export const parseCsvObjects = (text) => {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const headers = rows[0].map((header) => header.trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const record = {}
    headers.forEach((header, index) => { record[header] = (row[index] ?? '').trim() })
    return record
  })
}

// Same client-side download, for a full JSON data backup instead of one
// CSV table - the business's own copy of its data, readable independently
// of this app or Firebase.
export const downloadJson = (filename, data) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
