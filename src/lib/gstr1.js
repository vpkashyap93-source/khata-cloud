import { calcGst, round2 } from './accounting.js'
import { GST_STATE_CODES } from './gstStateCodes.js'

// B2C invoices above this value that cross a state line get their own
// invoice-wise B2CL section instead of being folded into the state+rate
// summary in B2CS - the same threshold GSTR-1 itself uses.
const B2CL_THRESHOLD = 250000

const rateOf = (doc) => Number(doc.gstPercent) || 0
const posOf = (customer) => GST_STATE_CODES[customer?.state] || '97'
const formatDate = (isoDate) => {
  const [y, m, d] = (isoDate || '').split('-')
  return y && m && d ? `${d}-${m}-${y}` : isoDate || ''
}
const formatPeriod = (isoDate) => {
  const [y, m] = (isoDate || '').split('-')
  return y && m ? `${m}${y}` : ''
}
const findCustomer = (customers, partyName) => customers.find(
  (customer) => customer.name.trim().toLowerCase() === (partyName || '').trim().toLowerCase(),
)

// Builds the outward-supply sections of a GSTR-1 return - B2B, B2CL, B2CS,
// CDNR, and an HSN summary - from this period's sales invoices and credit
// notes, in the shape of the GST portal's "Returns Offline Tool" JSON.
// This is a best-effort match to that publicly documented schema, not
// something issued or validated by the GST portal itself - review it (or
// have your CA review it) before relying on it for an actual filing.
//
// Deliberately out of scope: CDNUR (credit/debit notes against large
// unregistered B2C sales), exports, advances received (AT/ATADJ), and the
// "documents issued" summary - all edge cases most small businesses filing
// a domestic-only GSTR-1 won't hit; a credit note against an unregistered
// customer is simply left out of the export rather than misclassified.
export const buildGstr1 = (invoices, creditNotes, customers, items, org, from, to) => {
  const periodInvoices = invoices.filter(
    (invoice) => !invoice.voided && (!from || invoice.date >= from) && (!to || invoice.date <= to),
  )
  const periodNotes = creditNotes.filter((note) => (!from || note.date >= from) && (!to || note.date <= to))

  const b2bByGstin = new Map()
  const b2cl = []
  const b2csByKey = new Map()

  periodInvoices.forEach((invoice) => {
    const customer = findCustomer(customers, invoice.partyName)
    const gstin = customer?.gstin?.trim()
    const pos = posOf(customer)
    const itms = [{
      num: 1,
      itm_det: { rt: rateOf(invoice), txval: invoice.taxable, iamt: invoice.igst, camt: invoice.cgst, samt: invoice.sgst, csamt: 0 },
    }]
    if (gstin) {
      const bucket = b2bByGstin.get(gstin) || { ctin: gstin, inv: [] }
      bucket.inv.push({ inum: invoice.number, idt: formatDate(invoice.date), val: invoice.total, pos, rchrg: 'N', inv_typ: 'R', itms })
      b2bByGstin.set(gstin, bucket)
    } else if (invoice.interState && invoice.total > B2CL_THRESHOLD) {
      b2cl.push({ inum: invoice.number, idt: formatDate(invoice.date), val: invoice.total, pos, itms })
    } else {
      const key = `${pos}-${rateOf(invoice)}-${invoice.interState ? 'INTER' : 'INTRA'}`
      const bucket = b2csByKey.get(key) || {
        sply_ty: invoice.interState ? 'INTER' : 'INTRA', pos, typ: 'OE', rt: rateOf(invoice), txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0,
      }
      bucket.txval = round2(bucket.txval + invoice.taxable)
      bucket.iamt = round2(bucket.iamt + invoice.igst)
      bucket.camt = round2(bucket.camt + invoice.cgst)
      bucket.samt = round2(bucket.samt + invoice.sgst)
      b2csByKey.set(key, bucket)
    }
  })

  const cdnrByGstin = new Map()
  periodNotes.forEach((note) => {
    const customer = findCustomer(customers, note.partyName)
    const gstin = customer?.gstin?.trim()
    if (!gstin) return
    const originalInvoice = invoices.find((invoice) => invoice.id === note.docId)
    const rate = originalInvoice ? rateOf(originalInvoice) : (note.taxable > 0 ? round2((note.cgst + note.sgst + note.igst) / note.taxable * 100) : 0)
    const bucket = cdnrByGstin.get(gstin) || { ctin: gstin, nt: [] }
    bucket.nt.push({
      ntty: 'C',
      nt_num: note.number,
      nt_dt: formatDate(note.date),
      pos: posOf(customer),
      itms: [{ num: 1, itm_det: { rt: rate, txval: note.taxable, iamt: note.igst, camt: note.cgst, samt: note.sgst, csamt: 0 } }],
    })
    cdnrByGstin.set(gstin, bucket)
  })

  const hsnByCode = new Map()
  periodInvoices.forEach((invoice) => {
    (invoice.items || []).forEach((line) => {
      const taxable = round2((Number(line.qty) || 0) * (Number(line.rate) || 0))
      if (taxable <= 0) return
      const code = items.find((item) => item.id === line.itemId)?.hsnSac || 'NA'
      const gst = calcGst(taxable, invoice.gstPercent, invoice.interState)
      const existing = hsnByCode.get(code) || { hsn_sc: code, desc: code, uqc: 'OTH-OTHERS', qty: 0, txval: 0, rt: rateOf(invoice), iamt: 0, camt: 0, samt: 0, csamt: 0 }
      existing.qty = round2(existing.qty + (Number(line.qty) || 0))
      existing.txval = round2(existing.txval + taxable)
      existing.iamt = round2(existing.iamt + gst.igst)
      existing.camt = round2(existing.camt + gst.cgst)
      existing.samt = round2(existing.samt + gst.sgst)
      hsnByCode.set(code, existing)
    })
  })

  return {
    gstin: org.gstin || '',
    fp: formatPeriod(from),
    version: 'GST3.0.4',
    b2b: [...b2bByGstin.values()],
    b2cl,
    b2cs: [...b2csByKey.values()],
    cdnr: [...cdnrByGstin.values()],
    hsn: { data: [...hsnByCode.values()].map((row, index) => ({ num: index + 1, ...row })) },
  }
}
