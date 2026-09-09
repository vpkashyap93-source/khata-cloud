import { useState } from 'react'
import { computeLedger } from '../lib/accounting.js'

export default function Ledger({ accounts, entries }) {
  const [accountId, setAccountId] = useState('')
  const account = accounts.find((item) => item.id === accountId)
  const rows = account ? computeLedger(account, entries) : []
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0

  return (
    <div className="panel">
      <h2>Ledger</h2>
      <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
        <option value="">Select an account</option>
        {accounts.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      {account && (
        <>
          <table>
            <thead><tr><th>Date</th><th>Narration</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>{row.date}</td>
                  <td>{row.narration}</td>
                  <td>{row.debit > 0 ? row.debit.toFixed(2) : ''}</td>
                  <td>{row.credit > 0 ? row.credit.toFixed(2) : ''}</td>
                  <td>{row.balance.toFixed(2)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={5}>No transactions yet.</td></tr>}
            </tbody>
          </table>
          <p className="grand-total">Closing balance: {closingBalance.toFixed(2)}</p>
        </>
      )}
    </div>
  )
}
