import { useState } from 'react'
import {
  calcGst,
  buildInvoiceJournalLines,
  buildBillJournalLines,
  buildPaymentJournalLines,
  buildCreditNoteJournalLines,
  buildDebitNoteJournalLines,
  balanceDue,
  creditableAmount,
  canVoid,
  reverseLines,
  round2,
  computeDueDate,
  isOverdue,
} from '../lib/accounting.js'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const blankItem = () => ({ description: '', qty: 1, rate: '', itemId: null })
const money = (value) => Number(value || 0).toFixed(2)

function PrintView({ doc, org, config, onClose }) {
  return (
    <div className="print-overlay">
      <div className="print-toolbar no-print">
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" className="link-button" onClick={onClose}>Close</button>
      </div>
      <div className="print-sheet">
        {doc.voided && <div className="print-watermark">VOID</div>}
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
            {doc.dueDate && <p>Due {doc.dueDate}</p>}
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
    <form className="voucher-form" onSubmit={submit}>
      <div className="voucher-form-title">Record payment - {doc.number}</div>
      <div className="journal-header-row">
        <label>
          Amount
          <input className="amt-input" type="number" min="0" max={due} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label>
          {config.paymentDirection === 'receivable' ? 'Received into' : 'Paid from'}
          <select value={cashAccount} onChange={(event) => setCashAccount(event.target.value)}>
            <option value="Cash">Cash</option>
            <option value="Bank">Bank</option>
          </select>
        </label>
        <span className="voucher-form-hint">Balance due: {due.toFixed(2)}</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="journal-header-row">
        <button type="submit">Save payment</button>
        <button type="button" className="link-button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

// A credit note (against an invoice) or debit note (against a bill) - a
// return or correction entered as a taxable amount, taxed at the original
// document's own GST rate so the reversal lines up with what was booked.
// It cannot exceed what's left of the document after any earlier notes.
function IssueNote({ orgId, doc, accounts, config, notesCount, onDone }) {
  const maxAmount = creditableAmount(doc)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const taxable = round2(amount)
    if (taxable <= 0) { setError('Enter an amount greater than zero.'); return }
    const gst = calcGst(taxable, doc.gstPercent, doc.interState)
    if (gst.total > maxAmount) { setError(`Cannot exceed ${maxAmount.toFixed(2)} (remaining value of ${doc.number}).`); return }

    const number = `${config.noteNumberPrefix}-${String(notesCount + 1).padStart(4, '0')}`
    const lines = config.buildNoteLines(accounts, gst)
    const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
      date: today(),
      narration: `${config.noteLabel} ${number} - against ${doc.number} - ${doc.partyName}`,
      lines,
      source: config.noteSource,
    })
    await addOrgDoc(orgId, config.notesCollection, {
      number,
      date: today(),
      docId: doc.id,
      docNumber: doc.number,
      partyName: doc.partyName,
      reason: reason.trim(),
      journalEntryId,
      ...gst,
    })
    await setOrgDoc(orgId, config.collectionName, doc.id, { adjustedAmount: round2((Number(doc.adjustedAmount) || 0) + gst.total) })
    onDone()
  }

  return (
    <form className="voucher-form" onSubmit={submit}>
      <div className="voucher-form-title">{config.noteLabel} against {doc.number}</div>
      <div className="journal-header-row">
        <label>
          Taxable amount
          <input className="amt-input" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <label className="grow">
          Reason
          <input placeholder="e.g. returned goods" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <span className="voucher-form-hint">Up to {maxAmount.toFixed(2)} remaining</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="journal-header-row">
        <button type="submit">Issue {config.noteLabel.toLowerCase()}</button>
        <button type="button" className="link-button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}

// Shared shape for a sales invoice and a purchase bill: both are a party +
// line items + a GST rate, and both post one balanced journal entry to
// Accounts Receivable/Payable on save - money received or paid out is
// recorded separately, later, via RecordPayment; returns/corrections via
// IssueNote. Selling or buying a tracked catalog item also posts a stock
// movement so Items' stock-on-hand stays accurate.
function DocumentForm({ orgId, accounts, documents, contacts, items, notes, entries, org, config }) {
  const [partyName, setPartyName] = useState('')
  const [date, setDate] = useState(today())
  const [dueDate, setDueDate] = useState(() => computeDueDate({ date: today() }, org.paymentTermDays))
  const [lineItems, setLineItems] = useState([blankItem()])
  const [gstPercent, setGstPercent] = useState(18)
  const [interState, setInterState] = useState(false)
  const [error, setError] = useState('')
  const [payingId, setPayingId] = useState(null)
  const [notingId, setNotingId] = useState(null)
  const [printingDoc, setPrintingDoc] = useState(null)

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
    const missingAccount = config.requiredAccountNames.find(
      (accountName) => !accounts.some((account) => account.name === accountName),
    )
    if (missingAccount) { setError(`Missing "${missingAccount}" account - check Chart of Accounts.`); return }

    if (!contacts.some((contact) => contact.name.toLowerCase() === trimmedName.toLowerCase())) {
      await addOrgDoc(orgId, config.contactsCollection, { name: trimmedName })
    }

    const savedItems = lineItems.filter((item) => (Number(item.qty) || 0) > 0 && (Number(item.rate) || 0) > 0)
    const prefix = org[config.prefixField] || config.numberPrefix
    const number = `${prefix}-${String(documents.length + 1).padStart(4, '0')}`
    const docData = {
      number,
      date,
      dueDate,
      partyName: trimmedName,
      items: savedItems,
      gstPercent: Number(gstPercent) || 0,
      interState,
      amountPaid: 0,
      adjustedAmount: 0,
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

    for (const line of savedItems) {
      if (!line.itemId) continue
      const catalogItem = items.find((item) => item.id === line.itemId)
      if (!catalogItem?.trackInventory) continue
      await addOrgDoc(orgId, 'stockMovements', {
        itemId: catalogItem.id,
        itemName: catalogItem.name,
        qty: config.stockSign * (Number(line.qty) || 0),
        type: config.source,
        reason: `${config.docLabel} ${number}`,
        date,
      })
    }

    setPartyName('')
    setLineItems([blankItem()])
    setDueDate(computeDueDate({ date: today() }, org.paymentTermDays))
  }

  const voidDocument = async (doc) => {
    const originalEntry = entries.find((entry) => entry.id === doc.journalEntryId)
    if (!originalEntry) return
    if (!window.confirm(`Void ${config.docLabel} ${doc.number}? A reversing entry will be posted - it stays in the books but nets to zero.`)) return
    await addOrgDoc(orgId, 'journalEntries', {
      date: today(),
      narration: `Void: ${config.docLabel} ${doc.number} - ${doc.partyName}`,
      lines: reverseLines(originalEntry.lines),
      source: 'void',
    })
    await setOrgDoc(orgId, config.collectionName, doc.id, { voided: true })
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
          <label>
            Due date
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
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
        <button type="submit">{config.submitLabel}</button>
      </form>

      <h3>Recent {config.title.toLowerCase()}</h3>
      <table>
        <thead><tr><th>#</th><th>Date</th><th>Due date</th><th>{config.partyLabel}</th><th className="amt">Total</th><th className="amt">Balance due</th><th>Status</th><th /></tr></thead>
        <tbody>
          {documents.map((item) => {
            const { due, status } = balanceDue(item)
            const canNote = !item.voided && creditableAmount(item) > 0
            const overdue = isOverdue(item)
            const pillClass = status === 'paid' ? 'paid' : status === 'void' ? 'void' : overdue ? 'overdue' : 'due'
            const statusLabel = status === 'paid' || status === 'void' ? status : overdue ? 'overdue' : status
            return (
              <tr key={item.id} className={item.voided ? 'voided-row' : ''}>
                <td>{item.number}</td>
                <td>{item.date}</td>
                <td className={overdue ? 'overdue-date' : ''}>{item.dueDate || computeDueDate(item)}</td>
                <td>{item.partyName}</td>
                <td className="amt">{Number(item.total).toFixed(2)}</td>
                <td className="amt">{due.toFixed(2)}</td>
                <td><span className={`status-pill ${pillClass}`}>{statusLabel}</span></td>
                <td>
                  <div className="action-pills">
                    <button type="button" className="action-pill" onClick={() => setPrintingDoc(item)}><Icon name="print" size={13} />Print</button>
                    {!item.voided && status !== 'paid' && payingId !== item.id && (
                      <button type="button" className="action-pill success" onClick={() => setPayingId(item.id)}><Icon name="payment" size={13} />Record payment</button>
                    )}
                    {config.showReminders && !item.voided && status !== 'paid' && (() => {
                      const contact = contacts.find((entry) => entry.name === item.partyName)
                      const message = `Hi ${item.partyName}, a reminder that ${config.docLabel} ${item.number} for Rs. ${due.toFixed(2)} is ${overdue ? 'overdue since' : 'due on'} ${item.dueDate || computeDueDate(item)}. Please arrange payment at your convenience. Thank you!`
                      const mailHref = `mailto:${contact?.email || ''}?subject=${encodeURIComponent(`Payment reminder - ${item.number}`)}&body=${encodeURIComponent(message)}`
                      const waDigits = (contact?.phone || '').replace(/\D/g, '')
                      return (
                        <>
                          <a className="action-pill info" href={mailHref}><Icon name="mail" size={13} />Email</a>
                          {waDigits && (
                            <a className="action-pill success" href={`https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                              <Icon name="chat" size={13} />WhatsApp
                            </a>
                          )}
                        </>
                      )
                    })()}
                    {canNote && notingId !== item.id && (
                      <button type="button" className="action-pill info" onClick={() => setNotingId(item.id)}><Icon name="note" size={13} />{config.noteLabel}</button>
                    )}
                    {canVoid(item) && (
                      <button type="button" className="action-pill danger" onClick={() => voidDocument(item)}><Icon name="void" size={13} />Void</button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {documents.map((item) => payingId === item.id && (
            <tr key={`pay-${item.id}`}>
              <td colSpan={8}>
                <RecordPayment orgId={orgId} doc={item} accounts={accounts} config={config} onDone={() => setPayingId(null)} />
              </td>
            </tr>
          ))}
          {documents.map((item) => notingId === item.id && (
            <tr key={`note-${item.id}`}>
              <td colSpan={8}>
                <IssueNote orgId={orgId} doc={item} accounts={accounts} config={config} notesCount={notes.length} onDone={() => setNotingId(null)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {notes.length > 0 && (
        <>
          <h3>{config.noteLabel}s issued</h3>
          <table>
            <thead><tr><th>#</th><th>Date</th><th>Against</th><th>{config.partyLabel}</th><th className="amt">Amount</th><th>Reason</th></tr></thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td>{note.number}</td>
                  <td>{note.date}</td>
                  <td>{note.docNumber}</td>
                  <td>{note.partyName}</td>
                  <td className="amt">{Number(note.total).toFixed(2)}</td>
                  <td>{note.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {printingDoc && <PrintView doc={printingDoc} org={org} config={config} onClose={() => setPrintingDoc(null)} />}
    </div>
  )
}

export function Invoices({ orgId, accounts, invoices, customers, items, creditNotes, entries, org }) {
  return (
    <DocumentForm
      orgId={orgId}
      accounts={accounts}
      documents={invoices}
      contacts={customers}
      items={items}
      notes={creditNotes}
      entries={entries}
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
        noteLabel: 'Credit Note',
        noteNumberPrefix: 'CN',
        notesCollection: 'creditNotes',
        noteSource: 'credit-note',
        buildNoteLines: buildCreditNoteJournalLines,
        showReminders: true,
        stockSign: -1,
        requiredAccountNames: ['Accounts Receivable', 'Cash', 'Sales Revenue', 'GST Payable'],
        buildLines: buildInvoiceJournalLines,
      }}
    />
  )
}

export function Bills({ orgId, accounts, bills, vendors, items, debitNotes, entries, org }) {
  return (
    <DocumentForm
      orgId={orgId}
      accounts={accounts}
      documents={bills}
      contacts={vendors}
      items={items}
      notes={debitNotes}
      entries={entries}
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
        noteLabel: 'Debit Note',
        noteNumberPrefix: 'DN',
        notesCollection: 'debitNotes',
        noteSource: 'debit-note',
        buildNoteLines: buildDebitNoteJournalLines,
        stockSign: 1,
        requiredAccountNames: ['Accounts Payable', 'Cash', 'Purchases', 'Input GST Credit'],
        buildLines: buildBillJournalLines,
      }}
    />
  )
}
