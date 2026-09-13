import { computeGstSummary, round2 } from './accounting.js'
import { buildGstr1 } from './gstr1.js'
import { STATE_NAME_BY_CODE } from './gstStateCodes.js'

// GSTR-3B's own ITC set-off order (CGST rules, Rule 88A, in force since
// 2019): IGST credit must be fully used first - against IGST liability,
// then CGST, then SGST, in that order - before any CGST or SGST credit can
// be touched. Left-over CGST credit (after its own liability) can only
// then go against IGST, never SGST; left-over SGST credit the same,
// against IGST only, never CGST. This is the one part of the worksheet
// that's genuinely a calculation rather than a re-grouping of numbers
// already in the books, so it's worth double-checking against the
// portal's own auto-computed set-off before paying.
const settleTax = ({ igstPayable, cgstPayable, sgstPayable, igstItc, cgstItc, sgstItc }) => {
  let igstItcLeft = igstItc
  let cgstItcLeft = cgstItc
  let sgstItcLeft = sgstItc

  const useIgstOnIgst = Math.min(igstItcLeft, igstPayable)
  igstItcLeft -= useIgstOnIgst
  let igstDue = igstPayable - useIgstOnIgst

  const useIgstOnCgst = Math.min(igstItcLeft, cgstPayable)
  igstItcLeft -= useIgstOnCgst
  let cgstDue = cgstPayable - useIgstOnCgst

  const useIgstOnSgst = Math.min(igstItcLeft, sgstPayable)
  igstItcLeft -= useIgstOnSgst
  let sgstDue = sgstPayable - useIgstOnSgst

  const useCgstOnCgst = Math.min(cgstItcLeft, cgstDue)
  cgstItcLeft -= useCgstOnCgst
  cgstDue -= useCgstOnCgst

  const useCgstOnIgst = Math.min(cgstItcLeft, igstDue)
  cgstItcLeft -= useCgstOnIgst
  igstDue -= useCgstOnIgst

  const useSgstOnSgst = Math.min(sgstItcLeft, sgstDue)
  sgstItcLeft -= useSgstOnSgst
  sgstDue -= useSgstOnSgst

  const useSgstOnIgst = Math.min(sgstItcLeft, igstDue)
  sgstItcLeft -= useSgstOnIgst
  igstDue -= useSgstOnIgst

  return {
    cashIgst: round2(igstDue),
    cashCgst: round2(cgstDue),
    cashSgst: round2(sgstDue),
    itcCarriedForward: { igst: round2(igstItcLeft), cgst: round2(cgstItcLeft), sgst: round2(sgstItcLeft) },
  }
}

// Builds a GSTR-3B worksheet - Table 3.1(a) outward taxable supplies,
// Table 3.2 interstate supplies to unregistered persons (state-wise, since
// the portal asks for that breakup separately), Table 4 eligible ITC, and
// Table 6.1 tax payable/paid - from the same sales and purchase data
// GSTR-1 and Purchase Register already use. GSTR-3B itself is filled in
// directly on the portal (it isn't a JSON upload like GSTR-1), so this is
// meant to be copied across, not filed from - and it can only report "All
// other ITC" since imports, reverse charge, and ISD credits aren't
// something this app tracks.
export const buildGstr3b = (invoices, bills, creditNotes, debitNotes, customers, items, from, to) => {
  const { sales, purchases } = computeGstSummary(invoices, bills, creditNotes, debitNotes, from, to)

  const gstr1 = buildGstr1(invoices, creditNotes, customers, items, { gstin: '' }, from, to)
  const interstateByPos = new Map()
  const addInterstate = (pos, taxable, igst) => {
    const existing = interstateByPos.get(pos) || { pos, taxable: 0, igst: 0 }
    existing.taxable = round2(existing.taxable + taxable)
    existing.igst = round2(existing.igst + igst)
    interstateByPos.set(pos, existing)
  }
  gstr1.b2cs.filter((row) => row.sply_ty === 'INTER').forEach((row) => addInterstate(row.pos, row.txval, row.iamt))
  gstr1.b2cl.forEach((row) => addInterstate(row.pos, row.itms[0].itm_det.txval, row.itms[0].itm_det.iamt))
  const interstateSupplies = [...interstateByPos.values()]
    .filter((row) => row.taxable > 0)
    .map((row) => ({ ...row, stateName: STATE_NAME_BY_CODE[row.pos] || row.pos }))
    .sort((a, b) => a.stateName.localeCompare(b.stateName))

  const setOff = settleTax({
    igstPayable: sales.igst, cgstPayable: sales.cgst, sgstPayable: sales.sgst,
    igstItc: purchases.igst, cgstItc: purchases.cgst, sgstItc: purchases.sgst,
  })

  return {
    outwardSupplies: sales,
    interstateSupplies,
    itcAvailable: purchases,
    setOff,
  }
}
