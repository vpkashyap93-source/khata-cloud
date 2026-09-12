// Core double-entry accounting rules shared by every screen: the chart of
// accounts, journal-entry balance validation, GST splitting, and the three
// standard reports (trial balance, P&L, balance sheet). Keeping this logic
// out of the components means the same rules apply whether a journal line
// came from a manual entry, an invoice, or a purchase bill.

export const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
]

// Debit-normal accounts (assets, expenses) increase with a debit; the rest
// (liabilities, equity, income) increase with a credit.
export const isDebitNormal = (type) => type === 'asset' || type === 'expense'

export const DEFAULT_ACCOUNTS = [
  { code: '1001', name: 'Cash', type: 'asset', system: true },
  { code: '1002', name: 'Bank', type: 'asset', system: true },
  { code: '1003', name: 'Accounts Receivable', type: 'asset', system: true },
  { code: '1004', name: 'Input GST Credit', type: 'asset', system: true },
  { code: '2001', name: 'Accounts Payable', type: 'liability', system: true },
  { code: '2002', name: 'GST Payable', type: 'liability', system: true },
  { code: '3001', name: "Owner's Capital", type: 'equity', system: true },
  { code: '3002', name: 'Retained Earnings', type: 'equity', system: true },
  { code: '4001', name: 'Sales Revenue', type: 'income', system: true },
  { code: '5001', name: 'Purchases', type: 'expense', system: true },
  { code: '5002', name: 'General Expenses', type: 'expense', system: true },
]

export const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100

export const sumLines = (lines, field) => round2(lines.reduce((total, line) => total + (Number(line[field]) || 0), 0))

// A journal entry is only postable when its debit and credit lines balance
// exactly and it actually moves money (not a zero-value no-op entry).
export const validateJournalLines = (lines) => {
  const activeLines = (lines || []).filter((line) => (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0)
  if (activeLines.length < 2) return { valid: false, error: 'Add at least two lines.' }
  if (activeLines.some((line) => (Number(line.debit) || 0) > 0 && (Number(line.credit) || 0) > 0)) {
    return { valid: false, error: 'A single line cannot have both a debit and a credit.' }
  }
  if (activeLines.some((line) => !line.accountId)) {
    return { valid: false, error: 'Every line needs an account.' }
  }
  const totalDebit = sumLines(activeLines, 'debit')
  const totalCredit = sumLines(activeLines, 'credit')
  if (totalDebit <= 0) return { valid: false, error: 'Entry amount cannot be zero.' }
  if (totalDebit !== totalCredit) {
    return { valid: false, error: `Debits (${totalDebit}) must equal credits (${totalCredit}).` }
  }
  return { valid: true, totalDebit, totalCredit, lines: activeLines }
}

// The exact opposite of a set of journal lines - swap every debit for a
// credit and back. Posting this as a new entry cancels the original out of
// every balance, ledger, and report without ever rewriting history: void
// is a correction, not a deletion.
export const reverseLines = (lines) => lines.map((line) => ({ accountId: line.accountId, debit: line.credit, credit: line.debit }))

// Splits a taxable amount into CGST+SGST (same state) or IGST (inter-state).
export const calcGst = (taxableAmount, gstPercent, interState) => {
  const taxable = round2(taxableAmount)
  const tax = round2((taxable * (Number(gstPercent) || 0)) / 100)
  if (interState) {
    return { taxable, cgst: 0, sgst: 0, igst: tax, tax, total: round2(taxable + tax) }
  }
  const half = round2(tax / 2)
  return { taxable, cgst: half, sgst: round2(tax - half), igst: 0, tax, total: round2(taxable + tax) }
}

export const findAccountId = (accounts, name) => accounts.find((account) => account.name === name)?.id || null

// Builds the debit/credit lines a sale should post: the customer owes the
// full invoice total (Accounts Receivable), Sales Revenue is credited for
// the taxable amount, and the GST collected is credited to GST Payable.
// Every sale books to AR first - money received is recorded separately via
// buildPaymentJournalLines, exactly as a real books of account work.
export const buildInvoiceJournalLines = (accounts, { taxable, cgst, sgst, igst, total }) => {
  const receivableId = findAccountId(accounts, 'Accounts Receivable')
  const salesId = findAccountId(accounts, 'Sales Revenue')
  const gstId = findAccountId(accounts, 'GST Payable')
  const lines = [{ accountId: receivableId, debit: total, credit: 0 }]
  lines.push({ accountId: salesId, debit: 0, credit: taxable })
  const tax = round2(cgst + sgst + igst)
  if (tax > 0) lines.push({ accountId: gstId, debit: 0, credit: tax })
  return lines
}

// Mirror of the above for a purchase bill: Purchases and Input GST Credit
// are debited, and the vendor is credited (Accounts Payable) - payment made
// is recorded separately via buildPaymentJournalLines.
export const buildBillJournalLines = (accounts, { taxable, cgst, sgst, igst, total }) => {
  const payableId = findAccountId(accounts, 'Accounts Payable')
  const purchasesId = findAccountId(accounts, 'Purchases')
  const gstInputId = findAccountId(accounts, 'Input GST Credit')
  const lines = [{ accountId: purchasesId, debit: taxable, credit: 0 }]
  const tax = round2(cgst + sgst + igst)
  if (tax > 0) lines.push({ accountId: gstInputId, debit: tax, credit: 0 })
  lines.push({ accountId: payableId, debit: 0, credit: total })
  return lines
}

// A credit note reverses part of a sale - a return, a discount, a billing
// correction. It reduces what the customer owes (Accounts Receivable) and
// un-books the matching revenue and GST, the mirror image of the invoice.
export const buildCreditNoteJournalLines = (accounts, { taxable, cgst, sgst, igst, total }) => {
  const receivableId = findAccountId(accounts, 'Accounts Receivable')
  const salesId = findAccountId(accounts, 'Sales Revenue')
  const gstId = findAccountId(accounts, 'GST Payable')
  const lines = [{ accountId: salesId, debit: taxable, credit: 0 }]
  const tax = round2(cgst + sgst + igst)
  if (tax > 0) lines.push({ accountId: gstId, debit: tax, credit: 0 })
  lines.push({ accountId: receivableId, debit: 0, credit: total })
  return lines
}

// A debit note reverses part of a purchase - a return to the vendor. It
// reduces what's owed to the vendor (Accounts Payable) and un-books the
// matching purchase and input GST credit, the mirror image of the bill.
export const buildDebitNoteJournalLines = (accounts, { taxable, cgst, sgst, igst, total }) => {
  const payableId = findAccountId(accounts, 'Accounts Payable')
  const purchasesId = findAccountId(accounts, 'Purchases')
  const gstInputId = findAccountId(accounts, 'Input GST Credit')
  const lines = [{ accountId: payableId, debit: total, credit: 0 }]
  lines.push({ accountId: purchasesId, debit: 0, credit: taxable })
  const tax = round2(cgst + sgst + igst)
  if (tax > 0) lines.push({ accountId: gstInputId, debit: 0, credit: tax })
  return lines
}

// Records money actually changing hands against an already-posted invoice
// or bill: a customer payment clears Accounts Receivable into Cash/Bank; a
// vendor payment clears Cash/Bank into Accounts Payable.
export const buildPaymentJournalLines = (accounts, amount, direction, cashAccountName = 'Cash') => {
  const cashId = findAccountId(accounts, cashAccountName)
  if (direction === 'receivable') {
    const receivableId = findAccountId(accounts, 'Accounts Receivable')
    return [
      { accountId: cashId, debit: amount, credit: 0 },
      { accountId: receivableId, debit: 0, credit: amount },
    ]
  }
  const payableId = findAccountId(accounts, 'Accounts Payable')
  return [
    { accountId: payableId, debit: amount, credit: 0 },
    { accountId: cashId, debit: 0, credit: amount },
  ]
}

const entriesInRange = (entries, from, to) =>
  entries.filter((entry) => (!from || entry.date >= from) && (!to || entry.date <= to))

// A signed balance for one account across a set of journal entries, using
// each account type's normal side so the number reads as "how much this
// account has grown" regardless of whether that's a debit or credit account.
export const accountBalance = (account, entries) => {
  let debit = 0
  let credit = 0
  entries.forEach((entry) => {
    entry.lines.forEach((line) => {
      if (line.accountId !== account.id) return
      debit += Number(line.debit) || 0
      credit += Number(line.credit) || 0
    })
  })
  debit = round2(debit)
  credit = round2(credit)
  const balance = isDebitNormal(account.type) ? round2(debit - credit) : round2(credit - debit)
  return { debit, credit, balance }
}

export const computeTrialBalance = (accounts, entries) =>
  accounts.map((account) => {
    const { debit, credit, balance } = accountBalance(account, entries)
    const debitTotal = isDebitNormal(account.type) ? Math.max(balance, 0) : 0
    const creditTotal = isDebitNormal(account.type) ? 0 : Math.max(balance, 0)
    return { account, debit, credit, debitTotal, creditTotal }
  })

export const computeProfitAndLoss = (accounts, entries, from, to) => {
  const ranged = entriesInRange(entries, from, to)
  const incomeAccounts = accounts.filter((account) => account.type === 'income')
  const expenseAccounts = accounts.filter((account) => account.type === 'expense')
  const income = incomeAccounts.map((account) => ({ account, amount: accountBalance(account, ranged).balance }))
  const expenses = expenseAccounts.map((account) => ({ account, amount: accountBalance(account, ranged).balance }))
  const totalIncome = round2(income.reduce((total, row) => total + row.amount, 0))
  const totalExpense = round2(expenses.reduce((total, row) => total + row.amount, 0))
  return { income, expenses, totalIncome, totalExpense, netProfit: round2(totalIncome - totalExpense) }
}

export const computeBalanceSheet = (accounts, entries, asOf) => {
  const ranged = entriesInRange(entries, null, asOf)
  const { netProfit } = computeProfitAndLoss(accounts, entries, null, asOf)
  const assets = accounts
    .filter((account) => account.type === 'asset')
    .map((account) => ({ account, amount: accountBalance(account, ranged).balance }))
  const liabilities = accounts
    .filter((account) => account.type === 'liability')
    .map((account) => ({ account, amount: accountBalance(account, ranged).balance }))
  const equity = accounts
    .filter((account) => account.type === 'equity')
    .map((account) => ({ account, amount: accountBalance(account, ranged).balance }))
  const totalAssets = round2(assets.reduce((total, row) => total + row.amount, 0))
  const totalLiabilities = round2(liabilities.reduce((total, row) => total + row.amount, 0))
  const totalEquity = round2(equity.reduce((total, row) => total + row.amount, 0) + netProfit)
  return { assets, liabilities, equity, netProfit, totalAssets, totalLiabilities, totalEquity }
}

// Every line touching one account, oldest first, with a running balance -
// the classic "ledger card" view.
export const computeLedger = (account, entries) => {
  const rows = []
  entries
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .forEach((entry) => {
      entry.lines.forEach((line) => {
        if (line.accountId !== account.id) return
        rows.push({
          date: entry.date,
          narration: entry.narration,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          source: entry.source,
        })
      })
    })
  let running = 0
  return rows.map((row) => {
    running += isDebitNormal(account.type) ? row.debit - row.credit : row.credit - row.debit
    return { ...row, balance: round2(running) }
  })
}

// Combined running balance of Cash + Bank across every entry, in
// chronological order - the "cash position over time" line the dashboard
// charts.
export const cashTrend = (accounts, entries) => {
  const cashAccountIds = accounts.filter((account) => account.name === 'Cash' || account.name === 'Bank').map((account) => account.id)
  let running = 0
  return entries
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((entry) => {
      let delta = 0
      entry.lines.forEach((line) => {
        if (!cashAccountIds.includes(line.accountId)) return
        delta += (Number(line.debit) || 0) - (Number(line.credit) || 0)
      })
      running = round2(running + delta)
      return { date: entry.date, balance: running }
    })
}

const monthKey = (date) => date.toISOString().slice(0, 7)

// Income vs. expense for each of the last `months` calendar months, oldest
// first - the bar-by-bar comparison a "cash flow" widget shows.
export const monthlyIncomeExpense = (accounts, entries, months = 6, today = new Date()) => {
  const result = []
  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = monthKey(monthDate)
    const from = `${key}-01`
    const to = `${key}-31`
    const { totalIncome, totalExpense } = computeProfitAndLoss(accounts, entries, from, to)
    result.push({ month: key, income: totalIncome, expense: totalExpense })
  }
  return result
}

// The expense accounts with the biggest balances, highest first - "where
// the money is going" for the dashboard's top-expenses widget.
export const topExpenseAccounts = (accounts, entries, limit = 5) =>
  accounts
    .filter((account) => account.type === 'expense')
    .map((account) => ({ account, amount: accountBalance(account, entries).balance }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)

// Balance still owed on an invoice or bill, and whether that makes it
// paid / partially paid / unpaid. `adjustedAmount` is whatever credit
// notes (against an invoice) or debit notes (against a bill) have already
// written off, so a partly-returned sale doesn't look like it's still
// fully owed.
export const balanceDue = (doc) => {
  const total = Number(doc.total) || 0
  const paid = Number(doc.amountPaid) || 0
  const adjusted = Number(doc.adjustedAmount) || 0
  const due = doc.voided ? 0 : round2(total - paid - adjusted)
  const status = doc.voided ? 'void' : due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  return { total, paid, adjusted, due, status }
}

// How much of a document's value is still available to be credited/debited
// against - a credit note can't return more than what's left after any
// earlier credit notes on the same invoice.
export const creditableAmount = (doc) => round2((Number(doc.total) || 0) - (Number(doc.adjustedAmount) || 0))

// A document can only be voided while nothing has happened against it yet
// (no payment received/made, no credit/debit note) - once money or a note
// is on record, voiding it out from under those would leave them dangling.
export const canVoid = (doc) => !doc.voided && (Number(doc.amountPaid) || 0) === 0 && (Number(doc.adjustedAmount) || 0) === 0

// Paid / unpaid / overdue counts and amounts across a set of invoices (or
// bills) - anything still owed after 30 days counts as overdue. Voided
// documents have no financial effect left and are skipped entirely.
export const invoiceStats = (invoices, today = new Date()) => {
  const stats = { paidCount: 0, paidAmount: 0, unpaidCount: 0, unpaidAmount: 0, overdueCount: 0, overdueAmount: 0 }
  invoices.forEach((invoice) => {
    if (invoice.voided) return
    const { total, due, status } = balanceDue(invoice)
    if (status === 'paid') {
      stats.paidCount += 1
      stats.paidAmount = round2(stats.paidAmount + total)
      return
    }
    stats.unpaidCount += 1
    stats.unpaidAmount = round2(stats.unpaidAmount + due)
    const ageDays = (today - new Date(invoice.date)) / 86400000
    if (ageDays > 30) {
      stats.overdueCount += 1
      stats.overdueAmount = round2(stats.overdueAmount + due)
    }
  })
  return stats
}

// Current stock on hand for one tracked item: its opening stock plus every
// movement against it - sales go out (negative), purchases and manual
// adjustments go however they're signed.
export const stockOnHand = (item, movements) =>
  round2(
    (Number(item.openingStock) || 0) +
      movements.filter((movement) => movement.itemId === item.id).reduce((total, movement) => total + (Number(movement.qty) || 0), 0),
  )
