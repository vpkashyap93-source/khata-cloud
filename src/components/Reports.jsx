import { useState } from 'react'
import { computeTrialBalance, computeProfitAndLoss, computeBalanceSheet } from '../lib/accounting.js'

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${today().slice(0, 7)}-01`

function TrialBalance({ accounts, entries }) {
  const rows = computeTrialBalance(accounts, entries)
  const totalDebit = rows.reduce((total, row) => total + row.debitTotal, 0)
  const totalCredit = rows.reduce((total, row) => total + row.creditTotal, 0)
  return (
    <table>
      <thead><tr><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.account.id}>
            <td>{row.account.name}</td>
            <td>{row.account.type}</td>
            <td>{row.debitTotal > 0 ? row.debitTotal.toFixed(2) : ''}</td>
            <td>{row.creditTotal > 0 ? row.creditTotal.toFixed(2) : ''}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2}>Total</td>
          <td>{totalDebit.toFixed(2)}</td>
          <td>{totalCredit.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function ProfitAndLoss({ accounts, entries }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const { income, expenses, totalIncome, totalExpense, netProfit } = computeProfitAndLoss(accounts, entries, from, to)
  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <h3>Income</h3>
      <table>
        <tbody>
          {income.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td>{row.amount.toFixed(2)}</td></tr>)}
        </tbody>
        <tfoot><tr><td>Total Income</td><td>{totalIncome.toFixed(2)}</td></tr></tfoot>
      </table>
      <h3>Expenses</h3>
      <table>
        <tbody>
          {expenses.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td>{row.amount.toFixed(2)}</td></tr>)}
        </tbody>
        <tfoot><tr><td>Total Expenses</td><td>{totalExpense.toFixed(2)}</td></tr></tfoot>
      </table>
      <p className="grand-total">Net {netProfit >= 0 ? 'Profit' : 'Loss'}: {Math.abs(netProfit).toFixed(2)}</p>
    </>
  )
}

function BalanceSheet({ accounts, entries }) {
  const [asOf, setAsOf] = useState(today())
  const { assets, liabilities, equity, netProfit, totalAssets, totalLiabilities, totalEquity } = computeBalanceSheet(accounts, entries, asOf)
  const balanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
  return (
    <>
      <label>As of <input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label>
      <h3>Assets</h3>
      <table>
        <tbody>{assets.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td>{row.amount.toFixed(2)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total Assets</td><td>{totalAssets.toFixed(2)}</td></tr></tfoot>
      </table>
      <h3>Liabilities</h3>
      <table>
        <tbody>{liabilities.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td>{row.amount.toFixed(2)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total Liabilities</td><td>{totalLiabilities.toFixed(2)}</td></tr></tfoot>
      </table>
      <h3>Equity</h3>
      <table>
        <tbody>
          {equity.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td>{row.amount.toFixed(2)}</td></tr>)}
          <tr><td>Net Profit (period to date)</td><td>{netProfit.toFixed(2)}</td></tr>
        </tbody>
        <tfoot><tr><td>Total Equity</td><td>{totalEquity.toFixed(2)}</td></tr></tfoot>
      </table>
      <p className={balanced ? 'grand-total' : 'mismatch'}>
        {balanced ? 'Balanced: Assets = Liabilities + Equity' : 'Out of balance - check journal entries'}
      </p>
    </>
  )
}

export default function Reports({ accounts, entries }) {
  const [tab, setTab] = useState('trial')
  return (
    <div className="panel">
      <h2>Reports</h2>
      <div className="tab-row">
        <button className={tab === 'trial' ? 'active' : ''} onClick={() => setTab('trial')}>Trial Balance</button>
        <button className={tab === 'pnl' ? 'active' : ''} onClick={() => setTab('pnl')}>Profit &amp; Loss</button>
        <button className={tab === 'bs' ? 'active' : ''} onClick={() => setTab('bs')}>Balance Sheet</button>
      </div>
      {tab === 'trial' && <TrialBalance accounts={accounts} entries={entries} />}
      {tab === 'pnl' && <ProfitAndLoss accounts={accounts} entries={entries} />}
      {tab === 'bs' && <BalanceSheet accounts={accounts} entries={entries} />}
    </div>
  )
}
