import { useState } from 'react'
import { addOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, itemId: null })

const PURPOSES = [
  'For approval',
  'Job work',
  'Sample',
  'Returnable - on loan',
  'Other',
]

function PrintChallan({ challan, org, onClose }) {
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
            <h2>Delivery Challan</h2>
            <p>{challan.number}</p>
            <p>{challan.date}</p>
          </div>
        </div>
        <div className="print-party">
          <span className="print-label">Delivered to</span>
          <div>{challan.partyName}</div>
        </div>
        <p className="print-label">Purpose: {challan.purpose}</p>
        <table className="print-items">
          <thead><tr><th>Description</th><th>Qty</th></tr></thead>
          <tbody>
            {(challan.items || []).map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{item.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {challan.remarks && <p className="print-label" style={{ marginTop: 12 }}>Remarks: {challan.remarks}</p>}
        <p className="print-label" style={{ marginTop: 18 }}>
          This is a delivery challan for goods sent - not a tax invoice, and no amount is due against it.
        </p>
      </div>
    </div>
  )
}

// A record of goods physically leaving the premises without a sale - for
// approval, job work, a sample, or on returnable loan - so no GST and no
// accounting effect (no journal entry, no Accounts Receivable). Tracked
// items still get a stock movement though, since the goods really did
// leave - stock-on-hand needs to reflect that whether or not it was ever
// invoiced.
export default function DeliveryChallan({ orgId, challans, customers, items, org }) {
  const [partyName, setPartyName] = useState('')
  const [date, setDate] = useState(today())
  const [purpose, setPurpose] = useState(PURPOSES[0])
  const [remarks, setRemarks] = useState('')
  const [lineItems, setLineItems] = useState([blankItem()])
  const [error, setError] = useState('')
  const [printingChallan, setPrintingChallan] = useState(null)

  const updateItem = (index, field, value) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  const applyCatalogItem = (index, itemId) => {
    const picked = items.find((item) => item.id === itemId)
    if (!picked) return
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, description: picked.name, itemId } : item)))
  }
  const addItem = () => setLineItems((prev) => [...prev, blankItem()])
  const removeItem = (index) => setLineItems((prev) => prev.filter((_, i) => i !== index))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const trimmedName = partyName.trim()
    if (!trimmedName) { setError('Enter a customer name.'); return }
    const savedItems = lineItems.filter((item) => item.description.trim() && (Number(item.qty) || 0) > 0)
    if (savedItems.length === 0) { setError('Add at least one item with a description and quantity.'); return }

    if (!customers.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, 'customers', { name: trimmedName })
    }

    const number = `DC-${String(challans.length + 1).padStart(4, '0')}`
    await addOrgDoc(orgId, 'deliveryChallans', {
      number,
      date,
      partyName: trimmedName,
      items: savedItems,
      purpose,
      remarks: remarks.trim(),
    })

    for (const line of savedItems) {
      if (!line.itemId) continue
      const catalogItem = items.find((item) => item.id === line.itemId)
      if (!catalogItem?.trackInventory) continue
      await addOrgDoc(orgId, 'stockMovements', {
        itemId: catalogItem.id,
        itemName: catalogItem.name,
        qty: -(Number(line.qty) || 0),
        type: 'challan',
        reason: `Delivery Challan ${number}`,
        date,
      })
    }

    setPartyName('')
    setRemarks('')
    setLineItems([blankItem()])
  }

  return (
    <div className="panel">
      <h2>Delivery Challans</h2>
      <p className="section-sub">
        Goods sent without a tax invoice - for approval, job work, a sample, or on returnable loan. No GST, no
        accounting effect, but tracked items still get a stock movement since the goods really did leave.
      </p>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            Customer
            <input
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              placeholder="Customer"
              list="challan-contacts"
            />
            <datalist id="challan-contacts">
              {customers.map((contact) => <option key={contact.id} value={contact.name} />)}
            </datalist>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label>
            Purpose
            <select value={purpose} onChange={(event) => setPurpose(event.target.value)}>
              {PURPOSES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <table>
          <thead><tr><th>Item</th><th>Description</th><th className="amt">Qty</th><th /></tr></thead>
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
                <td>{lineItems.length > 1 && <button type="button" className="link-button" onClick={() => removeItem(index)}>Remove</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="link-button" onClick={addItem}>+ Add item</button>

        <label>
          Remarks (optional)
          <input value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="e.g. vehicle number, driver name" />
        </label>

        {error && <p className="form-error">{error}</p>}
        <button type="submit">Save delivery challan</button>
      </form>

      <h3>Recent delivery challans</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Purpose</th><th>Items</th><th /></tr></thead>
        <tbody>
          {challans.map((challan) => (
            <tr key={challan.id}>
              <td>{challan.number}</td>
              <td>{challan.date}</td>
              <td>{challan.partyName}</td>
              <td>{challan.purpose}</td>
              <td>{(challan.items || []).length}</td>
              <td>
                <button type="button" className="action-pill" onClick={() => setPrintingChallan(challan)}><Icon name="print" size={13} />Print</button>
              </td>
            </tr>
          ))}
          {challans.length === 0 && <tr><td colSpan={6} className="empty-note">No delivery challans yet.</td></tr>}
        </tbody>
      </table>

      {printingChallan && <PrintChallan challan={printingChallan} org={org} onClose={() => setPrintingChallan(null)} />}
    </div>
  )
}
