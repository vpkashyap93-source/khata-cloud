import { useState } from 'react'
import { calcGst, buildInvoiceJournalLines, computeDueDate, round2 } from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '', itemId: null })
const money = (value) => Number(value || 0).toFixed(2)

function PrintEstimate({ estimate, org, onClose }) {
  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" className="link-button" onClick={onClose}>Close</button>
      </div>
      <div className="print-sheet">
        <div className="print-letterhead">
          <div>
            <h1>{org.name || 'Your Business'}</h1>
            {org.address && <p>{org.address}</p>}
            <p>{[org.phone, org.email].filter(Boolean).join(' · ')}</p>
            {org.gstin && <p>GSTIN: {org.gstin}</p>}
          </div>
          <div className="print-doc-meta">
            <h2>Estimate</h2>
            <p>{estimate.number}</p>
            <p>{estimate.date}</p>
          </div>
        </div>
        <div className="print-party">
          <span className="print-label">Customer</span>
          <div>{estimate.partyName}</div>
        </div>
        <table className="print-items">
          <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            {(estimate.items || []).map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{item.qty}</td>
                <td>{money(item.rate)}</td>
                <td>{money((Number(item.qty) || 0) * (Number(item.rate) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="print-totals">
          <div><span>Subtotal</span><span>{money(estimate.taxable)}</span></div>
          {estimate.interState
            ? <div><span>IGST</span><span>{money(estimate.igst)}</span></div>
            : <><div><span>CGST</span><span>{money(estimate.cgst)}</span></div><div><span>SGST</span><span>{money(estimate.sgst)}</span></div></>}
          <div className="print-grand-total"><span>Total</span><span>{money(estimate.total)}</span></div>
        </div>
        <p className="print-label" style={{ marginTop: 18 }}>This is an estimate, not a tax invoice. Prices may change until accepted.</p>
      </div>
    </div>
  )
}

// A quote sent before a sale - same shape as a Sales Invoice (party, line
// items, GST) but with no accounting effect of its own. Only once it's
// converted does it post a real invoice and journal entry, via the exact
// same buildInvoiceJournalLines the Invoices screen uses.
export default function Estimates({ orgId, accounts, estimates, invoices, customers, items, org }) {
  const [partyName, setPartyName] = useState('')
  const [date, setDate] = useState(today())
  const [lineItems, setLineItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [error, setError] = useState('')
  const [printingEstimate, setPrintingEstimate] = useState(null)

  const updateItem = (index, field, value) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  const applyCatalogItem = (index, itemId) => {
    const picked = items.find((item) => item.id === itemId)
    if (!picked) return
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, description: picked.name, rate: picked.rate, itemId } : item)))
    setGstPercent(picked.gstPercent)
  }
  const addItem = () => setLineItems((prev) => [...prev, blankItem()])
  const removeItem = (index) => setLineItems((prev) => prev.filter((_, i) => i !== index))

  const subtotal = round2(lineItems.reduce((total, item) => total + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0))
  const gst = calcGst(subtotal, gstPercent, interState)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const trimmedName = partyName.trim()
    if (!trimmedName) { setError('Enter a customer name.'); return }
    if (subtotal <= 0) { setError('Add at least one line item with an amount.'); return }

    if (!customers.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, 'customers', { name: trimmedName })
    }

    const number = `EST-${String(estimates.length + 1).padStart(4, '0')}`
    await addOrgDoc(orgId, 'estimates', {
      number,
      date,
      partyName: trimmedName,
      items: lineItems.filter((item) => (Number(item.qty) || 0) > 0 && (Number(item.rate) || 0) > 0),
      gstPercent: Number(gstPercent) || 0,
      interState,
      convertedInvoiceId: null,
      ...gst,
    })
    setPartyName('')
    setLineItems([blankItem()])
  }

  const convertToInvoice = async (estimate) => {
    if (!window.confirm(`Convert ${estimate.number} to a sales invoice for ${estimate.partyName}?`)) return
    const invoiceGst = { taxable: estimate.taxable, cgst: estimate.cgst, sgst: estimate.sgst, igst: estimate.igst, total: estimate.total }
    const prefix = org.invoicePrefix || 'INV'
    const number = `${prefix}-${String(invoices.length + 1).padStart(4, '0')}`
    const lines = buildInvoiceJournalLines(accounts, invoiceGst)
    const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
      date: today(),
      narration: `Invoice ${number} - ${estimate.partyName} (from ${estimate.number})`,
      lines,
      source: 'invoice',
    })
    const invoiceId = await addOrgDoc(orgId, 'invoices', {
      number,
      date: today(),
      dueDate: computeDueDate({ date: today() }, org.paymentTermDays),
      partyName: estimate.partyName,
      items: estimate.items,
      gstPercent: estimate.gstPercent,
      interState: estimate.interState,
      amountPaid: 0,
      adjustedAmount: 0,
      estimateId: estimate.id,
      journalEntryId,
      ...invoiceGst,
    })
    await setOrgDoc(orgId, 'estimates', estimate.id, { convertedInvoiceId: invoiceId })
  }

  return (
    <div className="panel">
      <h2>Estimates</h2>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            Customer
            <input
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              placeholder="Customer"
              list="estimate-contacts"
            />
            <datalist id="estimate-contacts">
              {customers.map((contact) => <option key={contact.id} value={contact.name} />)}
            </datalist>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Description</th><th className="amt">Qty</th><th className="amt">Rate</th><th className="amt">Amount</th><th /></tr></thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={index}>
                <td>
                  <select onChange={(event) => applyCatalogItem(index, event.target.value)} defaultValue="">
                    <option value="" disabled>Pick...</option>
                    {items.map((catalogItem) => <option key={catalogItem.id} value={catalogItem.id}>{catalogItem.name}</option>)}
                  </select>
                </td>
                <td><input value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} /></td>
                <td><input className="amt-input" type="number" min="0" step="1" value={item.qty} onChange={(event) => updateItem(index, 'qty', event.target.value)} /></td>
                <td><input className="amt-input" type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateItem(index, 'rate', event.target.value)} /></td>
                <td className="amt">{round2((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2)}</td>
                <td>{lineItems.length > 1 && <button type="button" className="link-button" onClick={() => removeItem(index)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="link-button" onClick={addItem}>+ Add item</button>

        <div className="journal-header-row">
          <label>
            GST %
            <input type="number" min="0" max="28" step="0.1" value={gstPercent} onChange={(event) => setGstPercent(event.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={interState} onChange={(event) => setInterState(event.target.checked)} />
            Inter-state (IGST)
          </label>
        </div>

        <div className="totals-box">
          <div>Subtotal: {subtotal.toFixed(2)}</div>
          {interState ? <div>IGST: {gst.igst.toFixed(2)}</div> : <div>CGST: {gst.cgst.toFixed(2)} + SGST: {gst.sgst.toFixed(2)}</div>}
          <div className="grand-total">Total: {gst.total.toFixed(2)}</div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button type="submit">Save estimate</button>
      </form>

      <h3>Recent estimates</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Customer</th><th className="amt">Total</th><th>Status</th><th /></tr></thead>
        <tbody>
          {estimates.map((estimate) => (
            <tr key={estimate.id}>
              <td>{estimate.number}</td>
              <td>{estimate.date}</td>
              <td>{estimate.partyName}</td>
              <td className="amt">{Number(estimate.total).toFixed(2)}</td>
              <td>
                <span className={`status-pill ${estimate.convertedInvoiceId ? 'paid' : 'due'}`}>
                  {estimate.convertedInvoiceId ? 'converted' : 'draft'}
                </span>
              </td>
              <td>
                <div className="action-pills">
                  <button type="button" className="action-pill" onClick={() => setPrintingEstimate(estimate)}><Icon name="print" size={13} />Print</button>
                  {!estimate.convertedInvoiceId && (
                    <button type="button" className="action-pill success" onClick={() => convertToInvoice(estimate)}><Icon name="invoices" size={13} />Convert to Invoice</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {estimates.length === 0 && <tr><td colSpan={6}>No estimates yet.</td></tr>}
        </tbody>
      </table>

      {printingEstimate && <PrintEstimate estimate={printingEstimate} org={org} onClose={() => setPrintingEstimate(null)} />}
    </div>
  )
}
