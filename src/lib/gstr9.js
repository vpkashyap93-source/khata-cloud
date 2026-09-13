import { computeGstSummary, hsnSummary, round2 } from './accounting.js'
import { computeItcSetOff } from './gstr3b.js'

// GSTR-9 (the annual return) covers India's financial year - 1 April to
// 31 March - not a calendar year. Given any date, this returns the FY it
// falls in: a date in Jan-Mar belongs to the FY that started the previous
// April.
export const financialYearRange = (referenceDate = new Date()) => {
  const year = referenceDate.getMonth() >= 3 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1
  return { from: `${year}-04-01`, to: `${year + 1}-03-31`, label: `FY ${year}-${String(year + 1).slice(2)}` }
}

// GSTR-9 is a once-a-year roll-up of the same figures already reported
// monthly in GSTR-1 and GSTR-3B, so it's built the same way - just over
// the whole financial year instead of one period. Covers what those two
// already cover (outward supplies, ITC availed as "all other ITC", tax
// paid, HSN-wise outward supplies) and, same as GSTR-3B, leaves out
// exports, advances, reverse charge, and the amendments table (Part V) -
// none of which this app tracks. It's filled in directly on the portal
// like GSTR-3B, so this is a worksheet to copy across, not to file from -
// worth checking against the 12 months of GSTR-1/GSTR-3B actually filed
// for the year before you do.
export const buildGstr9 = (invoices, bills, creditNotes, debitNotes, items, from, to) => {
  const { sales, purchases } = computeGstSummary(invoices, bills, creditNotes, debitNotes, from, to)
  const setOff = computeItcSetOff({
    igstPayable: sales.igst, cgstPayable: sales.cgst, sgstPayable: sales.sgst,
    igstItc: purchases.igst, cgstItc: purchases.cgst, sgstItc: purchases.sgst,
  })
  const hsn = hsnSummary(invoices, items, from, to)
  const totalPayable = round2(sales.igst + sales.cgst + sales.sgst)
  const totalItc = round2(purchases.igst + purchases.cgst + purchases.sgst)
  const totalCash = round2(setOff.cashIgst + setOff.cashCgst + setOff.cashSgst)
  return { outwardSupplies: sales, itcAvailed: purchases, setOff, hsn, totalPayable, totalItc, totalCash }
}
