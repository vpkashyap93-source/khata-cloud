import { useState } from 'react'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import { downloadCsv } from '../lib/csv.js'
import CsvImport from './CsvImport.jsx'

const blank = { name: '', gstin: '', phone: '', email: '', address: '' }
const TEMPLATE_HEADERS = ['name', 'gstin', 'phone', 'email', 'address']

// A business switching over usually already has this list in a spreadsheet
// - importing skips any row with no name and any name that already exists
// (case-insensitively, including other rows earlier in the same file), so
// re-importing the same file twice is always safe.
async function importContacts(rows, { orgId, collectionName, contacts, singular }) {
  const seen = new Set(contacts.map((contact) => contact.name.trim().toLowerCase()))
  let added = 0
  let skipped = 0
  for (const row of rows) {
    const name = (row.name || '').trim()
    if (!name || seen.has(name.toLowerCase())) { skipped += 1; continue }
    seen.add(name.toLowerCase())
    await addOrgDoc(orgId, collectionName, {
      name,
      gstin: row.gstin || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
    })
    added += 1
  }
  const noun = singular.toLowerCase()
  return `${added} ${noun}${added === 1 ? '' : 's'} added${skipped ? `, ${skipped} skipped (blank name or duplicate)` : ''}.`
}

// Shared shape for Customers and Vendors - both are just a saved contact
// list (name, GSTIN, phone, email, address) that invoices/bills pick from
// instead of the party name being retyped every time.
function ContactList({ orgId, collectionName, title, singular, contacts }) {
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const startEdit = (contact) => {
    setEditingId(contact.id)
    setForm({ name: contact.name || '', gstin: contact.gstin || '', phone: contact.phone || '', email: contact.email || '', address: contact.address || '' })
  }

  const cancelEdit = () => { setEditingId(null); setForm(blank) }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.name.trim()) { setError(`Enter a ${singular.toLowerCase()} name.`); return }
    if (editingId) {
      await setOrgDoc(orgId, collectionName, editingId, form)
    } else {
      if (contacts.some((contact) => contact.name.toLowerCase() === form.name.trim().toLowerCase())) {
        setError(`A ${singular.toLowerCase()} with that name already exists.`)
        return
      }
      await addOrgDoc(orgId, collectionName, form)
    }
    cancelEdit()
  }

  return (
    <div className="panel">
      <h2>{title}</h2>
      <form className="contact-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            {singular} name
            <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Business or person's name" />
          </label>
          <label>
            GSTIN
            <input value={form.gstin} onChange={(event) => update('gstin', event.target.value)} placeholder="22AAAAA0000A1Z5" />
          </label>
        </div>
        <div className="journal-header-row">
          <label>
            Phone
            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
          </label>
          <label className="grow">
            Email
            <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
          </label>
        </div>
        <label>
          Address
          <textarea rows={2} value={form.address} onChange={(event) => update('address', event.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="journal-header-row">
          <button type="submit">{editingId ? 'Save changes' : `Add ${singular.toLowerCase()}`}</button>
          {editingId && <button type="button" className="link-button" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      <table>
        <thead><tr><th>Name</th><th>GSTIN</th><th>Phone</th><th>Email</th><th /></tr></thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>{contact.name}</td>
              <td>{contact.gstin || '-'}</td>
              <td>{contact.phone || '-'}</td>
              <td>{contact.email || '-'}</td>
              <td><button type="button" className="link-button" onClick={() => startEdit(contact)}>Edit</button></td>
            </tr>
          ))}
          {contacts.length === 0 && <tr><td colSpan={5}>No {title.toLowerCase()} yet.</td></tr>}
        </tbody>
      </table>

      <p className="report-section-title" style={{ marginTop: 24 }}>Bulk Import</p>
      <p className="section-sub">
        Already have a {singular.toLowerCase()} list in a spreadsheet? Export it as CSV with columns name, gstin,
        phone, email, address (name is required, the rest are optional) and import it here.
      </p>
      <div className="journal-header-row">
        <button
          type="button"
          className="link-button"
          onClick={() => downloadCsv(`${singular.toLowerCase()}-import-template.csv`, [
            TEMPLATE_HEADERS,
            [`Example ${singular}`, '22AAAAA0000A1Z5', '9876543210', 'example@business.com', '123 Main Road, City'],
          ])}
        >
          Download CSV template
        </button>
        <CsvImport
          label={`Import ${singular.toLowerCase()}s`}
          onRows={(rows) => importContacts(rows, { orgId, collectionName, contacts, singular })}
        />
      </div>
    </div>
  )
}

export function Customers({ orgId, customers }) {
  return <ContactList orgId={orgId} collectionName="customers" title="Customers" singular="Customer" contacts={customers} />
}

export function Vendors({ orgId, vendors }) {
  return <ContactList orgId={orgId} collectionName="vendors" title="Vendors" singular="Vendor" contacts={vendors} />
}
