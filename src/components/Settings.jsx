import { useState } from 'react'
import { updateOrg } from '../firebase.js'

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal', 'Other',
]

// The business profile that appears on the letterhead of every printed
// invoice and bill - name, GSTIN, address, contact details, and the prefix
// used for invoice/bill numbering.
export default function Settings({ orgId, org }) {
  const [form, setForm] = useState({
    name: org.name || '',
    gstin: org.gstin || '',
    state: org.state || '',
    address: org.address || '',
    phone: org.phone || '',
    email: org.email || '',
    invoicePrefix: org.invoicePrefix || 'INV',
    billPrefix: org.billPrefix || 'BILL',
  })
  const [saved, setSaved] = useState(false)

  const update = (field, value) => { setForm((prev) => ({ ...prev, [field]: value })); setSaved(false) }

  const submit = async (event) => {
    event.preventDefault()
    await updateOrg(orgId, form)
    setSaved(true)
  }

  return (
    <div className="panel">
      <h2>Business Settings</h2>
      <p className="section-sub">Appears on your printed invoices and bills.</p>
      <form className="contact-form" onSubmit={submit}>
        <label>
          Business name
          <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
        </label>
        <div className="journal-header-row">
          <label>
            GSTIN
            <input value={form.gstin} onChange={(event) => update('gstin', event.target.value)} placeholder="22AAAAA0000A1Z5" />
          </label>
          <label>
            State
            <select value={form.state} onChange={(event) => update('state', event.target.value)}>
              <option value="">Select state</option>
              {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </label>
        </div>
        <label>
          Address
          <textarea rows={2} value={form.address} onChange={(event) => update('address', event.target.value)} />
        </label>
        <div className="journal-header-row">
          <label>
            Phone
            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
          </label>
          <label className="grow">
            Business email
            <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} />
          </label>
        </div>
        <div className="journal-header-row">
          <label>
            Invoice number prefix
            <input value={form.invoicePrefix} onChange={(event) => update('invoicePrefix', event.target.value)} />
          </label>
          <label>
            Bill number prefix
            <input value={form.billPrefix} onChange={(event) => update('billPrefix', event.target.value)} />
          </label>
        </div>
        <div className="journal-header-row">
          <button type="submit">Save settings</button>
          {saved && <span className="auth-info">Saved.</span>}
        </div>
      </form>
    </div>
  )
}
