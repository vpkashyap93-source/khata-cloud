import { useState } from 'react'
import { calcGst, buildInvoiceJournalLines, buildBillJournalLines, round2 } from '../lib/accounting.js'
import { addOrgDoc } from '../firebase.js'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '' })

// Shared shape for a sales invoice and a purchase bill: both are a party +
// line items + a GST rate, and both post one balanced journal entry on
// save. `config` supplies the handful of things that differ between them.
function DocumentForm({ orgId, accounts, documents, config }) {
  const [partyName, setPartyName] = useState('')
  const [date, setDate] = useState(today())
  const [items, setItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [paidNow, setPaidNow] = useState(false)
  const [error, setError] = useState('')

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  const addItem = () => setItems((prev) => [...prev, blankItem()])
  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index))

  const subtotal = round2(items.reduce((total, item) => total + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0))
  const gst = calcGst(subtotal, gstPercent, interState)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!partyName.trim()) { setError(`Enter a ${config.partyLabel.toLowerCase()} name.`) ; return }
    if (subtotal <= 0) { setError('Add at least one line item with an amount.'); return }
    const missingAccount = config.requiredAccountNames.find(
      (accountName) => !accounts.some((account) => account.name === accountName),
    )
    if (missingAccount) { setError(`Missing "${missingAccount}" account - check Chart of Accounts.`); return }

    const number = `${config.numberPrefix}-${String(documents.length + 1).padStart(4, '0')}`
    const docData = {
      number,
      date,
      partyName: partyName.trim(),
      items: items.filter((item) => (Number(item.qty) || 0) > 0 && (Number(item.rate) || 0) > 0),
      gstPercent: Number(gstPercent) || 0,
      interState,
      paidNow,
      ...gst,
    }
    const lines = config.buildLines(accounts, gst, paidNow)
    const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
      date,
      narration: `${config.docLabel} ${number} - ${partyName.trim()}`,
      lines,
      source: config.source,
    })
    await addOrgDoc(orgId, config.collectionName, { ...docData, journalEntryId })
    setPartyName('')
    setItems([blankItem()])
  }

  return (
    <div className="panel">
      <h2>{config.title}</h2>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            {config.partyLabel}
            <input value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder={config.partyLabel} />
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
        </div>
        <table>
          <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th /></tr></thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td><input value={item.description} onChange={(event) => updateItem(index, 'description', event.target.value)} /></td>
                <td><input type="number" min="0" step="1" value={item.qty} onChange={(event) => updateItem(index, 'qty', event.target.value)} /></td>
                <td><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateItem(index, 'rate', event.target.value)} /></td>
                <td>{round2((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2)}</td>
                <td>{items.length > 1 && <button type="button" className="link-button" onClick={() => removeItem(index)}>Remove</button>}</td>
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
          <label className="checkbox-label">
            <input type="checkbox" checked={paidNow} onChange={(event) => setPaidNow(event.target.checked)} />
            {config.paidNowLabel}
          </label>
        </div>

        <div className="totals-box">
          <div>Subtotal: {subtotal.toFixed(2)}</div>
          {interState ? <div>IGST: {gst.igst.toFixed(2)}</div> : <div>CGST: {gst.cgst.toFixed(2)} + SGST: {gst.sgst.toFixed(2)}</div>}
          <div className="grand-total">Total: {gst.total.toFixed(2)}</div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button type="submit">{config.submitLabel}</button>
      </form>

      <h3>Recent {config.title.toLowerCase()}</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>{config.partyLabel}</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>
          {documents.map((item) => (
            <tr key={item.id}>
              <td>{item.number}</td>
              <td>{item.date}</td>
              <td>{item.partyName}</td>
              <td>{Number(item.total).toFixed(2)}</td>
              <td>{item.paidNow ? 'Paid' : config.unpaidLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Invoices({ orgId, accounts, invoices }) {
  return (
    <DocumentForm
      orgId={orgId}
      accounts={accounts}
      documents={invoices}
      config={{
        title: 'Sales Invoices',
        partyLabel: 'Customer',
        docLabel: 'Invoice',
        numberPrefix: 'INV',
        collectionName: 'invoices',
        source: 'invoice',
        submitLabel: 'Save invoice',
        paidNowLabel: 'Received in cash now',
        unpaidLabel: 'Receivable',
        requiredAccountNames: ['Accounts Receivable', 'Cash', 'Sales Revenue', 'GST Payable'],
        buildLines: buildInvoiceJournalLines,
      }}
    />
  )
}

export function Bills({ orgId, accounts, bills }) {
  return (
    <DocumentForm
      orgId={orgId}
      accounts={accounts}
      documents={bills}
      config={{
        title: 'Purchase Bills',
        partyLabel: 'Vendor',
        docLabel: 'Bill',
        numberPrefix: 'BILL',
        collectionName: 'bills',
        source: 'bill',
        submitLabel: 'Save bill',
        paidNowLabel: 'Paid in cash now',
        unpaidLabel: 'Payable',
        requiredAccountNames: ['Accounts Payable', 'Cash', 'Purchases', 'Input GST Credit'],
        buildLines: buildBillJournalLines,
      }}
    />
  )
}
