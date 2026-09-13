import { useState } from 'react'
import { balanceDue, round2 } from '../lib/accounting.js'
import Icon from './icons.jsx'

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amt = (value) => Number(value || 0).toFixed(2)
const today = () => new Date().toISOString().slice(0, 10)

function PrintStatement({ partyLabel, partyName, openItems, totalOutstanding, org, onClose }) {
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
            <h2>Statement of Account</h2>
            <p>As of {today()}</p>
          </div>
        </div>
        <div className="print-party">
          <span className="print-label">{partyLabel}</span>
          <div>{partyName}</div>
        </div>
        <table className="print-items">
          <thead><tr><th>Date</th><th>Document #</th><th>Total</th><th>Balance due</th></tr></thead>
          <tbody>
            {openItems.map((doc) => (
              <tr key={doc.id}>
                <td>{doc.date}</td>
                <td>{doc.number}</td>
                <td>{amt(doc.total)}</td>
                <td>{amt(doc.due)}</td>
              </tr>
            ))}
            {openItems.length === 0 && <tr><td colSpan={4}>Nothing outstanding - fully settled.</td></tr>}
          </tbody>
        </table>
        <div className="print-totals">
          <div className="print-grand-total"><span>Total outstanding</span><span>{amt(totalOutstanding)}</span></div>
        </div>
      </div>
    </div>
  )
}

// What a customer or vendor actually asks for: "what do I owe you / what
// do you owe me right now", plus the full history so it's traceable - not
// a fabricated day-by-day running balance, since this app doesn't store a
// separate dated record for every partial payment (only the invoice/bill's
// own cumulative amountPaid), and inventing payment dates would be
// dishonest. Built entirely from invoices/bills and their credit/debit
// notes, which already carry a real partyName field each.
export default function Statements({ customers, vendors, invoices, bills, creditNotes, debitNotes, org }) {
  const [partyType, setPartyType] = useState('customer')
  const [partyName, setPartyName] = useState('')
  const [printing, setPrinting] = useState(false)

  const contacts = partyType === 'customer' ? customers : vendors
  const docs = partyType === 'customer' ? invoices : bills
  const notes = partyType === 'customer' ? creditNotes : debitNotes
  const partyLabel = partyType === 'customer' ? 'Customer' : 'Vendor'
  const noteLabel = partyType === 'customer' ? 'Credit Note' : 'Debit Note'

  const partyDocs = docs
    .filter((doc) => doc.partyName === partyName)
    .map((doc) => ({ ...doc, ...balanceDue(doc) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const partyNotes = notes.filter((note) => note.partyName === partyName)

  const openItems = partyDocs.filter((doc) => !doc.voided && doc.status !== 'paid')
  const totalOutstanding = round2(openItems.reduce((total, doc) => total + doc.due, 0))

  return (
    <div className="panel">
      <h2>Statement of Account</h2>
      <p className="section-sub">
        What a customer owes you, or what you owe a vendor, right now - plus the full document history behind it.
      </p>
      <div className="journal-header-row">
        <label>
          Party type
          <select value={partyType} onChange={(event) => { setPartyType(event.target.value); setPartyName('') }}>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
          </select>
        </label>
        <label className="grow">
          {partyLabel}
          <input
            value={partyName}
            onChange={(event) => setPartyName(event.target.value)}
            placeholder={`Pick a ${partyLabel.toLowerCase()}`}
            list="statement-contacts"
          />
          <datalist id="statement-contacts">
            {contacts.map((contact) => <option key={contact.id} value={contact.name} />)}
          </datalist>
        </label>
        {partyName && (
          <button type="button" className="action-pill" onClick={() => setPrinting(true)} style={{ alignSelf: 'flex-end' }}>
            <Icon name="print" size={13} />Print statement
          </button>
        )}
      </div>

      {!partyName && (
        <div className="empty-state">
          <div className="empty-state-icon"><Icon name={partyType === 'customer' ? 'customers' : 'vendors'} size={22} /></div>
          <p>Pick a {partyLabel.toLowerCase()} above to see their statement.</p>
        </div>
      )}

      {partyName && (
        <>
          <div className="report-summary">
            <div className="report-stat">
              <div className="report-stat-label">Open {partyType === 'customer' ? 'invoices' : 'bills'}</div>
              <div className="report-stat-value">{openItems.length}</div>
            </div>
            <div className="report-stat">
              <div className="report-stat-label">{partyType === 'customer' ? 'They owe you' : 'You owe them'}</div>
              <div className={`report-stat-value ${totalOutstanding > 0 ? 'red' : 'green'}`}>{money(totalOutstanding)}</div>
            </div>
          </div>

          <p className="report-section-title">Outstanding {partyType === 'customer' ? 'invoices' : 'bills'}</p>
          <table>
            <thead><tr><th>Date</th><th>#</th><th className="amt">Total</th><th className="amt">Balance due</th></tr></thead>
            <tbody>
              {openItems.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.date}</td>
                  <td>{doc.number}</td>
                  <td className="amt">{money(doc.total)}</td>
                  <td className="amt">{money(doc.due)}</td>
                </tr>
              ))}
              {openItems.length === 0 && <tr><td colSpan={4} className="empty-note">Nothing outstanding - fully settled.</td></tr>}
            </tbody>
          </table>

          <p className="report-section-title">Full history</p>
          <table>
            <thead><tr><th>Date</th><th>#</th><th className="amt">Total</th><th className="amt">Paid</th><th>Status</th></tr></thead>
            <tbody>
              {partyDocs.map((doc) => (
                <tr key={doc.id} className={doc.voided ? 'voided-row' : ''}>
                  <td>{doc.date}</td>
                  <td>{doc.number}</td>
                  <td className="amt">{money(doc.total)}</td>
                  <td className="amt">{money(doc.amountPaid)}</td>
                  <td><span className={`status-pill ${doc.status === 'paid' ? 'paid' : doc.voided ? 'void' : 'due'}`}>{doc.voided ? 'void' : doc.status}</span></td>
                </tr>
              ))}
              {partyDocs.length === 0 && <tr><td colSpan={5} className="empty-note">No documents for this {partyLabel.toLowerCase()} yet.</td></tr>}
            </tbody>
          </table>

          {partyNotes.length > 0 && (
            <>
              <p className="report-section-title">{noteLabel}s issued</p>
              <table>
                <thead><tr><th>Date</th><th>#</th><th>Against</th><th className="amt">Amount</th></tr></thead>
                <tbody>
                  {partyNotes.map((note) => (
                    <tr key={note.id}>
                      <td>{note.date}</td>
                      <td>{note.number}</td>
                      <td>{note.docNumber}</td>
                      <td className="amt">{money(note.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {printing && (
        <PrintStatement
          partyLabel={partyLabel}
          partyName={partyName}
          openItems={openItems}
          totalOutstanding={totalOutstanding}
          org={org}
          onClose={() => setPrinting(false)}
        />
      )}
    </div>
  )
}
