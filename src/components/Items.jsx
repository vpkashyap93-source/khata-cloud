import { Fragment, useState } from 'react'
import { addOrgDoc, setOrgDoc } from '../firebase.js'
import { stockOnHand, round2 } from '../lib/accounting.js'

const blank = { name: '', type: 'service', hsnSac: '', rate: '', gstPercent: 18, trackInventory: false, openingStock: 0 }
const today = () => new Date().toISOString().slice(0, 10)

function AdjustStock({ orgId, item, onDone }) {
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const value = Number(qty)
    if (!value) { setError('Enter a non-zero quantity (negative to remove stock).'); return }
    await addOrgDoc(orgId, 'stockMovements', {
      itemId: item.id,
      itemName: item.name,
      qty: value,
      type: 'adjustment',
      reason: reason.trim() || 'Manual adjustment',
      date: today(),
    })
    onDone()
  }

  return (
    <form className="payment-form" onSubmit={submit}>
      <input type="number" step="1" placeholder="+/- qty" value={qty} onChange={(event) => setQty(event.target.value)} />
      <input placeholder="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} />
      <button type="submit">Save adjustment</button>
      <button type="button" className="link-button" onClick={onDone}>Cancel</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  )
}

// A reusable catalog of products/services with their HSN (goods) or SAC
// (services) code and default rate/GST% - invoice and bill line items pick
// from here instead of retyping the same product details every time. Goods
// can optionally track inventory: opening stock plus every sale, purchase
// and manual adjustment nets out to a live stock-on-hand figure.
export default function Items({ orgId, items, movements }) {
  const [form, setForm] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [adjustingId, setAdjustingId] = useState(null)

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const startEdit = (item) => {
    setEditingId(item.id)
    setForm({
      name: item.name || '',
      type: item.type || 'service',
      hsnSac: item.hsnSac || '',
      rate: item.rate ?? '',
      gstPercent: item.gstPercent ?? 18,
      trackInventory: Boolean(item.trackInventory),
      openingStock: item.openingStock ?? 0,
    })
  }

  const cancelEdit = () => { setEditingId(null); setForm(blank) }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Enter an item name.'); return }
    const data = {
      ...form,
      name: form.name.trim(),
      rate: Number(form.rate) || 0,
      gstPercent: Number(form.gstPercent) || 0,
      trackInventory: form.type === 'goods' && form.trackInventory,
      openingStock: Number(form.openingStock) || 0,
    }
    if (editingId) {
      await setOrgDoc(orgId, 'items', editingId, data)
    } else {
      if (items.some((item) => item.name.toLowerCase() === data.name.toLowerCase())) {
        setError('An item with that name already exists.')
        return
      }
      await addOrgDoc(orgId, 'items', data)
    }
    cancelEdit()
  }

  return (
    <div className="panel">
      <h2>Items &amp; Services</h2>
      <form className="contact-form" onSubmit={submit}>
        <div className="journal-header-row">
          <label className="grow">
            Name
            <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Product or service name" />
          </label>
          <label>
            Type
            <select value={form.type} onChange={(event) => update('type', event.target.value)}>
              <option value="service">Service</option>
              <option value="goods">Goods</option>
            </select>
          </label>
        </div>
        <div className="journal-header-row">
          <label>
            {form.type === 'goods' ? 'HSN code' : 'SAC code'}
            <input value={form.hsnSac} onChange={(event) => update('hsnSac', event.target.value)} />
          </label>
          <label>
            Default rate
            <input type="number" min="0" step="0.01" value={form.rate} onChange={(event) => update('rate', event.target.value)} />
          </label>
          <label>
            GST %
            <input type="number" min="0" max="28" step="0.1" value={form.gstPercent} onChange={(event) => update('gstPercent', event.target.value)} />
          </label>
        </div>
        {form.type === 'goods' && (
          <div className="journal-header-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.trackInventory} onChange={(event) => update('trackInventory', event.target.checked)} />
              Track inventory for this item
            </label>
            {form.trackInventory && (
              <label>
                Opening stock
                <input type="number" step="1" value={form.openingStock} onChange={(event) => update('openingStock', event.target.value)} />
              </label>
            )}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="journal-header-row">
          <button type="submit">{editingId ? 'Save changes' : 'Add item'}</button>
          {editingId && <button type="button" className="link-button" onClick={cancelEdit}>Cancel</button>}
        </div>
      </form>

      <table>
        <thead><tr><th>Name</th><th>Type</th><th>HSN/SAC</th><th>Rate</th><th>GST %</th><th>Stock on hand</th><th /></tr></thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={item.id}>
              <tr>
                <td>{item.name}</td>
                <td>{item.type === 'goods' ? 'Goods' : 'Service'}</td>
                <td>{item.hsnSac || '-'}</td>
                <td>{Number(item.rate).toFixed(2)}</td>
                <td>{item.gstPercent}%</td>
                <td>{item.trackInventory ? round2(stockOnHand(item, movements)) : '-'}</td>
                <td>
                  <button type="button" className="link-button" onClick={() => startEdit(item)}>Edit</button>
                  {item.trackInventory && (
                    <button type="button" className="link-button" onClick={() => setAdjustingId(item.id)}>Adjust stock</button>
                  )}
                </td>
              </tr>
              {adjustingId === item.id && (
                <tr>
                  <td colSpan={7}><AdjustStock orgId={orgId} item={item} onDone={() => setAdjustingId(null)} /></td>
                </tr>
              )}
            </Fragment>
          ))}
          {items.length === 0 && <tr><td colSpan={7}>No items yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
