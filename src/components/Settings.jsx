import { useState } from 'react'
import { updateOrg } from '../firebase.js'
import { downloadJson } from '../lib/csv.js'
import { STATE_NAMES } from '../lib/gstStateCodes.js'
import Icon from './icons.jsx'

const today = () => new Date().toISOString().slice(0, 10)
const slugify = (value) => (value || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// The business profile that appears on the letterhead of every printed
// invoice and bill - name, GSTIN, address, contact details, and the prefix
// used for invoice/bill numbering.
export default function Settings({ orgId, org, members, backupData }) {
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
    logoDataUrl: org.logoDataUrl || '',
  })
  const [saved, setSaved] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [logoError, setLogoError] = useState('')

  const update = (field, value) => { setForm((prev) => ({ ...prev, [field]: value })); setSaved(false) }

  // Resized and re-compressed client-side into a small JPEG data URL, then
  // stored directly on the org doc - no Firebase Storage bucket needed, so
  // this works with zero extra setup (unlike Team's Firestore rules step).
  // A white fill behind the draw keeps a transparent-background PNG logo
  // from turning black, since JPEG has no transparency of its own.
  const handleLogoFile = (file) => {
    if (!file) return
    setLogoError('')
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxWidth = 320
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        update('logoDataUrl', canvas.toDataURL('image/jpeg', 0.75))
      }
      img.onerror = () => setLogoError('Could not read that image - try a different file.')
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

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
            Logo (optional)
            <input type="file" accept="image/*" onChange={(event) => handleLogoFile(event.target.files?.[0])} />
          </label>
          {form.logoDataUrl && (
            <>
              <img src={form.logoDataUrl} alt="Business logo" style={{ maxHeight: 48, borderRadius: 4 }} />
              <button type="button" className="link-button" onClick={() => update('logoDataUrl', '')}>Remove logo</button>
            </>
          )}
        </div>
        {logoError && <p className="form-error">{logoError}</p>}
        <div className="journal-header-row">
          <label>
            GSTIN
            <input value={form.gstin} onChange={(event) => update('gstin', event.target.value)} placeholder="22AAAAA0000A1Z5" />
          </label>
          <label>
            State
            <select value={form.state} onChange={(event) => update('state', event.target.value)}>
              <option value="">Select state</option>
              {STATE_NAMES.map((state) => <option key={state} value={state}>{state}</option>)}
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

      <p className="report-section-title" style={{ marginTop: 24 }}>Data Backup</p>
      <p className="section-sub">
        Your own copy of everything - accounts, journal entries, invoices, bills, customers, vendors, items, and
        more - as one JSON file, readable independently of this app or Firebase. Not a restore tool, just peace of
        mind: keep a copy somewhere safe.
      </p>
      <button
        type="button"
        className="action-pill"
        onClick={() => downloadJson(`khata-cloud-backup-${slugify(org.name)}-${today()}.json`, { exportedAt: today(), org, ...backupData })}
      >
        <Icon name="download" size={13} />Download all data (JSON)
      </button>
    </div>
  )
}
