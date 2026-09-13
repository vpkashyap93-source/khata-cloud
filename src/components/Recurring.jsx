import { useState } from 'react'
import { calcGst, round2, RECURRING_FREQUENCIES } from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '', itemId: null })
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// A saved template for a Sales Invoice or Purchase Bill that repeats on a
// schedule (a monthly retainer, rent, a subscription, etc). This screen
// only manages the template - actually generating the next document when
// it comes due happens once in App.jsx (see the recurring-generation
// effect there), so it works no matter which screen is open when the due
// date arrives, not only while this one is. It still needs someone to open
// the app on or after that date - there's no server here to fire it while
// nobody's looking. Shared between Recurring Invoices and Recurring Bills
// the same way Invoicing.jsx shares one form between the two document
// types - only the party/collection labels differ.
function RecurringTemplates({ orgId, templates, contacts, items, config }) {
  const [partyName, setPartyName] = useState('')
  const [lineItems, setLineItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const scopedTemplates = templates.filter((template) => (template.docType || 'invoice') === config.docType)

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
    if (!trimmedName) { setError(`Enter a ${config.partyLabel.toLowerCase()} name.`); return }
    if (subtotal <= 0) { setError('Add at least one line item with an amount.'); return }
    if (endDate && endDate < startDate) { setError('End date must be after the start date.'); return }

    if (!contacts.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, config.contactsCollection, { name: trimmedName })
    }

    await addOrgDoc(orgId, 'recurringTemplates', {
      docType: config.docType,
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
      <h2>{config.title}</h2>
      <p className="section-sub">
        A template that generates a new {config.docWord} automatically the next time you open Khata Cloud on or after its due date - handy for {config.examples}.
      </p>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            {config.partyLabel}
            <input
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              placeholder={config.partyLabel}
              list={`recurring-${config.docType}-contacts`}
            />
            <datalist id={`recurring-${config.docType}-contacts`}>
              {contacts.map((contact) => <option key={contact.id} value={contact.name} />)}
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
      {scopedTemplates.length === 0 && <p className="empty-note">No {config.title.toLowerCase()} set up yet.</p>}
      <div className="voucher-list">
        {scopedTemplates.map((template) => (
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
              {template.active ? `Next ${config.docWord.toLowerCase()}: ${template.nextRunDate}` : 'Paused'}
              {template.generatedCount > 0 && ` · ${template.generatedCount} generated so far`}
              {template.endDate && ` · ends ${template.endDate}`}
              {template.createdBy && <span className="voucher-by"> · set up by {template.createdBy}</span>}
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

export function RecurringInvoices({ orgId, templates, customers, items }) {
  return (
    <RecurringTemplates
      orgId={orgId}
      templates={templates}
      contacts={customers}
      items={items}
      config={{
        docType: 'invoice',
        partyLabel: 'Customer',
        contactsCollection: 'customers',
        title: 'Recurring Invoices',
        docWord: 'Sales Invoice',
        examples: 'monthly retainers or subscriptions you bill customers',
      }}
    />
  )
}

export function RecurringBills({ orgId, templates, vendors, items }) {
  return (
    <RecurringTemplates
      orgId={orgId}
      templates={templates}
      contacts={vendors}
      items={items}
      config={{
        docType: 'bill',
        partyLabel: 'Vendor',
        contactsCollection: 'vendors',
        title: 'Recurring Bills',
        docWord: 'Purchase Bill',
        examples: 'rent, software subscriptions, or any vendor charge that repeats',
      }}
    />
  )
}
