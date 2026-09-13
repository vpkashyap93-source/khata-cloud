import { round2 } from './accounting.js'

// Recognizes both this app's own CSV template and (best-effort) the
// column names the GST portal's own GSTR-2B Excel typically uses, once
// currency symbols/parentheses/spaces are stripped and everything is
// lowercased - so a business pasting straight from their portal download's
// "B2B" sheet usually doesn't need to rename anything.
const FIELD_BY_NORMALIZED_HEADER = {
  gstinofsupplier: 'gstin', gstin: 'gstin', suppliergstin: 'gstin',
  tradelegalname: 'vendorName', tradename: 'vendorName', legalname: 'vendorName', suppliername: 'vendorName', vendorname: 'vendorName',
  invoicenumber: 'invoiceNumber', invno: 'invoiceNumber', invoiceno: 'invoiceNumber', documentnumber: 'invoiceNumber',
  invoicedate: 'invoiceDate', documentdate: 'invoiceDate',
  invoicevalue: 'invoiceValue', invvalue: 'invoiceValue',
  taxablevalue: 'taxableValue',
  integratedtax: 'igst', igst: 'igst',
  centraltax: 'cgst', cgst: 'cgst',
  stateuttax: 'sgst', statetax: 'sgst', sgst: 'sgst', uttax: 'sgst',
}

const normalizeHeader = (header) => (header || '').toLowerCase().replace(/[^a-z]/g, '')

// parseCsvObjects already lowercases/trims headers; this maps whichever of
// those headers we recognize onto our own field names, so the rest of the
// reconciliation doesn't care what the source file called each column.
export const parseGstr2bRows = (rows) => {
  if (rows.length === 0) return []
  const fieldByOriginalHeader = {}
  Object.keys(rows[0]).forEach((header) => {
    const field = FIELD_BY_NORMALIZED_HEADER[normalizeHeader(header)]
    if (field) fieldByOriginalHeader[header] = field
  })
  return rows
    .map((row) => {
      const record = {}
      Object.entries(fieldByOriginalHeader).forEach(([header, field]) => { record[field] = row[header] })
      return record
    })
    .filter((record) => record.gstin && record.invoiceNumber)
}

const normalizeInvoiceNumber = (value) => (value || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '')
const matchKey = (gstin, invoiceNumber) => `${(gstin || '').trim().toUpperCase()}::${normalizeInvoiceNumber(invoiceNumber)}`
const findVendor = (vendors, partyName) => vendors.find(
  (vendor) => vendor.name.trim().toLowerCase() === (partyName || '').trim().toLowerCase(),
)

// Rounding differences of a rupee or two between what we booked and what
// the portal shows are normal (paise-level rounding on either side) and
// shouldn't be flagged as a real mismatch.
const AMOUNT_TOLERANCE = 1

// Matches this period's bills (by vendor GSTIN + invoice number) against
// the rows uploaded from a GSTR-2B download, so a business can see - without
// checking every row by hand - which bills are confirmed by their vendor's
// own filing, which have a value mismatch worth a closer look, which are
// missing from the portal entirely (so that ITC isn't safe to claim yet),
// and which portal rows have no matching bill in the books at all (a bill
// that was never entered). Bills whose vendor has no saved GSTIN can't be
// matched by GSTIN at all, so they're reported separately rather than
// silently dropped or wrongly matched.
export const reconcileGstr2b = (uploadedRows, bills, vendors, from, to) => {
  const periodBills = bills.filter((bill) => !bill.voided && (!from || bill.date >= from) && (!to || bill.date <= to))

  const noGstinBills = []
  const bookByKey = new Map()
  periodBills.forEach((bill) => {
    const vendor = findVendor(vendors, bill.partyName)
    if (!vendor?.gstin?.trim()) { noGstinBills.push(bill); return }
    bookByKey.set(matchKey(vendor.gstin, bill.number), { bill, vendor })
  })

  const portalByKey = new Map()
  uploadedRows.forEach((row) => portalByKey.set(matchKey(row.gstin, row.invoiceNumber), row))

  const matched = []
  const mismatched = []
  const missingFromPortal = []
  bookByKey.forEach(({ bill, vendor }, key) => {
    const portalRow = portalByKey.get(key)
    if (!portalRow) {
      missingFromPortal.push({ bill, vendor })
      return
    }
    const bookTax = round2((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0))
    const portalTax = round2((Number(portalRow.cgst) || 0) + (Number(portalRow.sgst) || 0) + (Number(portalRow.igst) || 0))
    const taxableDiff = Math.abs(bill.taxable - (Number(portalRow.taxableValue) || 0))
    const taxDiff = Math.abs(bookTax - portalTax)
    if (taxableDiff > AMOUNT_TOLERANCE || taxDiff > AMOUNT_TOLERANCE) {
      mismatched.push({ bill, vendor, portalRow, taxableDiff: round2(bill.taxable - (Number(portalRow.taxableValue) || 0)), taxDiff: round2(bookTax - portalTax) })
    } else {
      matched.push({ bill, vendor, portalRow })
    }
  })

  const missingFromBooks = []
  portalByKey.forEach((row, key) => { if (!bookByKey.has(key)) missingFromBooks.push(row) })

  return { matched, mismatched, missingFromPortal, missingFromBooks, noGstinBills }
}
