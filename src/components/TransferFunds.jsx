import { useState } from 'react'
import { liquidAccounts, accountBalance, round2 } from '../lib/accounting.js'
import { addOrgDoc } from '../firebase.js'

const today = () => new Date().toISOString().slice(0, 10)
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Moving money between your own accounts - Cash to Bank, one bank account
// to another - isn't income or an expense, so it gets its own simple form
// instead of routing everyone through a manual Journal Entry, which
// assumes you already know which side to debit and which to credit.
export default function TransferFunds({ orgId, accounts, entries }) {
  const transferable = liquidAccounts(accounts)
  const [date, setDate] = useState(today())
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fromAccount = accounts.find((account) => account.id === fromId)
  const fromBalance = fromAccount ? accountBalance(fromAccount, entries).balance : null

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    const value = round2(amount)
    if (!fromId || !toId) { setError('Pick both accounts.'); return }
    if (fromId === toId) { setError('Pick two different accounts.'); return }
    if (value <= 0) { setError('Enter an amount greater than zero.'); return }
    const toAccount = accounts.find((account) => account.id === toId)

    await addOrgDoc(orgId, 'journalEntries', {
      date,
      narration: note.trim() || `Transfer: ${fromAccount.name} to ${toAccount.name}`,
      lines: [
        { accountId: toId, debit: value, credit: 0 },
        { accountId: fromId, debit: 0, credit: value },
      ],
      source: 'transfer',
    })
    setAmount('')
    setNote('')
    setSuccess(`Transferred ${money(value)} from ${fromAccount.name} to ${toAccount.name}.`)
  }

  return (
    <div className="panel">
      <h2>Transfer Funds</h2>
      <p className="section-sub">
        Move money between your own accounts - Cash to Bank, or one bank account to another. Not income or an
        expense, so it never shows up in Profit &amp; Loss.
      </p>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label>
            From
            <select value={fromId} onChange={(event) => setFromId(event.target.value)}>
              <option value="">Select account</option>
              {transferable.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label>
            To
            <select value={toId} onChange={(event) => setToId(event.target.value)}>
              <option value="">Select account</option>
              {transferable.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label>
            Amount
            <input className="amt-input" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
        </div>
        {fromAccount && <p className="section-sub">{fromAccount.name} current balance: {money(fromBalance)}</p>}
        <label>
          Note (optional)
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Deposited cash into bank" />
        </label>
        {error && <p className="form-error">{error}</p>}
        {success && <p className="auth-info">{success}</p>}
        <button type="submit">Record transfer</button>
      </form>
    </div>
  )
}
