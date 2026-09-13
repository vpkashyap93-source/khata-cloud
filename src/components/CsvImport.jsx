import { useRef, useState } from 'react'
import { parseCsvObjects } from '../lib/csv.js'
import Icon from './icons.jsx'

// A generic "Import CSV" button: reads the picked file, parses it into
// header-keyed row objects, and hands them to the caller's onRows, which
// knows the expected columns, validates each row, and saves the good ones.
// onRows returns a one-line summary string, shown next to the button.
export default function CsvImport({ label = 'Import CSV', onRows }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState('')

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true)
    setSummary('')
    try {
      const text = await file.text()
      const rows = parseCsvObjects(text)
      setSummary(await onRows(rows))
    } catch (err) {
      setSummary(`Import failed - ${err.message}`)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <span className="journal-header-row" style={{ alignItems: 'center' }}>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button type="button" className="action-pill" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Icon name="upload" size={13} />{busy ? 'Importing...' : label}
      </button>
      {summary && <span className="section-sub">{summary}</span>}
    </span>
  )
}
