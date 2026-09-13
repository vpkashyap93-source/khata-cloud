import { useState } from 'react'
import { addOrgDoc } from '../firebase.js'
import { liquidAccounts, round2 } from '../lib/accounting.js'

const today = () => new Date().toISOString().slice(0, 10)
const blankRow = () => ({ date: today(), accountId: '', partyName: '', narration: '', amount: '' })
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A fast bulk-entry grid for simple cash/bank vouchers - pick a direction
// (money in or out) and a bank/cash account once, then add as many dated
// rows as needed (today's collections, yesterday's vendor payment, a dozen
// more) and post them all in one save. Each row becomes its own two-line
// journal entry - the bank/cash account on one side, the row's own account
// on the other - exactly what a manual Journal Voucher already does, just
// without re-picking the bank account and re-balancing debit/credit by
// hand for every single transaction. Posted with source 'manual', so these
// show up in - and can be voided from - the regular Journal Voucher
// register, sharing its JV-#### numbering.
export default function QuickEntry({ orgId, accounts, entries }) {
  const [voucherType, setVoucherType] = useState('receipt')
  const bankOptions = liquidAccounts(accounts)
  const [bankAccountId, setBankAccountId] = useState('')
  const [rows, setRows] = useState([blankRow()])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const updateRow = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
    setSuccess('')
  }
  const addRow = () => setRows((prev) => [...prev, blankRow()])
  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index))

  const otherAccounts = accounts.filter((account) => account.id !== bankAccountId)
  const total = round2(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!bankAccountId) { setError('Select a bank/cash account.'); return }
    const validRows = rows.filter((row) => row.date && row.accountId && Number(row.amount) > 0)
    if (validRows.length === 0) { setError('Add at least one row with a date, account, and amount.'); return }

    setBusy(true)
    try {
      let manualCount = entries.filter((entry) => entry.source === 'manual').length
      for (const row of validRows) {
        manualCount += 1
        const amount = round2(Number(row.amount))
        const narrationText = [row.partyName.trim(), row.narration.trim()].filter(Boolean).join(' - ')
          || (voucherType === 'receipt' ? 'Receipt' : 'Payment')
        const lines = voucherType === 'receipt'
          ? [{ accountId: bankAccountId, debit: amount, credit: 0 }, { accountId: row.accountId, debit: 0, credit: amount }]
          : [{ accountId: row.accountId, debit: amount, credit: 0 }, { accountId: bankAccountId, debit: 0, credit: amount }]
        await addOrgDoc(orgId, 'journalEntries', {
          number: `JV-${String(manualCount).padStart(4, '0')}`,
          date: row.date,
          narration: narrationText,
          lines,
          source: 'manual',
        })
      }
      setSuccess(`${validRows.length} entr${validRows.length === 1 ? 'y' : 'ies'} posted - check the Journal to see them.`)
      setRows([blankRow()])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2>Quick Entry</h2>
      <p className="section-sub">
        Fast bulk entry for simple cash/bank transactions - pick a direction and a bank/cash account once, then add
        as many dated rows as you need and post them all together. For anything with GST, use Sales Invoices or
        Purchase Bills instead - this posts straight to the ledger with no tax calculated.
      </p>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label>
            Type
            <select value={voucherType} onChange={(event) => setVoucherType(event.target.value)}>
              <option value="receipt">Receipt (money in)</option>
              <option value="payment">Payment (money out)</option>
            </select>
          </label>
          <label className="grow">
            {voucherType === 'receipt' ? 'Deposit into' : 'Pay from'}
            <select value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
              <option value="">Select bank/cash account</option>
              {bankOptions.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>{voucherType === 'receipt' ? 'Received from (account)' : 'Paid to (account)'}</th>
              <th>Party name</th>
              <th>Narration</th>
              <th className="amt">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td><input type="date" value={row.date} onChange={(event) => updateRow(index, 'date', event.target.value)} /></td>
                <td>
                  <select value={row.accountId} onChange={(event) => updateRow(index, 'accountId', event.target.value)}>
                    <option value="">Select account</option>
                    {otherAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </td>
                <td><input value={row.partyName} onChange={(event) => updateRow(index, 'partyName', event.target.value)} placeholder="Optional" /></td>
                <td><input value={row.narration} onChange={(event) => updateRow(index, 'narration', event.target.value)} placeholder="Optional" /></td>
                <td><input className="amt-input" type="number" min="0" step="0.01" value={row.amount} onChange={(event) => updateRow(index, 'amount', event.target.value)} /></td>
                <td>{rows.length > 1 && <button type="button" className="link-button" onClick={() => removeRow(index)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="amt">{money(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        <div className="journal-header-row">
          <button type="button" className="link-button" onClick={addRow}>+ Add row</button>
        </div>
        {error && <p className="form-error">{error}</p>}
        {success && <p className="auth-info">{success}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Posting...' : `Post ${rows.length > 1 ? 'entries' : 'entry'}`}</button>
      </form>
    </div>
  )
}
