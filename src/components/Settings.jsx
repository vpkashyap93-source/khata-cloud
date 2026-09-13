import { useState } from 'react'
import { updateOrg } from '../firebase.js'
import Icon from './icons.jsx'

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Delhi', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal', 'Other',
]

// The business profile that appears on the letterhead of every printed
// invoice and bill - name, GSTIN, address, contact details, and the prefix
// used for invoice/bill numbering.
export default function Settings({ orgId, org, members }) {
  const [form, setForm] = useState({
    name: org.name || '',
    gstin: org.gstin || '',
    state: org.state || '',
    address: org.address || '',
    phone: org.phone || '',
    email: org.email || '',
    invoicePrefix: org.invoicePrefix || 'INV',
    billPrefix: org.billPrefix || 'BILL',
    paymentTermDays: org.paymentTermDays || 30,
  })
  const [saved, setSaved] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  const update = (field, value) => { setForm((prev) => ({ ...prev, [field]: value })); setSaved(false) }

  const submit = async (event) => {
    event.preventDefault()
    await updateOrg(orgId, form)
    setSaved(true)
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(orgId)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // clipboard access denied - the code is still shown on screen to copy by hand
    }
  }

  return (
    <div className="panel">
      <h2>Business Settings</h2>
      <p className="section-sub">Appears on your printed invoices and bills.</p>
      <form className="contact-form" onSubmit={submit}>
        <p className="report-section-title" style={{ marginTop: 4 }}>Business Profile</p>
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

        <p className="report-section-title">Address &amp; Contact</p>
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

        <p className="report-section-title">Invoicing</p>
        <div className="journal-header-row">
          <label>
            Invoice number prefix
            <input value={form.invoicePrefix} onChange={(event) => update('invoicePrefix', event.target.value)} />
          </label>
          <label>
            Bill number prefix
            <input value={form.billPrefix} onChange={(event) => update('billPrefix', event.target.value)} />
          </label>
          <label>
            Default payment terms (days)
            <input
              type="number"
              min="0"
              max="365"
              value={form.paymentTermDays}
              onChange={(event) => update('paymentTermDays', event.target.value)}
            />
          </label>
        </div>

        <div className="journal-header-row" style={{ marginTop: 8 }}>
          <button type="submit">Save settings</button>
          {saved && <span className="save-confirm"><Icon name="check" size={13} />Saved</span>}
        </div>
      </form>

      <p className="report-section-title" style={{ marginTop: 24 }}>Team</p>
      <p className="section-sub">
        Everyone who joins with this code gets full access to the same books - there are no separate roles yet.
        Share it only with people you trust with your business's accounts.
      </p>
      <div className="journal-header-row">
        <code className="join-code">{orgId}</code>
        <button type="button" className="action-pill" onClick={copyCode}>
          <Icon name={codeCopied ? 'check' : 'download'} size={13} />{codeCopied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <table>
        <thead><tr><th>Email</th><th>Joined</th></tr></thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>{member.email || '(unknown)'}</td>
              <td>{member.joinedAt?.toDate ? member.joinedAt.toDate().toISOString().slice(0, 10) : '-'}</td>
            </tr>
          ))}
          {members.length === 0 && <tr><td colSpan={2} className="empty-note">No team members yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
