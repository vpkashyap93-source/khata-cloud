import { useState } from 'react'
import { computeTrialBalance, computeProfitAndLoss, computeBalanceSheet, computeGstSummary } from '../lib/accounting.js'

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${today().slice(0, 7)}-01`
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function TrialBalance({ accounts, entries }) {
  const rows = computeTrialBalance(accounts, entries)
  const totalDebit = rows.reduce((total, row) => total + row.debitTotal, 0)
  const totalCredit = rows.reduce((total, row) => total + row.creditTotal, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01
  return (
    <>
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Total Debit</div>
          <div className="report-stat-value">{money(totalDebit)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Total Credit</div>
          <div className="report-stat-value">{money(totalCredit)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Status</div>
          <div className={`report-stat-value ${balanced ? 'green' : 'red'}`}>{balanced ? 'Balanced' : 'Out of balance'}</div>
        </div>
      </div>
      <table>
        <thead><tr><th>Account</th><th>Type</th><th className="amt">Debit</th><th className="amt">Credit</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.account.id}>
              <td>{row.account.name}</td>
              <td>{row.account.type}</td>
              <td className="amt">{row.debitTotal > 0 ? money(row.debitTotal) : ''}</td>
              <td className="amt">{row.creditTotal > 0 ? money(row.creditTotal) : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td className="amt">{money(totalDebit)}</td>
            <td className="amt">{money(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </>
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
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Total Income</div>
          <div className="report-stat-value green">{money(totalIncome)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Total Expense</div>
          <div className="report-stat-value red">{money(totalExpense)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Net {netProfit >= 0 ? 'Profit' : 'Loss'}</div>
          <div className={`report-stat-value ${netProfit >= 0 ? 'green' : 'red'}`}>{money(Math.abs(netProfit))}</div>
        </div>
      </div>
      <p className="report-section-title">Income</p>
      <table>
        <tbody>
          {income.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td className="amt">{money(row.amount)}</td></tr>)}
        </tbody>
        <tfoot><tr><td>Total Income</td><td className="amt">{money(totalIncome)}</td></tr></tfoot>
      </table>
      <p className="report-section-title">Expenses</p>
      <table>
        <tbody>
          {expenses.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td className="amt">{money(row.amount)}</td></tr>)}
        </tbody>
        <tfoot><tr><td>Total Expenses</td><td className="amt">{money(totalExpense)}</td></tr></tfoot>
      </table>
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
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Total Assets</div>
          <div className="report-stat-value accent">{money(totalAssets)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Liabilities + Equity</div>
          <div className="report-stat-value">{money(totalLiabilities + totalEquity)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Status</div>
          <div className={`report-stat-value ${balanced ? 'green' : 'red'}`}>{balanced ? 'Balanced' : 'Out of balance'}</div>
        </div>
      </div>
      <p className="report-section-title">Assets</p>
      <table>
        <tbody>{assets.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td className="amt">{money(row.amount)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total Assets</td><td className="amt">{money(totalAssets)}</td></tr></tfoot>
      </table>
      <p className="report-section-title">Liabilities</p>
      <table>
        <tbody>{liabilities.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td className="amt">{money(row.amount)}</td></tr>)}</tbody>
        <tfoot><tr><td>Total Liabilities</td><td className="amt">{money(totalLiabilities)}</td></tr></tfoot>
      </table>
      <p className="report-section-title">Equity</p>
      <table>
        <tbody>
          {equity.map((row) => <tr key={row.account.id}><td>{row.account.name}</td><td className="amt">{money(row.amount)}</td></tr>)}
          <tr><td>Net Profit (period to date)</td><td className="amt">{money(netProfit)}</td></tr>
        </tbody>
        <tfoot><tr><td>Total Equity</td><td className="amt">{money(totalEquity)}</td></tr></tfoot>
      </table>
    </>
  )
}

function GstSummary({ invoices, bills, creditNotes, debitNotes }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const { sales, purchases, netPayable, totalPayable, invoiceCount, billCount } = computeGstSummary(invoices, bills, creditNotes, debitNotes, from, to)
  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Sales (net of CN)</div>
          <div className="report-stat-value">{money(sales.taxable)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Purchases (net of DN)</div>
          <div className="report-stat-value">{money(purchases.taxable)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">{totalPayable >= 0 ? 'Total Payable' : 'Credit Carried Forward'}</div>
          <div className={`report-stat-value ${totalPayable >= 0 ? 'red' : 'green'}`}>{money(Math.abs(totalPayable))}</div>
        </div>
      </div>

      <p className="report-section-title">Output tax - Sales ({invoiceCount} invoice{invoiceCount === 1 ? '' : 's'}, net of credit notes)</p>
      <table>
        <thead><tr><th>Taxable value</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          <tr>
            <td>{money(sales.taxable)}</td>
            <td className="amt">{money(sales.cgst)}</td>
            <td className="amt">{money(sales.sgst)}</td>
            <td className="amt">{money(sales.igst)}</td>
          </tr>
        </tbody>
      </table>

      <p className="report-section-title">Input tax credit - Purchases ({billCount} bill{billCount === 1 ? '' : 's'}, net of debit notes)</p>
      <table>
        <thead><tr><th>Taxable value</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          <tr>
            <td>{money(purchases.taxable)}</td>
            <td className="amt">{money(purchases.cgst)}</td>
            <td className="amt">{money(purchases.sgst)}</td>
            <td className="amt">{money(purchases.igst)}</td>
          </tr>
        </tbody>
      </table>

      <p className="report-section-title">Net GST payable</p>
      <table>
        <thead><tr><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          <tr>
            <td className="amt">{money(netPayable.cgst)}</td>
            <td className="amt">{money(netPayable.sgst)}</td>
            <td className="amt">{money(netPayable.igst)}</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}

export default function Reports({ accounts, entries, invoices, bills, creditNotes, debitNotes }) {
  const [tab, setTab] = useState('trial')
  return (
    <div className="panel">
      <h2>Reports</h2>
      <div className="tab-row">
        <button className={tab === 'trial' ? 'active' : ''} onClick={() => setTab('trial')}>Trial Balance</button>
        <button className={tab === 'pnl' ? 'active' : ''} onClick={() => setTab('pnl')}>Profit &amp; Loss</button>
        <button className={tab === 'bs' ? 'active' : ''} onClick={() => setTab('bs')}>Balance Sheet</button>
        <button className={tab === 'gst' ? 'active' : ''} onClick={() => setTab('gst')}>GST Summary</button>
      </div>
      {tab === 'trial' && <TrialBalance accounts={accounts} entries={entries} />}
      {tab === 'pnl' && <ProfitAndLoss accounts={accounts} entries={entries} />}
      {tab === 'bs' && <BalanceSheet accounts={accounts} entries={entries} />}
      {tab === 'gst' && <GstSummary invoices={invoices} bills={bills} creditNotes={creditNotes} debitNotes={debitNotes} />}
    </div>
  )
}
