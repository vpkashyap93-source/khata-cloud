import { useEffect, useMemo, useRef, useState } from 'react'

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const norm = (value) => (value || '').toString().toLowerCase()

// Instant client-side search across everything already loaded in memory -
// invoices, bills, estimates, contacts, items, journal entries, accounts,
// and the nav itself. No server round-trip, no index to maintain: the same
// live data every screen already renders from is just searched in place.
export default function CommandPalette({ open, onClose, onNavigate, nav, data }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  const inputRef = useRef(null)

  // Reset search state the moment `open` flips true - done during render
  // (React's documented pattern for adjusting state from a prop change)
  // rather than in an effect, so it can't trigger a cascading extra render.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const groups = useMemo(() => {
    const q = norm(query)
    const match = (...fields) => !q || fields.some((field) => norm(field).includes(q))
    const cap = (list) => list.slice(0, 6)

    const results = []

    if (!q) {
      results.push({ title: 'Go to', items: nav.map((item) => ({ label: item.label, onSelect: () => onNavigate(item.id) })) })
      return results
    }

    const navMatches = nav.filter((item) => match(item.label))
    if (navMatches.length) results.push({ title: 'Go to', items: navMatches.map((item) => ({ label: item.label, onSelect: () => onNavigate(item.id) })) })

    const invoiceMatches = cap(data.invoices.filter((doc) => match(doc.number, doc.partyName)))
    if (invoiceMatches.length) {
      results.push({
        title: 'Sales Invoices',
        items: invoiceMatches.map((doc) => ({ label: `${doc.number} - ${doc.partyName}`, sub: money(doc.total), onSelect: () => onNavigate('invoices') })),
      })
    }

    const billMatches = cap(data.bills.filter((doc) => match(doc.number, doc.partyName)))
    if (billMatches.length) {
      results.push({
        title: 'Purchase Bills',
        items: billMatches.map((doc) => ({ label: `${doc.number} - ${doc.partyName}`, sub: money(doc.total), onSelect: () => onNavigate('bills') })),
      })
    }

    const estimateMatches = cap(data.estimates.filter((doc) => match(doc.number, doc.partyName)))
    if (estimateMatches.length) {
      results.push({
        title: 'Estimates',
        items: estimateMatches.map((doc) => ({ label: `${doc.number} - ${doc.partyName}`, sub: money(doc.total), onSelect: () => onNavigate('estimates') })),
      })
    }

    const customerMatches = cap(data.customers.filter((contact) => match(contact.name)))
    if (customerMatches.length) {
      results.push({ title: 'Customers', items: customerMatches.map((contact) => ({ label: contact.name, onSelect: () => onNavigate('customers') })) })
    }

    const vendorMatches = cap(data.vendors.filter((contact) => match(contact.name)))
    if (vendorMatches.length) {
      results.push({ title: 'Vendors', items: vendorMatches.map((contact) => ({ label: contact.name, onSelect: () => onNavigate('vendors') })) })
    }

    const itemMatches = cap(data.items.filter((item) => match(item.name)))
    if (itemMatches.length) {
      results.push({ title: 'Items', items: itemMatches.map((item) => ({ label: item.name, sub: money(item.rate), onSelect: () => onNavigate('items') })) })
    }

    const accountMatches = cap(data.accounts.filter((account) => match(account.name)))
    if (accountMatches.length) {
      results.push({ title: 'Accounts', items: accountMatches.map((account) => ({ label: account.name, onSelect: () => onNavigate('ledger') })) })
    }

    const entryMatches = cap(data.entries.filter((entry) => match(entry.narration, entry.number)))
    if (entryMatches.length) {
      results.push({
        title: 'Journal',
        items: entryMatches.map((entry) => ({ label: entry.number || entry.narration, sub: entry.number ? entry.narration : entry.date, onSelect: () => onNavigate('journal') })),
      })
    }

    return results
  }, [query, nav, data, onNavigate])

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups])

  const select = (item) => {
    item.onSelect()
    onClose()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { onClose(); return }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1)); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return }
    if (event.key === 'Enter') { event.preventDefault(); if (flatItems[activeIndex]) select(flatItems[activeIndex]); }
  }

  if (!open) return null

  let runningIndex = -1

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-box" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search invoices, bills, customers, items..."
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
          onKeyDown={handleKeyDown}
        />
        <div className="palette-results">
          {flatItems.length === 0 && <p className="empty-note" style={{ padding: '12px 16px' }}>No matches.</p>}
          {groups.map((group) => (
            <div key={group.title} className="palette-group">
              <div className="palette-group-title">{group.title}</div>
              {group.items.map((item, index) => {
                runningIndex += 1
                const isActive = runningIndex === activeIndex
                return (
                  <button
                    key={`${group.title}-${index}`}
                    type="button"
                    className={`palette-item ${isActive ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIndex(runningIndex)}
                    onClick={() => select(item)}
                  >
                    <span>{item.label}</span>
                    {item.sub && <span className="palette-item-sub">{item.sub}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
