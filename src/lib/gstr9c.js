import { computeProfitAndLoss, round2 } from './accounting.js'

// GSTR-9C's central check is turnover as per the audited financial
// statements against turnover as declared in GSTR-9 - normally the
// starting point for a much longer reconciliation (discounts, unbilled
// revenue, deemed supplies, and a dozen other adjustment categories the
// official form has tables for), most of which this app has no way to
// know about. What this gives instead is the one comparison it can make
// honestly from its own data: total income booked in Profit & Loss for
// the year against total taxable sales reported through invoices for the
// same year. In a business whose books run entirely through this app the
// two should already match; a gap here is worth chasing down (a manual
// journal entry posted straight to Sales Revenue without going through an
// invoice, for one) before it becomes a bigger one on the actual 9C.
export const buildGstr9cCore = (accounts, entries, invoices, from, to) => {
  const { totalIncome } = computeProfitAndLoss(accounts, entries, from, to)
  const periodInvoices = (invoices || []).filter(
    (invoice) => !invoice.voided && (!from || invoice.date >= from) && (!to || invoice.date <= to),
  )
  const gstTurnover = round2(periodInvoices.reduce((total, invoice) => total + (Number(invoice.taxable) || 0), 0))
  const booksTurnover = round2(totalIncome)
  return { booksTurnover, gstTurnover, difference: round2(booksTurnover - gstTurnover) }
}
