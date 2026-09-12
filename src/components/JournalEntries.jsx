import { useState } from 'react'
import { validateJournalLines, sumLines, reverseLines } from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'

const today = () => new Date().toISOString().slice(0, 10)
const blankLine = () => ({ accountId: '', debit: '', credit: '' })
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const SOURCE_LABELS = {
  invoice: 'Sales Invoice',
  bill: 'Purchase Bill',
  payment: 'Payment',
  'credit-note': 'Credit Note',
  'debit-note': 'Debit Note',
  void: 'Void',
}

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

  const manualCount = entries.filter((entry) => entry.source === 'manual').length
  const nextVoucherNumber = `JV-${String(manualCount + 1).padStart(4, '0')}`

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
      number: nextVoucherNumber,
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
  const hasAmount = totalDebit > 0 || totalCredit > 0
  const balanced = hasAmount && totalDebit === totalCredit

  const voidEntry = async (entry) => {
    if (!window.confirm(`Void ${entry.number || 'this entry'}? A reversing entry will be posted - it stays in the books but nets to zero.`)) return
    await addOrgDoc(orgId, 'journalEntries', {
      date: today(),
      narration: `Void: ${entry.narration}`,
      lines: reverseLines(entry.lines),
      source: 'void',
    })
    await setOrgDoc(orgId, 'journalEntries', entry.id, { voided: true })
  }

  return (
    <div className="panel">
      <h2>Journal Voucher</h2>
      <form className="journal-form" onSubmit={submit}>
        <div className="voucher-number-row">
          <span className="voucher-badge">{nextVoucherNumber}</span>
          <span className="section-sub">Next voucher number</span>
        </div>
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
          <thead><tr><th>Account</th><th className="amt">Debit</th><th className="amt">Credit</th><th /></tr></thead>
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
                    className="amt-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.debit}
                    onChange={(event) => updateLine(index, 'debit', event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="amt-input"
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
              <td className={`amt ${totalDebit !== totalCredit ? 'mismatch' : ''}`}>{money(totalDebit)}</td>
              <td className={`amt ${totalDebit !== totalCredit ? 'mismatch' : ''}`}>{money(totalCredit)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <div className="journal-header-row">
          <button type="button" className="link-button" onClick={addLine}>+ Add line</button>
          {hasAmount && (
            <span className={balanced ? 'balance-ok' : 'balance-off'}>
              {balanced ? '✓ Balanced' : 'Not balanced yet'}
            </span>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit">Post entry</button>
      </form>

      <h3>Journal Register</h3>
      {entries.length === 0 && <p className="empty-note">No entries posted yet.</p>}
      <div className="voucher-list">
        {entries.map((entry) => (
          <div key={entry.id} className={`voucher-card ${entry.voided ? 'voided' : ''}`}>
            <div className="voucher-header">
              <div>
                <span className="voucher-badge">{entry.number || SOURCE_LABELS[entry.source] || 'Entry'}</span>
                <span className="voucher-date">{entry.date}</span>
                {entry.number && entry.source !== 'manual' && <span className="tag">{SOURCE_LABELS[entry.source] || entry.source}</span>}
                {entry.voided && <span className="tag tag-void">voided</span>}
              </div>
              <div className="voucher-amount">{money(sumLines(entry.lines, 'debit'))}</div>
            </div>
            <p className="voucher-narration">{entry.narration}</p>
            <table className="voucher-table">
              <tbody>
                {entry.lines.map((line, i) => (
                  <tr key={i}>
                    <td>{accountName(line.accountId)}</td>
                    <td className="amt">{line.debit > 0 ? money(line.debit) : ''}</td>
                    <td className="amt">{line.credit > 0 ? money(line.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {entry.source === 'manual' && !entry.voided && (
              <button type="button" className="link-button" onClick={() => voidEntry(entry)}>Void</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
