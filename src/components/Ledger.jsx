import { useState } from 'react'
import { computeLedger } from '../lib/accounting.js'
import { downloadCsv } from '../lib/csv.js'
import Icon from './icons.jsx'

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amt = (value) => Number(value || 0).toFixed(2)
const today = () => new Date().toISOString().slice(0, 10)
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export default function Ledger({ accounts, entries }) {
  const [accountId, setAccountId] = useState('')
  const account = accounts.find((item) => item.id === accountId)
  const rows = account ? computeLedger(account, entries) : []
  const totalDebit = rows.reduce((total, row) => total + row.debit, 0)
  const totalCredit = rows.reduce((total, row) => total + row.credit, 0)
  const closingBalance = rows.length > 0 ? rows[rows.length - 1].balance : 0

  const exportCsv = () => {
    downloadCsv(`ledger-${slugify(account.name)}-${today()}.csv`, [
      ['Date', 'Narration', 'Debit', 'Credit', 'Balance'],
      ...rows.map((row) => [row.date, row.narration, amt(row.debit), amt(row.credit), amt(row.balance)]),
      ['', 'Closing balance', amt(totalDebit), amt(totalCredit), amt(closingBalance)],
    ])
  }

  return (
    <div className="panel">
      <h2>Ledger</h2>
      <div className="ledger-toolbar">
        <label>
          Account
          <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Select an account</option>
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {account && rows.length > 0 && (
          <button type="button" className="action-pill" onClick={exportCsv} style={{ alignSelf: 'flex-end' }}>
            <Icon name="download" size={13} />Export CSV
          </button>
        )}
        {account && (
          <div className="ledger-stats">
            <div className="stat-chip">
              <div className="stat-chip-label">Total Debit</div>
              <div className="stat-chip-value">{money(totalDebit)}</div>
            </div>
            <div className="stat-chip">
              <div className="stat-chip-label">Total Credit</div>
              <div className="stat-chip-value">{money(totalCredit)}</div>
            </div>
            <div className={`stat-chip ${closingBalance >= 0 ? 'positive' : 'negative'}`}>
              <div className="stat-chip-label">Closing Balance</div>
              <div className="stat-chip-value">{money(closingBalance)}</div>
            </div>
          </div>
        )}
      </div>

      {!account && (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="ledger" size={22} /></div>
          <p>Pick an account above to see its transaction history and running balance.</p>
        </div>
      )}

      {account && (
        <table>
          <thead><tr><th>Date</th><th>Narration</th><th className="amt">Debit</th><th className="amt">Credit</th><th className="amt">Balance</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                <td>{row.date}</td>
                <td>{row.narration}</td>
                <td className="amt">{row.debit > 0 ? money(row.debit) : ''}</td>
                <td className="amt">{row.credit > 0 ? money(row.credit) : ''}</td>
                <td className="amt">{money(row.balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="empty-note">No transactions yet.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Closing balance</td>
                <td className="amt">{money(totalDebit)}</td>
                <td className="amt">{money(totalCredit)}</td>
                <td className="amt">{money(closingBalance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  )
}
