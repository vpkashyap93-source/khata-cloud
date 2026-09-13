import { useState } from 'react'
import { computeLedger, isDebitNormal, liquidAccounts, round2 } from '../lib/accounting.js'
import { setOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Bank reconciliation, done the way a small business actually does it
// without a live bank feed: tick off each transaction against Cash, Bank,
// or any other liquid account (liquidAccounts) as it shows up on the real
// bank/passbook statement, and watch the reconciled total converge on the
// statement's closing balance. Nothing is fetched from any bank
// automatically - the owner enters the statement balance themselves.
export default function Reconciliation({ orgId, accounts, entries, reconciledEntries }) {
  const reconcilableAccounts = liquidAccounts(accounts)
  const [accountId, setAccountId] = useState('')
  const [statementBalance, setStatementBalance] = useState('')
  const account = accounts.find((item) => item.id === accountId)
  const rows = account ? computeLedger(account, entries) : []

  const reconciledKeys = new Set(
    reconciledEntries.filter((item) => item.accountId === accountId && item.reconciled).map((item) => item.entryId),
  )

  const toggle = (entryId) => {
    setOrgDoc(orgId, 'reconciledEntries', `${accountId}_${entryId}`, {
      accountId,
      entryId,
      reconciled: !reconciledKeys.has(entryId),
    })
  }

  const reconciledBalance = account
    ? round2(rows
        .filter((row) => reconciledKeys.has(row.entryId))
        .reduce((total, row) => total + (isDebitNormal(account.type) ? row.debit - row.credit : row.credit - row.debit), 0))
    : 0
  const statementValue = statementBalance === '' ? null : round2(statementBalance)
  const difference = statementValue === null ? null : round2(statementValue - reconciledBalance)

  return (
    <div className="panel">
      <h2>Bank Reconciliation</h2>
      <p className="section-sub">
        Tick off each transaction as it appears on your real bank or cash statement, and check the reconciled total against it - a difference means something's missing or duplicated.
      </p>
      <div className="ledger-toolbar">
        <label>
          Account
          <select value={accountId} onChange={(event) => { setAccountId(event.target.value); setStatementBalance('') }}>
            <option value="">Select an account</option>
            {reconcilableAccounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {account && (
          <label>
            Statement closing balance
            <input
              className="amt-input"
              type="number"
              step="0.01"
              value={statementBalance}
              onChange={(event) => setStatementBalance(event.target.value)}
              placeholder="From your bank/passbook"
            />
          </label>
        )}
        {account && (
          <div className="ledger-stats">
            <div className="stat-chip">
              <div className="stat-chip-label">Reconciled balance</div>
              <div className="stat-chip-value">{money(reconciledBalance)}</div>
            </div>
            {difference !== null && (
              <div className={`stat-chip ${difference === 0 ? 'positive' : 'negative'}`}>
                <div className="stat-chip-label">Difference</div>
                <div className="stat-chip-value">{money(difference)}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {!account && (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name="check" size={22} /></div>
          <p>Pick an account above to start reconciling against your statement.</p>
        </div>
      )}

      {account && (
        <table>
          <thead><tr><th /><th>Date</th><th>Narration</th><th className="amt">Debit</th><th className="amt">Credit</th><th className="amt">Balance</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className={reconciledKeys.has(row.entryId) ? 'reconciled-row' : ''}>
                <td>
                  <input type="checkbox" checked={reconciledKeys.has(row.entryId)} onChange={() => toggle(row.entryId)} />
                </td>
                <td>{row.date}</td>
                <td>{row.narration}</td>
                <td className="amt">{row.debit > 0 ? money(row.debit) : ''}</td>
                <td className="amt">{row.credit > 0 ? money(row.credit) : ''}</td>
                <td className="amt">{money(row.balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="empty-note">No transactions yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  )
}
