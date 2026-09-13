import { useState } from 'react'
import { calcGst, round2, RECURRING_FREQUENCIES } from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '', itemId: null })
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A saved template for a sales invoice that repeats on a schedule (a
// monthly retainer, a weekly service, etc). This screen only manages the
// template - actually generating the next invoice when it comes due
// happens once in App.jsx (see the recurring-generation effect there), so
// it works no matter which screen is open when the due date arrives, not
// only while this one is. It still needs someone to open the app on or
// after that date - there's no server here to fire it while nobody's
// looking.
export default function Recurring({ orgId, templates, customers, items }) {
  const [partyName, setPartyName] = useState('')
  const [lineItems, setLineItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

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
    if (endDate && endDate < startDate) { setError('End date must be after the start date.'); return }

    if (!customers.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, 'customers', { name: trimmedName })
    }

    await addOrgDoc(orgId, 'recurringTemplates', {
      partyName: trimmedName,
      items: lineItems.filter((item) => (Number(item.qty) || 0) > 0 && (Number(item.rate) || 0) > 0),
      gstPercent: Number(gstPercent) || 0,
      interState,
      frequency,
      startDate,
      nextRunDate: startDate,
      endDate: endDate || null,
      active: true,
      generatedCount: 0,
      lastGeneratedDate: null,
    })

    setPartyName('')
    setLineItems([blankItem()])
    setEndDate('')
  }

  const toggleActive = (template) => setOrgDoc(orgId, 'recurringTemplates', template.id, { active: !template.active })

  const frequencyLabel = (value) => RECURRING_FREQUENCIES.find((option) => option.value === value)?.label || value

  return (
    <div className="panel">
      <h2>Recurring Invoices</h2>
      <p className="section-sub">
        A template that generates a new Sales Invoice automatically the next time you open Khata Cloud on or after its due date - handy for monthly retainers or subscriptions.
      </p>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            Customer
            <input
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              placeholder="Customer"
              list="recurring-contacts"
            />
            <datalist id="recurring-contacts">
              {customers.map((contact) => <option key={contact.id} value={contact.name} />)}
            </datalist>
          </label>
          <label>
            Repeats
            <select value={frequency} onChange={(event) => setFrequency(event.target.value)}>
              {RECURRING_FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Starts
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </label>
          <label>
            Ends (optional)
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate} />
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
        <button type="submit">Save recurring template</button>
      </form>

      <h3>Active templates</h3>
      {templates.length === 0 && <p className="empty-note">No recurring invoices set up yet.</p>}
      <div className="voucher-list">
        {templates.map((template) => (
          <div key={template.id} className={`voucher-card ${!template.active ? 'voided' : ''}`}>
            <div className="voucher-header">
              <div className="voucher-header-main">
                <div className="voucher-icon src-invoice"><Icon name="repeat" size={15} /></div>
                <div className="voucher-header-text">
                  <span className="voucher-badge">{frequencyLabel(template.frequency)}</span>
                  <span className="voucher-date">{template.partyName}</span>
                  {!template.active && <span className="tag tag-void">paused</span>}
                </div>
              </div>
              <div className="voucher-amount">
                {money(round2(template.items.reduce((total, item) => total + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0) * (1 + (Number(template.gstPercent) || 0) / 100)))}
              </div>
            </div>
            <p className="voucher-narration">
              {template.active ? `Next invoice: ${template.nextRunDate}` : 'Paused'}
              {template.generatedCount > 0 && ` · ${template.generatedCount} generated so far`}
              {template.endDate && ` · ends ${template.endDate}`}
            </p>
            <div className="action-pills">
              <button type="button" className={`action-pill ${template.active ? 'danger' : 'success'}`} onClick={() => toggleActive(template)}>
                <Icon name={template.active ? 'pause' : 'play'} size={13} />
                {template.active ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
