import { useState } from 'react'
import { computeTrialBalance, computeProfitAndLoss, computeBalanceSheet, computeGstSummary, computeAging, hsnSummary, round2 } from '../lib/accounting.js'
import { downloadCsv, downloadJson } from '../lib/csv.js'
import { buildGstr1 } from '../lib/gstr1.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => `${today().slice(0, 7)}-01`
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amt = (value) => Number(value || 0).toFixed(2)

function ExportButton({ onClick }) {
  return (
    <div className="export-row">
      <button type="button" className="action-pill" onClick={onClick}><Icon name="download" size={13} />Export CSV</button>
    </div>
  )
}

function TrialBalance({ accounts, entries }) {
  const rows = computeTrialBalance(accounts, entries)
  const totalDebit = rows.reduce((total, row) => total + row.debitTotal, 0)
  const totalCredit = rows.reduce((total, row) => total + row.creditTotal, 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const exportCsv = () => {
    downloadCsv(`trial-balance-${today()}.csv`, [
      ['Account', 'Type', 'Debit', 'Credit'],
      ...rows.map((row) => [row.account.name, row.account.type, amt(row.debitTotal), amt(row.creditTotal)]),
      ['Total', '', amt(totalDebit), amt(totalCredit)],
    ])
  }

  return (
    <>
      <ExportButton onClick={exportCsv} />
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

  const exportCsv = () => {
    downloadCsv(`profit-and-loss-${from}-to-${to}.csv`, [
      ['Section', 'Account', 'Amount'],
      ...income.map((row) => ['Income', row.account.name, amt(row.amount)]),
      ['Income', 'Total Income', amt(totalIncome)],
      ...expenses.map((row) => ['Expense', row.account.name, amt(row.amount)]),
      ['Expense', 'Total Expenses', amt(totalExpense)],
      [netProfit >= 0 ? 'Net Profit' : 'Net Loss', '', amt(Math.abs(netProfit))],
    ])
  }

  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <ExportButton onClick={exportCsv} />
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

  const exportCsv = () => {
    downloadCsv(`balance-sheet-${asOf}.csv`, [
      ['Section', 'Account', 'Amount'],
      ...assets.map((row) => ['Asset', row.account.name, amt(row.amount)]),
      ['Asset', 'Total Assets', amt(totalAssets)],
      ...liabilities.map((row) => ['Liability', row.account.name, amt(row.amount)]),
      ['Liability', 'Total Liabilities', amt(totalLiabilities)],
      ...equity.map((row) => ['Equity', row.account.name, amt(row.amount)]),
      ['Equity', 'Net Profit (period to date)', amt(netProfit)],
      ['Equity', 'Total Equity', amt(totalEquity)],
    ])
  }

  return (
    <>
      <label>As of <input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} /></label>
      <ExportButton onClick={exportCsv} />
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

function GstSummary({ invoices, bills, creditNotes, debitNotes, items }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const { sales, purchases, netPayable, totalPayable, invoiceCount, billCount } = computeGstSummary(invoices, bills, creditNotes, debitNotes, from, to)
  const salesByCode = hsnSummary(invoices, items, from, to)
  const purchasesByCode = hsnSummary(bills, items, from, to)

  const exportCsv = () => {
    downloadCsv(`gst-summary-${from}-to-${to}.csv`, [
      ['Section', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
      ['Output tax - Sales', amt(sales.taxable), amt(sales.cgst), amt(sales.sgst), amt(sales.igst)],
      ['Input tax credit - Purchases', amt(purchases.taxable), amt(purchases.cgst), amt(purchases.sgst), amt(purchases.igst)],
      ['Net GST payable', '', amt(netPayable.cgst), amt(netPayable.sgst), amt(netPayable.igst)],
      [totalPayable >= 0 ? 'Total Payable' : 'Credit Carried Forward', amt(Math.abs(totalPayable)), '', '', ''],
      [],
      ['HSN/SAC - Sales', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
      ...salesByCode.map((row) => [row.code, amt(row.taxable), amt(row.cgst), amt(row.sgst), amt(row.igst)]),
      [],
      ['HSN/SAC - Purchases', 'Taxable Value', 'CGST', 'SGST', 'IGST'],
      ...purchasesByCode.map((row) => [row.code, amt(row.taxable), amt(row.cgst), amt(row.sgst), amt(row.igst)]),
    ])
  }

  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <ExportButton onClick={exportCsv} />
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

      <p className="report-section-title">Sales by HSN/SAC</p>
      <table>
        <thead><tr><th>Code</th><th className="amt">Taxable value</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          {salesByCode.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td className="amt">{money(row.taxable)}</td>
              <td className="amt">{money(row.cgst)}</td>
              <td className="amt">{money(row.sgst)}</td>
              <td className="amt">{money(row.igst)}</td>
            </tr>
          ))}
          {salesByCode.length === 0 && <tr><td colSpan={5} className="empty-note">No sales with line items in this period.</td></tr>}
        </tbody>
      </table>

      <p className="report-section-title">Purchases by HSN/SAC</p>
      <table>
        <thead><tr><th>Code</th><th className="amt">Taxable value</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          {purchasesByCode.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td className="amt">{money(row.taxable)}</td>
              <td className="amt">{money(row.cgst)}</td>
              <td className="amt">{money(row.sgst)}</td>
              <td className="amt">{money(row.igst)}</td>
            </tr>
          ))}
          {purchasesByCode.length === 0 && <tr><td colSpan={5} className="empty-note">No purchases with line items in this period.</td></tr>}
        </tbody>
      </table>
    </>
  )
}

// The GST portal's own "Returns Offline Tool" upload format - B2B, B2CL,
// B2CS, CDNR and HSN sections built from this period's sales invoices and
// credit notes (see buildGstr1 in src/lib/gstr1.js for exactly what is and
// isn't covered). Best-effort against the publicly documented schema, not
// something issued by the GST portal - always worth a look from your CA
// (or the portal's own validation) before an actual filing.
function Gstr1Export({ invoices, creditNotes, customers, items, org }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())

  const periodInvoices = invoices.filter((invoice) => !invoice.voided && invoice.date >= from && invoice.date <= to)
  const unmatchedCount = periodInvoices.filter(
    (invoice) => !customers.some((customer) => customer.name.trim().toLowerCase() === (invoice.partyName || '').trim().toLowerCase()),
  ).length

  const gstr1 = buildGstr1(invoices, creditNotes, customers, items, org, from, to)
  const b2bInvoiceCount = gstr1.b2b.reduce((total, bucket) => total + bucket.inv.length, 0)

  const exportJson = () => downloadJson(`gstr1-${from}-to-${to}.json`, gstr1)

  const exportCsv = () => {
    const rows = [['Section', 'GSTIN', 'Invoice/Note No.', 'Date', 'Place of Supply', 'Rate %', 'Taxable Value', 'CGST', 'SGST', 'IGST']]
    gstr1.b2b.forEach((bucket) => bucket.inv.forEach((inv) => {
      const line = inv.itms[0].itm_det
      rows.push(['B2B', bucket.ctin, inv.inum, inv.idt, inv.pos, amt(line.rt), amt(line.txval), amt(line.camt), amt(line.samt), amt(line.iamt)])
    }))
    gstr1.b2cl.forEach((inv) => {
      const line = inv.itms[0].itm_det
      rows.push(['B2CL', '', inv.inum, inv.idt, inv.pos, amt(line.rt), amt(line.txval), amt(line.camt), amt(line.samt), amt(line.iamt)])
    })
    gstr1.b2cs.forEach((bucket) => {
      rows.push(['B2CS', '', '', '', bucket.pos, amt(bucket.rt), amt(bucket.txval), amt(bucket.camt), amt(bucket.samt), amt(bucket.iamt)])
    })
    gstr1.cdnr.forEach((bucket) => bucket.nt.forEach((note) => {
      const line = note.itms[0].itm_det
      rows.push(['CDNR', bucket.ctin, note.nt_num, note.nt_dt, note.pos, amt(line.rt), amt(line.txval), amt(line.camt), amt(line.samt), amt(line.iamt)])
    }))
    rows.push([])
    rows.push(['HSN Summary', 'Description', 'UQC', 'Qty', 'Rate %', 'Taxable Value', 'CGST', 'SGST', 'IGST'])
    gstr1.hsn.data.forEach((row) => {
      rows.push(['HSN', row.hsn_sc, row.uqc, amt(row.qty), amt(row.rt), amt(row.txval), amt(row.camt), amt(row.samt), amt(row.iamt)])
    })
    downloadCsv(`gstr1-${from}-to-${to}.csv`, rows)
  }

  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <p className="section-sub">
        Built from this period&apos;s sales invoices and credit notes, in the shape of the GST portal&apos;s own
        offline-upload JSON - a strong head start for filing, not a guaranteed-correct one. Covers B2B, B2CL, B2CS,
        CDNR and HSN; it leaves out exports, advances, and credit/debit notes against unregistered customers. Have
        your CA (or the portal&apos;s own validation) check it before you file.
      </p>
      {!org.gstin && <p className="form-error">Your own GSTIN isn&apos;t set - add it in Settings before filing with this export.</p>}
      {unmatchedCount > 0 && (
        <p className="form-error">
          {unmatchedCount} invoice{unmatchedCount === 1 ? '' : 's'} in this period {unmatchedCount === 1 ? 'has' : 'have'} a party
          name that doesn&apos;t match a saved customer, so {unmatchedCount === 1 ? 'it was' : 'they were'} treated as unregistered
          (B2C) - check Customers if any of them should be B2B.
        </p>
      )}
      <div className="journal-header-row">
        <button type="button" className="action-pill" onClick={exportJson}><Icon name="download" size={13} />Download GSTR-1 JSON</button>
        <button type="button" className="action-pill" onClick={exportCsv}><Icon name="download" size={13} />Download readable CSV</button>
      </div>
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">B2B invoices</div>
          <div className="report-stat-value">{b2bInvoiceCount}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">B2C large invoices</div>
          <div className="report-stat-value">{gstr1.b2cl.length}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">B2C summary rows</div>
          <div className="report-stat-value">{gstr1.b2cs.length}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">HSN/SAC codes</div>
          <div className="report-stat-value">{gstr1.hsn.data.length}</div>
        </div>
      </div>
    </>
  )
}

function Aging({ invoices, bills }) {
  const receivables = computeAging(invoices)
  const payables = computeAging(bills)
  const totalReceivable = round2(receivables.reduce((total, bucket) => total + bucket.total, 0))
  const totalPayable = round2(payables.reduce((total, bucket) => total + bucket.total, 0))
  const overdueReceivable = round2(receivables.filter((bucket) => bucket.label !== 'Current').reduce((total, bucket) => total + bucket.total, 0))
  const overduePayable = round2(payables.filter((bucket) => bucket.label !== 'Current').reduce((total, bucket) => total + bucket.total, 0))

  const exportCsv = () => {
    downloadCsv(`aging-${today()}.csv`, [
      ['Type', ...receivables.map((bucket) => bucket.label), 'Total'],
      ['Receivables', ...receivables.map((bucket) => amt(bucket.total)), amt(totalReceivable)],
      ['Payables', ...payables.map((bucket) => amt(bucket.total)), amt(totalPayable)],
    ])
  }

  const bucketTable = (buckets, total) => (
    <table>
      <thead><tr>{buckets.map((bucket) => <th key={bucket.label} className="amt">{bucket.label}</th>)}<th className="amt">Total</th></tr></thead>
      <tbody>
        <tr>
          {buckets.map((bucket) => <td key={bucket.label} className="amt">{bucket.total > 0 ? money(bucket.total) : '-'}</td>)}
          <td className="amt">{money(total)}</td>
        </tr>
      </tbody>
    </table>
  )

  return (
    <>
      <ExportButton onClick={exportCsv} />
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Total Receivable</div>
          <div className="report-stat-value">{money(totalReceivable)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Overdue Receivable</div>
          <div className={`report-stat-value ${overdueReceivable > 0 ? 'red' : 'green'}`}>{money(overdueReceivable)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Total Payable</div>
          <div className="report-stat-value">{money(totalPayable)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Overdue Payable</div>
          <div className={`report-stat-value ${overduePayable > 0 ? 'red' : 'green'}`}>{money(overduePayable)}</div>
        </div>
      </div>
      <p className="report-section-title">Receivables aging (money customers owe you)</p>
      {bucketTable(receivables, totalReceivable)}
      <p className="report-section-title">Payables aging (money you owe vendors)</p>
      {bucketTable(payables, totalPayable)}
    </>
  )
}

export default function Reports({ accounts, entries, invoices, bills, creditNotes, debitNotes, items, customers, org }) {
  const [tab, setTab] = useState('trial')
  return (
    <div className="panel">
      <h2>Reports</h2>
      <div className="tab-row">
        <button className={tab === 'trial' ? 'active' : ''} onClick={() => setTab('trial')}>Trial Balance</button>
        <button className={tab === 'pnl' ? 'active' : ''} onClick={() => setTab('pnl')}>Profit &amp; Loss</button>
        <button className={tab === 'bs' ? 'active' : ''} onClick={() => setTab('bs')}>Balance Sheet</button>
        <button className={tab === 'gst' ? 'active' : ''} onClick={() => setTab('gst')}>GST Summary</button>
        <button className={tab === 'gstr1' ? 'active' : ''} onClick={() => setTab('gstr1')}>GSTR-1 Export</button>
        <button className={tab === 'aging' ? 'active' : ''} onClick={() => setTab('aging')}>Aging</button>
      </div>
      {tab === 'trial' && <TrialBalance accounts={accounts} entries={entries} />}
      {tab === 'pnl' && <ProfitAndLoss accounts={accounts} entries={entries} />}
      {tab === 'bs' && <BalanceSheet accounts={accounts} entries={entries} />}
      {tab === 'gst' && <GstSummary invoices={invoices} bills={bills} creditNotes={creditNotes} debitNotes={debitNotes} items={items} />}
      {tab === 'gstr1' && <Gstr1Export invoices={invoices} creditNotes={creditNotes} customers={customers} items={items} org={org} />}
      {tab === 'aging' && <Aging invoices={invoices} bills={bills} />}
    </div>
  )
}
