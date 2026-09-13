import { useState } from 'react'
import { computeTrialBalance, computeProfitAndLoss, computeBalanceSheet, computeGstSummary, computeAging, hsnSummary, round2 } from '../lib/accounting.js'
import { downloadCsv, downloadJson, parseCsvObjects } from '../lib/csv.js'
import { buildGstr1 } from '../lib/gstr1.js'
import { buildPurchaseRegister } from '../lib/purchaseRegister.js'
import { parseGstr2bRows, reconcileGstr2b } from '../lib/gstr2bReconcile.js'
import { buildGstr3b } from '../lib/gstr3b.js'
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

// A register to check line by line against the GSTR-2B you download from
// the GST portal (Returns Dashboard -> GSTR-2A/2B) - see buildPurchaseRegister
// in src/lib/purchaseRegister.js for why that statement itself can't be
// built from this app's own data, and what a mismatch usually means.
function PurchaseRegister({ bills, debitNotes, vendors, items }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const register = buildPurchaseRegister(bills, debitNotes, vendors, items, from, to)

  const exportCsv = () => {
    const rows = [['Section', 'Vendor', 'GSTIN', 'Bill/Note No.', 'Date', 'Rate %', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total']]
    register.bills.forEach((row) => rows.push(['Bill', row.vendorName, row.vendorGstin, row.number, row.date, amt(row.rate), amt(row.taxable), amt(row.cgst), amt(row.sgst), amt(row.igst), amt(row.total)]))
    register.debitNotes.forEach((row) => rows.push(['Debit Note', row.vendorName, row.vendorGstin, row.number, row.date, '', amt(row.taxable), amt(row.cgst), amt(row.sgst), amt(row.igst), amt(row.total)]))
    rows.push([])
    rows.push(['Totals', '', '', '', '', '', amt(register.totals.taxable), amt(register.totals.cgst), amt(register.totals.sgst), amt(register.totals.igst), amt(register.totals.total)])
    rows.push([])
    rows.push(['HSN/SAC Summary', 'Qty', 'Taxable Value', 'CGST', 'SGST', 'IGST'])
    register.hsn.forEach((row) => rows.push([row.code, amt(row.qty), amt(row.taxable), amt(row.cgst), amt(row.sgst), amt(row.igst)]))
    downloadCsv(`purchase-register-${from}-to-${to}.csv`, rows)
  }

  const totalTax = round2(register.totals.cgst + register.totals.sgst + register.totals.igst)

  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <p className="section-sub">
        This period&apos;s bills and debit notes, vendor-wise - for checking against the GSTR-2B you download from
        the GST portal, not a replacement for it. A bill here missing from your 2B usually means that vendor
        hasn&apos;t filed their GSTR-1 yet, or filed it differently - either way, that ITC isn&apos;t safe to claim
        until it shows up there.
      </p>
      {register.unmatchedCount > 0 && (
        <p className="form-error">
          {register.unmatchedCount} bill{register.unmatchedCount === 1 ? '' : 's'} in this period {register.unmatchedCount === 1 ? "doesn't" : "don't"} match
          a saved vendor, so no GSTIN could be filled in for {register.unmatchedCount === 1 ? 'it' : 'them'} - check Vendors.
        </p>
      )}
      <ExportButton onClick={exportCsv} />
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Taxable Value</div>
          <div className="report-stat-value">{money(register.totals.taxable)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Total ITC (CGST+SGST+IGST)</div>
          <div className="report-stat-value">{money(totalTax)}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Bills</div>
          <div className="report-stat-value">{register.bills.length}</div>
        </div>
      </div>

      <p className="report-section-title">Bills</p>
      <table>
        <thead><tr><th>Vendor</th><th>GSTIN</th><th>No.</th><th>Date</th><th className="amt">Taxable</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th><th className="amt">Total</th></tr></thead>
        <tbody>
          {register.bills.map((row) => (
            <tr key={row.number}>
              <td>{row.vendorName}</td>
              <td>{row.vendorGstin || '-'}</td>
              <td>{row.number}</td>
              <td>{row.date}</td>
              <td className="amt">{money(row.taxable)}</td>
              <td className="amt">{money(row.cgst)}</td>
              <td className="amt">{money(row.sgst)}</td>
              <td className="amt">{money(row.igst)}</td>
              <td className="amt">{money(row.total)}</td>
            </tr>
          ))}
          {register.bills.length === 0 && <tr><td colSpan={9} className="empty-note">No bills in this period.</td></tr>}
        </tbody>
      </table>

      {register.debitNotes.length > 0 && (
        <>
          <p className="report-section-title">Debit Notes (purchase returns)</p>
          <table>
            <thead><tr><th>Vendor</th><th>GSTIN</th><th>No.</th><th>Date</th><th className="amt">Taxable</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th><th className="amt">Total</th></tr></thead>
            <tbody>
              {register.debitNotes.map((row) => (
                <tr key={row.number}>
                  <td>{row.vendorName}</td>
                  <td>{row.vendorGstin || '-'}</td>
                  <td>{row.number}</td>
                  <td>{row.date}</td>
                  <td className="amt">{money(row.taxable)}</td>
                  <td className="amt">{money(row.cgst)}</td>
                  <td className="amt">{money(row.sgst)}</td>
                  <td className="amt">{money(row.igst)}</td>
                  <td className="amt">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="report-section-title">Purchases by HSN/SAC</p>
      <table>
        <thead><tr><th>Code</th><th className="amt">Qty</th><th className="amt">Taxable value</th><th className="amt">CGST</th><th className="amt">SGST</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          {register.hsn.map((row) => (
            <tr key={row.code}>
              <td>{row.code}</td>
              <td className="amt">{money(row.qty)}</td>
              <td className="amt">{money(row.taxable)}</td>
              <td className="amt">{money(row.cgst)}</td>
              <td className="amt">{money(row.sgst)}</td>
              <td className="amt">{money(row.igst)}</td>
            </tr>
          ))}
          {register.hsn.length === 0 && <tr><td colSpan={6} className="empty-note">No bills with line items in this period.</td></tr>}
        </tbody>
      </table>
    </>
  )
}

const GSTR2B_TEMPLATE_HEADERS = ['GSTIN of supplier', 'Trade/Legal Name', 'Invoice Number', 'Invoice Date', 'Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax']

// Matches a GSTR-2B download (uploaded as CSV, since that's the one format
// this app can parse with confidence - see parseGstr2bRows in
// src/lib/gstr2bReconcile.js for the column names it recognizes, including
// several from the portal's own Excel export) against this period's bills,
// so the tedious row-by-row check against Purchase Register becomes a
// glance at four buckets instead.
function Gstr2bMatch({ bills, vendors }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [result, setResult] = useState(null)
  const [fileError, setFileError] = useState('')
  const [fileName, setFileName] = useState('')

  const handleFile = async (file) => {
    if (!file) return
    setFileError('')
    setResult(null)
    try {
      const text = await file.text()
      const rows = parseGstr2bRows(parseCsvObjects(text))
      if (rows.length === 0) {
        setFileError("Couldn't find any usable rows - check the column headers match the template.")
        return
      }
      setResult(reconcileGstr2b(rows, bills, vendors, from, to))
      setFileName(file.name)
    } catch (err) {
      setFileError(`Could not read that file - ${err.message}`)
    }
  }

  const exportCsv = () => {
    const rows = [['Status', 'Vendor', 'GSTIN', 'Invoice No.', 'Book Taxable', 'Portal Taxable', 'Book Tax', 'Portal Tax']]
    result.matched.forEach(({ bill, vendor }) => rows.push(['Matched', vendor.name, vendor.gstin, bill.number, amt(bill.taxable), amt(bill.taxable), amt(round2(bill.cgst + bill.sgst + bill.igst)), amt(round2(bill.cgst + bill.sgst + bill.igst))]))
    result.mismatched.forEach(({ bill, vendor, portalRow }) => rows.push(['Mismatched', vendor.name, vendor.gstin, bill.number, amt(bill.taxable), amt(portalRow.taxableValue), amt(round2(bill.cgst + bill.sgst + bill.igst)), amt(Number(portalRow.cgst) + Number(portalRow.sgst) + Number(portalRow.igst))]))
    result.missingFromPortal.forEach(({ bill, vendor }) => rows.push(['Missing from 2B (ITC risk)', vendor.name, vendor.gstin, bill.number, amt(bill.taxable), '', amt(round2(bill.cgst + bill.sgst + bill.igst)), '']))
    result.missingFromBooks.forEach((row) => rows.push(['Missing from books', row.vendorName || '', row.gstin, row.invoiceNumber, '', amt(row.taxableValue), '', amt((Number(row.cgst) || 0) + (Number(row.sgst) || 0) + (Number(row.igst) || 0))]))
    downloadCsv(`gstr2b-reconciliation-${from}-to-${to}.csv`, rows)
  }

  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <p className="section-sub">
        This app can&apos;t download your GSTR-2B itself - only the GST portal can (Returns Dashboard -&gt; GSTR-2A/2B),
        since it&apos;s built from what your vendors filed, not your own data. Download it there, save the B2B sheet as
        CSV (or use the template below), and upload it here to match it against this period&apos;s bills automatically.
      </p>
      <div className="journal-header-row">
        <button
          type="button"
          className="link-button"
          onClick={() => downloadCsv('gstr2b-import-template.csv', [
            GSTR2B_TEMPLATE_HEADERS,
            ['27BBBBB1111B1Z9', 'Example Vendor', 'BILL-0001', today(), '5000.00', '0.00', '450.00', '450.00'],
          ])}
        >
          Download CSV template
        </button>
        <label className="action-pill" style={{ cursor: 'pointer' }}>
          <Icon name="upload" size={13} />Upload GSTR-2B CSV
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(event) => handleFile(event.target.files?.[0])} />
        </label>
      </div>
      {fileError && <p className="form-error">{fileError}</p>}

      {result && (
        <>
          <p className="section-sub">Matched against <strong>{fileName}</strong>.</p>
          {result.noGstinBills.length > 0 && (
            <p className="form-error">
              {result.noGstinBills.length} bill{result.noGstinBills.length === 1 ? '' : 's'} in this period {result.noGstinBills.length === 1 ? "couldn't" : "couldn't"} be matched
              at all - {result.noGstinBills.length === 1 ? 'its' : 'their'} vendor has no saved GSTIN. Add it in Vendors and re-upload.
            </p>
          )}
          <ExportButton onClick={exportCsv} />
          <div className="report-summary">
            <div className="report-stat">
              <div className="report-stat-label">Matched</div>
              <div className="report-stat-value green">{result.matched.length}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">Mismatched</div>
              <div className={`report-stat-value ${result.mismatched.length > 0 ? 'red' : ''}`}>{result.mismatched.length}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">Missing from 2B (ITC risk)</div>
              <div className={`report-stat-value ${result.missingFromPortal.length > 0 ? 'red' : ''}`}>{result.missingFromPortal.length}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">Missing from books</div>
              <div className={`report-stat-value ${result.missingFromBooks.length > 0 ? 'red' : ''}`}>{result.missingFromBooks.length}</div>
            </div>
          </div>

          {result.mismatched.length > 0 && (
            <>
              <p className="report-section-title">Mismatched - value differs from the portal</p>
              <table>
                <thead><tr><th>Vendor</th><th>Bill No.</th><th className="amt">Book Taxable</th><th className="amt">Portal Taxable</th><th className="amt">Book Tax</th><th className="amt">Portal Tax</th></tr></thead>
                <tbody>
                  {result.mismatched.map(({ bill, vendor, portalRow }) => (
                    <tr key={bill.id}>
                      <td>{vendor.name}</td>
                      <td>{bill.number}</td>
                      <td className="amt">{money(bill.taxable)}</td>
                      <td className="amt">{money(portalRow.taxableValue)}</td>
                      <td className="amt">{money(round2(bill.cgst + bill.sgst + bill.igst))}</td>
                      <td className="amt">{money((Number(portalRow.cgst) || 0) + (Number(portalRow.sgst) || 0) + (Number(portalRow.igst) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {result.missingFromPortal.length > 0 && (
            <>
              <p className="report-section-title">In your books, not on the portal - ITC not safe to claim yet</p>
              <table>
                <thead><tr><th>Vendor</th><th>Bill No.</th><th>Date</th><th className="amt">Taxable</th><th className="amt">Tax</th></tr></thead>
                <tbody>
                  {result.missingFromPortal.map(({ bill, vendor }) => (
                    <tr key={bill.id}>
                      <td>{vendor.name}</td>
                      <td>{bill.number}</td>
                      <td>{bill.date}</td>
                      <td className="amt">{money(bill.taxable)}</td>
                      <td className="amt">{money(round2(bill.cgst + bill.sgst + bill.igst))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {result.missingFromBooks.length > 0 && (
            <>
              <p className="report-section-title">On the portal, not in your books - a bill you may not have entered</p>
              <table>
                <thead><tr><th>Vendor</th><th>GSTIN</th><th>Invoice No.</th><th>Date</th><th className="amt">Taxable</th></tr></thead>
                <tbody>
                  {result.missingFromBooks.map((row, index) => (
                    <tr key={`${row.gstin}-${row.invoiceNumber}-${index}`}>
                      <td>{row.vendorName || '-'}</td>
                      <td>{row.gstin}</td>
                      <td>{row.invoiceNumber}</td>
                      <td>{row.invoiceDate || '-'}</td>
                      <td className="amt">{money(row.taxableValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </>
  )
}

// A worksheet for GSTR-3B - the return tax actually gets paid through,
// filled in directly on the portal rather than uploaded as a file like
// GSTR-1. Built from the same sales/purchase totals GSTR-1 and Purchase
// Register already use, so there's nothing new to reconcile - just copy
// the numbers across. See buildGstr3b in src/lib/gstr3b.js for exactly
// what Table 4's "All other ITC" does and doesn't cover, and for the
// IGST-first set-off order Table 6.1's cash-payable figures follow.
function Gstr3bSummary({ invoices, bills, creditNotes, debitNotes, customers, items }) {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const worksheet = buildGstr3b(invoices, bills, creditNotes, debitNotes, customers, items, from, to)
  const { outwardSupplies, interstateSupplies, itcAvailable, setOff } = worksheet

  const totalCash = round2(setOff.cashIgst + setOff.cashCgst + setOff.cashSgst)
  const totalItcCarried = round2(setOff.itcCarriedForward.igst + setOff.itcCarriedForward.cgst + setOff.itcCarriedForward.sgst)

  const exportCsv = () => {
    downloadCsv(`gstr3b-worksheet-${from}-to-${to}.csv`, [
      ['Table 3.1(a) - Outward taxable supplies', 'Taxable Value', 'IGST', 'CGST', 'SGST'],
      ['', amt(outwardSupplies.taxable), amt(outwardSupplies.igst), amt(outwardSupplies.cgst), amt(outwardSupplies.sgst)],
      [],
      ['Table 3.2 - Interstate supplies to unregistered persons', 'Place of Supply', 'Taxable Value', 'IGST'],
      ...interstateSupplies.map((row) => ['', row.stateName, amt(row.taxable), amt(row.igst)]),
      [],
      ['Table 4 - Eligible ITC (All other ITC)', 'IGST', 'CGST', 'SGST'],
      ['', amt(itcAvailable.igst), amt(itcAvailable.cgst), amt(itcAvailable.sgst)],
      [],
      ['Table 6.1 - Payment of tax', 'IGST', 'CGST', 'SGST', 'Total'],
      ['Tax payable', amt(outwardSupplies.igst), amt(outwardSupplies.cgst), amt(outwardSupplies.sgst), amt(round2(outwardSupplies.igst + outwardSupplies.cgst + outwardSupplies.sgst))],
      ['Paid through ITC', amt(round2(outwardSupplies.igst - setOff.cashIgst)), amt(round2(outwardSupplies.cgst - setOff.cashCgst)), amt(round2(outwardSupplies.sgst - setOff.cashSgst)), amt(round2(outwardSupplies.igst + outwardSupplies.cgst + outwardSupplies.sgst - totalCash))],
      ['Paid in cash', amt(setOff.cashIgst), amt(setOff.cashCgst), amt(setOff.cashSgst), amt(totalCash)],
      ['ITC carried forward', amt(setOff.itcCarriedForward.igst), amt(setOff.itcCarriedForward.cgst), amt(setOff.itcCarriedForward.sgst), amt(totalItcCarried)],
    ])
  }

  return (
    <>
      <div className="journal-header-row">
        <label>From <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>
      <p className="section-sub">
        A worksheet to copy into the GSTR-3B form on the GST portal, not something you upload - 3B is filled in
        directly there. Covers what this app tracks: outward supplies, interstate B2C by state, and ITC from bills
        (as one "all other ITC" figure - imports, reverse charge, and ISD credit aren&apos;t tracked here). Check the
        portal&apos;s own set-off calculation against Table 6.1 below before you pay.
      </p>
      <ExportButton onClick={exportCsv} />
      <div className="report-summary">
        <div className="report-stat">
          <div className="report-stat-label">Tax Payable</div>
          <div className="report-stat-value">{money(round2(outwardSupplies.igst + outwardSupplies.cgst + outwardSupplies.sgst))}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">ITC Available</div>
          <div className="report-stat-value">{money(round2(itcAvailable.igst + itcAvailable.cgst + itcAvailable.sgst))}</div>
        </div>
        <div className="report-stat">
          <div className="report-stat-label">Net Payable in Cash</div>
          <div className={`report-stat-value ${totalCash > 0 ? 'red' : 'green'}`}>{money(totalCash)}</div>
        </div>
      </div>

      <p className="report-section-title">Table 3.1(a) - Outward taxable supplies</p>
      <table>
        <thead><tr><th className="amt">Taxable value</th><th className="amt">IGST</th><th className="amt">CGST</th><th className="amt">SGST</th></tr></thead>
        <tbody>
          <tr>
            <td className="amt">{money(outwardSupplies.taxable)}</td>
            <td className="amt">{money(outwardSupplies.igst)}</td>
            <td className="amt">{money(outwardSupplies.cgst)}</td>
            <td className="amt">{money(outwardSupplies.sgst)}</td>
          </tr>
        </tbody>
      </table>

      <p className="report-section-title">Table 3.2 - Interstate supplies to unregistered persons</p>
      <table>
        <thead><tr><th>Place of Supply</th><th className="amt">Taxable Value</th><th className="amt">IGST</th></tr></thead>
        <tbody>
          {interstateSupplies.map((row) => (
            <tr key={row.pos}>
              <td>{row.stateName}</td>
              <td className="amt">{money(row.taxable)}</td>
              <td className="amt">{money(row.igst)}</td>
            </tr>
          ))}
          {interstateSupplies.length === 0 && <tr><td colSpan={3} className="empty-note">No interstate supplies to unregistered customers in this period.</td></tr>}
        </tbody>
      </table>

      <p className="report-section-title">Table 4 - Eligible ITC (All other ITC)</p>
      <table>
        <thead><tr><th className="amt">IGST</th><th className="amt">CGST</th><th className="amt">SGST</th></tr></thead>
        <tbody>
          <tr>
            <td className="amt">{money(itcAvailable.igst)}</td>
            <td className="amt">{money(itcAvailable.cgst)}</td>
            <td className="amt">{money(itcAvailable.sgst)}</td>
          </tr>
        </tbody>
      </table>

      <p className="report-section-title">Table 6.1 - Payment of tax</p>
      <table>
        <thead><tr><th></th><th className="amt">IGST</th><th className="amt">CGST</th><th className="amt">SGST</th></tr></thead>
        <tbody>
          <tr>
            <td>Tax payable</td>
            <td className="amt">{money(outwardSupplies.igst)}</td>
            <td className="amt">{money(outwardSupplies.cgst)}</td>
            <td className="amt">{money(outwardSupplies.sgst)}</td>
          </tr>
          <tr>
            <td>Paid through ITC</td>
            <td className="amt">{money(round2(outwardSupplies.igst - setOff.cashIgst))}</td>
            <td className="amt">{money(round2(outwardSupplies.cgst - setOff.cashCgst))}</td>
            <td className="amt">{money(round2(outwardSupplies.sgst - setOff.cashSgst))}</td>
          </tr>
          <tr>
            <td>Paid in cash</td>
            <td className="amt">{money(setOff.cashIgst)}</td>
            <td className="amt">{money(setOff.cashCgst)}</td>
            <td className="amt">{money(setOff.cashSgst)}</td>
          </tr>
          <tr>
            <td>ITC carried forward</td>
            <td className="amt">{money(setOff.itcCarriedForward.igst)}</td>
            <td className="amt">{money(setOff.itcCarriedForward.cgst)}</td>
            <td className="amt">{money(setOff.itcCarriedForward.sgst)}</td>
          </tr>
        </tbody>
      </table>
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

export default function Reports({ accounts, entries, invoices, bills, creditNotes, debitNotes, items, customers, vendors, org }) {
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
        <button className={tab === 'purchaseRegister' ? 'active' : ''} onClick={() => setTab('purchaseRegister')}>Purchase Register</button>
        <button className={tab === 'gstr2b' ? 'active' : ''} onClick={() => setTab('gstr2b')}>GSTR-2B Match</button>
        <button className={tab === 'gstr3b' ? 'active' : ''} onClick={() => setTab('gstr3b')}>GSTR-3B Summary</button>
        <button className={tab === 'aging' ? 'active' : ''} onClick={() => setTab('aging')}>Aging</button>
      </div>
      {tab === 'trial' && <TrialBalance accounts={accounts} entries={entries} />}
      {tab === 'pnl' && <ProfitAndLoss accounts={accounts} entries={entries} />}
      {tab === 'bs' && <BalanceSheet accounts={accounts} entries={entries} />}
      {tab === 'gst' && <GstSummary invoices={invoices} bills={bills} creditNotes={creditNotes} debitNotes={debitNotes} items={items} />}
      {tab === 'gstr1' && <Gstr1Export invoices={invoices} creditNotes={creditNotes} customers={customers} items={items} org={org} />}
      {tab === 'purchaseRegister' && <PurchaseRegister bills={bills} debitNotes={debitNotes} vendors={vendors} items={items} />}
      {tab === 'gstr2b' && <Gstr2bMatch bills={bills} vendors={vendors} />}
      {tab === 'gstr3b' && <Gstr3bSummary invoices={invoices} bills={bills} creditNotes={creditNotes} debitNotes={debitNotes} customers={customers} items={items} />}
      {tab === 'aging' && <Aging invoices={invoices} bills={bills} />}
    </div>
  )
}
