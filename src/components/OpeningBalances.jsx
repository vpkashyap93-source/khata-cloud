import { useState } from 'react'
import { isDebitNormal, buildOpeningBalanceLines, round2 } from '../lib/accounting.js'
import { addOrgDoc } from '../firebase.js'

const today = () => new Date().toISOString().slice(0, 10)
const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const OPENING_EQUITY_NAME = 'Opening Balance Equity'
const EXCLUDED_ACCOUNT_NAMES = ['Accounts Receivable', 'Accounts Payable', OPENING_EQUITY_NAME]

// A business switching to Khata Cloud doesn't start at zero - customers
// already owe it money, it already owes vendors, its bank account already
// has a balance. This screen brings all of that in as of one date, as a
// real balanced journal entry against Opening Balance Equity (the "plug"
// account every accounting system uses for exactly this) - never by just
// overwriting a balance, which would leave the books unbalanced and no
// audit trail behind. Customer/vendor balances are posted as actual
// invoices/bills (numbered OB-...) so they show up in that party's own
// history and count toward aging/upcoming dues correctly, not just as one
// lump sum.
export default function OpeningBalances({ orgId, accounts, customers, vendors, invoices, bills }) {
  const [asOfDate, setAsOfDate] = useState(today())
  const [accountAmounts, setAccountAmounts] = useState({})
  const [customerAmounts, setCustomerAmounts] = useState({})
  const [vendorAmounts, setVendorAmounts] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const eligibleAccounts = accounts
    .filter((account) => ['asset', 'liability', 'equity'].includes(account.type))
    .filter((account) => !EXCLUDED_ACCOUNT_NAMES.includes(account.name))

  const setAccountAmount = (id, value) => setAccountAmounts((prev) => ({ ...prev, [id]: value }))
  const setCustomerAmount = (id, value) => setCustomerAmounts((prev) => ({ ...prev, [id]: value }))
  const setVendorAmount = (id, value) => setVendorAmounts((prev) => ({ ...prev, [id]: value }))

  const totalAccounts = round2(Object.values(accountAmounts).reduce((total, value) => total + (Number(value) || 0), 0))
  const totalCustomers = round2(Object.values(customerAmounts).reduce((total, value) => total + (Number(value) || 0), 0))
  const totalVendors = round2(Object.values(vendorAmounts).reduce((total, value) => total + (Number(value) || 0), 0))

  const findOrCreateOpeningEquity = async () => {
    const existing = accounts.find((account) => account.name === OPENING_EQUITY_NAME)
    if (existing) return existing.id
    return addOrgDoc(orgId, 'accounts', { code: '3900', name: OPENING_EQUITY_NAME, type: 'equity' })
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    const balances = Object.entries(accountAmounts)
      .map(([accountId, amount]) => ({ accountId, amount: Number(amount) || 0 }))
      .filter((entry) => entry.amount > 0)
    const customerEntries = Object.entries(customerAmounts)
      .map(([customerId, amount]) => ({ customerId, amount: round2(Number(amount) || 0) }))
      .filter((entry) => entry.amount > 0)
    const vendorEntries = Object.entries(vendorAmounts)
      .map(([vendorId, amount]) => ({ vendorId, amount: round2(Number(amount) || 0) }))
      .filter((entry) => entry.amount > 0)

    if (balances.length === 0 && customerEntries.length === 0 && vendorEntries.length === 0) {
      setError('Enter at least one opening balance.')
      return
    }

    setBusy(true)
    try {
      const openingEquityId = await findOrCreateOpeningEquity()
      const receivableId = accounts.find((account) => account.name === 'Accounts Receivable')?.id
      const payableId = accounts.find((account) => account.name === 'Accounts Payable')?.id

      if (balances.length > 0) {
        const lines = buildOpeningBalanceLines(accounts, balances, openingEquityId)
        await addOrgDoc(orgId, 'journalEntries', {
          date: asOfDate,
          narration: 'Opening balances',
          lines,
          source: 'opening-balance',
        })
      }

      const existingObInvoices = invoices.filter((invoice) => invoice.number?.startsWith('OB-')).length
      for (const [index, entry] of customerEntries.entries()) {
        const customer = customers.find((item) => item.id === entry.customerId)
        if (!customer || !receivableId) continue
        const number = `OB-${String(existingObInvoices + index + 1).padStart(4, '0')}`
        const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
          date: asOfDate,
          narration: `Opening balance - ${customer.name}`,
          lines: [
            { accountId: receivableId, debit: entry.amount, credit: 0 },
            { accountId: openingEquityId, debit: 0, credit: entry.amount },
          ],
          source: 'opening-balance',
        })
        await addOrgDoc(orgId, 'invoices', {
          number,
          date: asOfDate,
          dueDate: asOfDate,
          partyName: customer.name,
          items: [{ description: 'Opening balance', qty: 1, rate: entry.amount, itemId: null }],
          gstPercent: 0,
          interState: false,
          taxable: entry.amount,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: entry.amount,
          amountPaid: 0,
          adjustedAmount: 0,
          journalEntryId,
        })
      }

      const existingObBills = bills.filter((bill) => bill.number?.startsWith('OB-')).length
      for (const [index, entry] of vendorEntries.entries()) {
        const vendor = vendors.find((item) => item.id === entry.vendorId)
        if (!vendor || !payableId) continue
        const number = `OB-${String(existingObBills + index + 1).padStart(4, '0')}`
        const journalEntryId = await addOrgDoc(orgId, 'journalEntries', {
          date: asOfDate,
          narration: `Opening balance - ${vendor.name}`,
          lines: [
            { accountId: openingEquityId, debit: entry.amount, credit: 0 },
            { accountId: payableId, debit: 0, credit: entry.amount },
          ],
          source: 'opening-balance',
        })
        await addOrgDoc(orgId, 'bills', {
          number,
          date: asOfDate,
          dueDate: asOfDate,
          partyName: vendor.name,
          items: [{ description: 'Opening balance', qty: 1, rate: entry.amount, itemId: null }],
          gstPercent: 0,
          interState: false,
          taxable: entry.amount,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: entry.amount,
          amountPaid: 0,
          adjustedAmount: 0,
          journalEntryId,
        })
      }

      setAccountAmounts({})
      setCustomerAmounts({})
      setVendorAmounts({})
      setSuccess('Opening balances posted - check the Journal, or each customer/vendor, to see them.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h2>Opening Balances</h2>
      <p className="section-sub">
        Already running this business? Bring in what customers owe you, what you owe vendors, and your account
        balances as of a date - posted as one balanced entry against Opening Balance Equity, not just typed in.
        Safe to use more than once (e.g. one customer at a time) - only accounts/parties you enter an amount for are touched.
      </p>
      <form className="journal-form" onSubmit={submit}>
        <label>
          As of date
          <input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} required />
        </label>

        {eligibleAccounts.length > 0 && (
          <>
            <p className="report-section-title">Account balances</p>
            <table>
              <thead><tr><th>Account</th><th>Normally</th><th className="amt">Opening balance</th></tr></thead>
              <tbody>
                {eligibleAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td className="section-sub">{isDebitNormal(account.type) ? 'debit (what you have)' : 'credit (what you owe)'}</td>
                    <td>
                      <input
                        className="amt-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={accountAmounts[account.id] || ''}
                        onChange={(event) => setAccountAmount(account.id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {customers.length > 0 && (
          <>
            <p className="report-section-title">What customers already owe you</p>
            <table>
              <thead><tr><th>Customer</th><th className="amt">Amount owed</th></tr></thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>
                      <input
                        className="amt-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={customerAmounts[customer.id] || ''}
                        onChange={(event) => setCustomerAmount(customer.id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {vendors.length > 0 && (
          <>
            <p className="report-section-title">What you already owe vendors</p>
            <table>
              <thead><tr><th>Vendor</th><th className="amt">Amount owed</th></tr></thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>{vendor.name}</td>
                    <td>
                      <input
                        className="amt-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={vendorAmounts[vendor.id] || ''}
                        onChange={(event) => setVendorAmount(vendor.id, event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="totals-box">
          <div>Accounts: {money(totalAccounts)}</div>
          <div>Customers owe: {money(totalCustomers)}</div>
          <div>You owe vendors: {money(totalVendors)}</div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="auth-info">{success}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Posting...' : 'Post opening balances'}
        </button>
      </form>
    </div>
  )
}
