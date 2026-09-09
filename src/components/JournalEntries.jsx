import { useState } from 'react'
import { validateJournalLines, sumLines } from '../lib/accounting.js'
import { addOrgDoc } from '../firebase.js'

const today = () => new Date().toISOString().slice(0, 10)
const blankLine = () => ({ accountId: '', debit: '', credit: '' })

export default function JournalEntries({ orgId, accounts, entries }) {
  const [date, setDate] = useState(today())
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState([blankLine(), blankLine()])
  const [error, setError] = useState('')

  const updateLine = (index, field, value) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)))
  }

  const addLine = () => setLines((prev) => [...prev, blankLine()])
  const removeLine = (index) => setLines((prev) => prev.filter((_, i) => i !== index))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const result = validateJournalLines(lines)
    if (!result.valid) {
      setError(result.error)
      return
    }
    if (!narration.trim()) {
      setError('Add a narration describing this entry.')
      return
    }
    await addOrgDoc(orgId, 'journalEntries', {
      date,
      narration: narration.trim(),
      lines: result.lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
      })),
      source: 'manual',
    })
    setNarration('')
    setLines([blankLine(), blankLine()])
  }

  const accountName = (id) => accounts.find((account) => account.id === id)?.name || 'Unknown account'
  const totalDebit = sumLines(lines, 'debit')
  const totalCredit = sumLines(lines, 'credit')

  return (
    <div className="panel">
      <h2>Journal Entries</h2>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="grow">
            Narration
            <input
              placeholder="What is this entry for?"
              value={narration}
              onChange={(event) => setNarration(event.target.value)}
            />
          </label>
        </div>
        <table>
          <thead><tr><th>Account</th><th>Debit</th><th>Credit</th><th /></tr></thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select value={line.accountId} onChange={(event) => updateLine(index, 'accountId', event.target.value)}>
                    <option value="">Select account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit}
                    onChange={(event) => updateLine(index, 'debit', event.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.credit}
                    onChange={(event) => updateLine(index, 'credit', event.target.value)}
                  />
                </td>
                <td>
                  {lines.length > 2 && <button type="button" className="link-button" onClick={() => removeLine(index)}>Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Totals</td>
              <td className={totalDebit !== totalCredit ? 'mismatch' : ''}>{totalDebit.toFixed(2)}</td>
              <td className={totalDebit !== totalCredit ? 'mismatch' : ''}>{totalCredit.toFixed(2)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <button type="button" className="link-button" onClick={addLine}>+ Add line</button>
        {error && <p className="form-error">{error}</p>}
        <button type="submit">Post entry</button>
      </form>

      <h3>Recent entries</h3>
      <table>
        <thead><tr><th>Date</th><th>Narration</th><th>Lines</th><th>Amount</th></tr></thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.date}</td>
              <td>{entry.narration} {entry.source !== 'manual' && <span className="tag">{entry.source}</span>}</td>
              <td>
                {entry.lines.map((line, i) => (
                  <div key={i}>
                    {accountName(line.accountId)}: {line.debit > 0 ? `Dr ${line.debit}` : `Cr ${line.credit}`}
                  </div>
                ))}
              </td>
              <td>{sumLines(entry.lines, 'debit').toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
