import { useState } from 'react'
import { calcGst, buildInvoiceJournalLines, buildBillJournalLines, buildPaymentJournalLines, balanceDue, round2 } from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '' })
const money = (value) => Number(value || 0).toFixed(2)

function PrintView({ doc, org, config, onClose }) {
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
            <h2>{config.docLabel}</h2>
            <p>{doc.number}</p>
            <p>{doc.date}</p>
          </div>
        </div>
        <div className="print-party">
          <span className="print-label">{config.partyLabel}</span>
          <div>{doc.partyName}</div>
        </div>
        <table className="print-items">
          <thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            {(doc.items || []).map((item, index) => (
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
          <div><span>Subtotal</span><span>{money(doc.taxable)}</span></div>
          {doc.interState
            ? <div><span>IGST</span><span>{money(doc.igst)}</span></div>
            : <><div><span>CGST</span><span>{money(doc.cgst)}</span></div><div><span>SGST</span><span>{money(doc.sgst)}</span></div></>}
          <div className="print-grand-total"><span>Total</span><span>{money(doc.total)}</span></div>
          <div><span>Paid</span><span>{money(doc.amountPaid)}</span></div>
          <div className="print-grand-total"><span>Balance due</span><span>{money(balanceDue(doc).due)}</span></div>
        </div>
      </div>
    </div>
  )
}

function RecordPayment({ orgId, doc, accounts, config, onDone }) {
  const due = balanceDue(doc).due
  const [amount, setAmount] = useState(due)
  const [cashAccount, setCashAccount] = useState('Cash')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const value = round2(amount)
    if (value <= 0 || value > due) { setError(`Enter an amount up to ${due.toFixed(2)}.`); return }
    const lines = buildPaymentJournalLines(accounts, value, config.paymentDirection, cashAccount)
    await addOrgDoc(orgId, 'journalEntries', {
      date: today(),
      narration: `${config.paymentLabel} - ${doc.number} - ${doc.partyName}`,
      lines,
      source: 'payment',
    })
    await setOrgDoc(orgId, config.collectionName, doc.id, { amountPaid: round2((Number(doc.amountPaid) || 0) + value) })
    onDone()
  }

  return (
    <form className="payment-form" onSubmit={submit}>
      <input type="number" min="0" max={due} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <select value={cashAccount} onChange={(event) => setCashAccount(event.target.value)}>
        <option value="Cash">Cash</option>
        <option value="Bank">Bank</option>
      </select>
      <button type="submit">Save payment</button>
      <button type="button" className="link-button" onClick={onDone}>Cancel</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}

// Shared shape for a sales invoice and a purchase bill: both are a party +
// line items + a GST rate, and both post one balanced journal entry to
// Accounts Receivable/Payable on save - money received or paid out is
// recorded separately, later, via RecordPayment.
function DocumentForm({ orgId, accounts, documents, contacts, items, org, config }) {
  const [partyName, setPartyName] = useState('')
  const [date, setDate] = useState(today())
  const [lineItems, setLineItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [printingDoc, setPrintingDoc] = useState(null)

  const updateItem = (index, field, value) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }
  const applyCatalogItem = (index, itemId) => {
    const picked = items.find((item) => item.id === itemId)
    if (!picked) return
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, description: picked.name, rate: picked.rate } : item)))
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
    const missingAccount = config.requiredAccountNames.find(
      (accountName) => !accounts.some((account) => account.name === accountName),
    )
    if (missingAccount) { setError(`Missing "${missingAccount}" account - check Chart of Accounts.`); return }

    if (!contacts.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, config.contactsCollection, { name: trimmedName })
    }

    const prefix = org[config.prefixField] || config.numberPrefix
    const number = `${prefix}-${String(documents.length + 1).padStart(4, '0')}`
    const docData = {
      number,
      date,
      partyName: trimmedName,
      items: lineItems.filter((item) => (Number(item.qty) || 0) > 0 && (Number(item.rate) || 0) > 0),
      gstPercent: Number(gstPercent) || 0,
      interState,
      amountPaid: 0,
      ...gst,
    }
    const lines = config.buildLines(accounts, gst)
    const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
      date,
      narration: `${config.docLabel} ${number} - ${trimmedName}`,
      lines,
      source: config.source,
    })
    await addOrgDoc(orgId, config.collectionName, { ...docData, journalEntryId })
    setPartyName('')
    setLineItems([blankItem()])
  }

  return (
    <div className="panel">
      <h2>{config.title}</h2>
      <form className="journal-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            {config.partyLabel}
            <input
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              placeholder={config.partyLabel}
              list={`${config.collectionName}-contacts`}
            />
            <datalist id={`${config.collectionName}-contacts`}>
              {contacts.map((contact) => <option key={contact.id} value={contact.name} />)}
            </datalist>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
        </div>
        <table>
          <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th /></tr></thead>
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
                <td><input type="number" min="0" step="1" value={item.qty} onChange={(event) => updateItem(index, 'qty', event.target.value)} /></td>
                <td><input type="number" min="0" step="0.01" value={item.rate} onChange={(event) => updateItem(index, 'rate', event.target.value)} /></td>
                <td>{round2((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2)}</td>
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
        <button type="submit">{config.submitLabel}</button>
      </form>

      <h3>Recent {config.title.toLowerCase()}</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>{config.partyLabel}</th><th>Total</th><th>Balance due</th><th>Status</th><th /></tr></thead>
        <tbody>
          {documents.map((item) => {
            const { due, status } = balanceDue(item)
            return (
              <tr key={item.id}>
                <td>{item.number}</td>
                <td>{item.date}</td>
                <td>{item.partyName}</td>
                <td>{Number(item.total).toFixed(2)}</td>
                <td>{due.toFixed(2)}</td>
                <td><span className={`status-pill ${status === 'paid' ? 'paid' : status === 'partial' ? 'due' : 'overdue'}`}>{status}</span></td>
                <td>
                  <button type="button" className="link-button" onClick={() => setPrintingDoc(item)}>Print</button>
                  {status !== 'paid' && (
                    payingId === item.id
                      ? null
                      : <button type="button" className="link-button" onClick={() => setPayingId(item.id)}>Record payment</button>
                  )}
                </td>
              </tr>
            )
          })}
          {documents.map((item) => payingId === item.id && (
            <tr key={`pay-${item.id}`}>
              <td colSpan={7}>
                <RecordPayment orgId={orgId} doc={item} accounts={accounts} config={config} onDone={() => setPayingId(null)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {printingDoc && <PrintView doc={printingDoc} org={org} config={config} onClose={() => setPrintingDoc(null)} />}
    </div>
  )
}

export function Invoices({ orgId, accounts, invoices, customers, items, org }) {
  return (
    <DocumentForm
      orgId={orgId}
      accounts={accounts}
      documents={invoices}
      contacts={customers}
      items={items}
      org={org}
      config={{
        title: 'Sales Invoices',
        partyLabel: 'Customer',
        docLabel: 'Invoice',
        numberPrefix: 'INV',
        prefixField: 'invoicePrefix',
        collectionName: 'invoices',
        contactsCollection: 'customers',
        source: 'invoice',
        submitLabel: 'Save invoice',
        paymentLabel: 'Payment received',
        paymentDirection: 'receivable',
        requiredAccountNames: ['Accounts Receivable', 'Cash', 'Sales Revenue', 'GST Payable'],
        buildLines: buildInvoiceJournalLines,
      }}
    />
  )
}

export function Bills({ orgId, accounts, bills, vendors, items, org }) {
  return (
    <DocumentForm
      orgId={orgId}
      accounts={accounts}
      documents={bills}
      contacts={vendors}
      items={items}
      org={org}
      config={{
        title: 'Purchase Bills',
        partyLabel: 'Vendor',
        docLabel: 'Bill',
        numberPrefix: 'BILL',
        prefixField: 'billPrefix',
        collectionName: 'bills',
        contactsCollection: 'vendors',
        source: 'bill',
        submitLabel: 'Save bill',
        paymentLabel: 'Payment made',
        paymentDirection: 'payable',
        requiredAccountNames: ['Accounts Payable', 'Cash', 'Purchases', 'Input GST Credit'],
        buildLines: buildBillJournalLines,
      }}
    />
  )
}
