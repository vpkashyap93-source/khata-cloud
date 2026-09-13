import { useState } from 'react'
import { calcGst, buildBillJournalLines, computeDueDate, round2 } from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '', itemId: null })
const money = (value) => Number(value || 0).toFixed(2)

function PrintPurchaseOrder({ order, org, onClose }) {
  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" className="link-button" onClick={onClose}>Close</button>
      </div>
      <div className="print-sheet">
        <div className="print-letterhead">
          <div>
            {org.logoDataUrl && <img src={org.logoDataUrl} alt="" className="print-logo" />}
            <h1>{org.name || 'Your Business'}</h1>
            {org.address && <p>{org.address}</p>}
            <p>{[org.phone, org.email].filter(Boolean).join(' · ')}</p>
            {org.gstin && <p>GSTIN: {org.gstin}</p>}
          </div>
          <div className="print-doc-meta">
            <h2>Purchase Order</h2>
            <p>{order.number}</p>
            <p>{order.date}</p>
          </div>
        </div>
        <div className="print-party">
          <span className="print-label">Vendor</span>
          <div>{order.partyName}</div>
        </div>
        <table className="print-items">
          <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            {(order.items || []).map((item, index) => (
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
          <div><span>Subtotal</span><span>{money(order.taxable)}</span></div>
          {order.interState
            ? <div><span>IGST</span><span>{money(order.igst)}</span></div>
            : <><div><span>CGST</span><span>{money(order.cgst)}</span></div><div><span>SGST</span><span>{money(order.sgst)}</span></div></>}
          <div className="print-grand-total"><span>Total</span><span>{money(order.total)}</span></div>
        </div>
        <p className="print-label" style={{ marginTop: 18 }}>This is a purchase order, not a bill. Amounts are what's being ordered, not yet owed.</p>
      </div>
    </div>
  )
}

// An order placed with a vendor before a bill - same shape as a Purchase
// Bill (party, line items, GST) but with no accounting effect of its own.
// Only once the vendor confirms and goods/services arrive does it convert
// to a real bill and journal entry, via the exact same
// buildBillJournalLines the Bills screen uses - the purchase-side mirror
// of Estimates -> Invoice.
export default function PurchaseOrders({ orgId, accounts, purchaseOrders, bills, vendors, items, org }) {
  const [partyName, setPartyName] = useState('')
  const [date, setDate] = useState(today())
  const [lineItems, setLineItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [error, setError] = useState('')
  const [printingOrder, setPrintingOrder] = useState(null)

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
    if (!trimmedName) { setError('Enter a vendor name.'); return }
    if (subtotal <= 0) { setError('Add at least one line item with an amount.'); return }

    if (!vendors.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, 'vendors', { name: trimmedName })
    }

    const number = `PO-${String(purchaseOrders.length + 1).padStart(4, '0')}`
    await addOrgDoc(orgId, 'purchaseOrders', {
      number,
      date,
      partyName: trimmedName,
      items: lineItems.filter((item) => (Number(item.qty) || 0) > 0 && (Number(item.rate) || 0) > 0),
      gstPercent: Number(gstPercent) || 0,
      interState,
      convertedBillId: null,
      ...gst,
    })
    setPartyName('')
    setLineItems([blankItem()])
  }

  const convertToBill = async (order) => {
    if (!window.confirm(`Convert ${order.number} to a purchase bill from ${order.partyName}?`)) return
    const billGst = { taxable: order.taxable, cgst: order.cgst, sgst: order.sgst, igst: order.igst, total: order.total }
    const prefix = org.billPrefix || 'BILL'
    const number = `${prefix}-${String(bills.length + 1).padStart(4, '0')}`
    const lines = buildBillJournalLines(accounts, billGst)
    const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
      date: today(),
      narration: `Bill ${number} - ${order.partyName} (from ${order.number})`,
      lines,
      source: 'bill',
    })
    const billId = await addOrgDoc(orgId, 'bills', {
      number,
      date: today(),
      dueDate: computeDueDate({ date: today() }, org.paymentTermDays),
      partyName: order.partyName,
      items: order.items,
      gstPercent: order.gstPercent,
      interState: order.interState,
      amountPaid: 0,
      adjustedAmount: 0,
      purchaseOrderId: order.id,
      journalEntryId,
      ...billGst,
    })
    await setOrgDoc(orgId, 'purchaseOrders', order.id, { convertedBillId: billId })
  }

  return (
    <div className="panel">
      <h2>Purchase Orders</h2>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            Vendor
            <input
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              placeholder="Vendor"
              list="po-contacts"
            />
            <datalist id="po-contacts">
              {vendors.map((contact) => <option key={contact.id} value={contact.name} />)}
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
        <button type="submit">Save purchase order</button>
      </form>

      <h3>Recent purchase orders</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Vendor</th><th className="amt">Total</th><th>Status</th><th /></tr></thead>
        <tbody>
          {purchaseOrders.map((order) => (
            <tr key={order.id}>
              <td>{order.number}</td>
              <td>{order.date}</td>
              <td>{order.partyName}</td>
              <td className="amt">{Number(order.total).toFixed(2)}</td>
              <td>
                <span className={`status-pill ${order.convertedBillId ? 'paid' : 'due'}`}>
                  {order.convertedBillId ? 'converted' : 'open'}
                </span>
              </td>
              <td>
                <div className="action-pills">
                  <button type="button" className="action-pill" onClick={() => setPrintingOrder(order)}><Icon name="print" size={13} />Print</button>
                  {!order.convertedBillId && (
                    <button type="button" className="action-pill success" onClick={() => convertToBill(order)}><Icon name="bills" size={13} />Convert to Bill</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {purchaseOrders.length === 0 && <tr><td colSpan={6} className="empty-note">No purchase orders yet.</td></tr>}
        </tbody>
      </table>

      {printingOrder && <PrintPurchaseOrder order={printingOrder} org={org} onClose={() => setPrintingOrder(null)} />}
    </div>
  )
}
