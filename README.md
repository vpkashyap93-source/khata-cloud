# Khata Cloud

A cloud accounting app: a Zoho Books/QuickBooks-style dashboard,
double-entry journal entries, GST-ready sales invoices and purchase
bills, a per-account ledger, and live Trial Balance / Profit & Loss /
Balance Sheet reports - all backed by Firebase, in real time.

## How it works

- **Auth**: Firebase Authentication (email/password). Signing up the
  first time creates an organisation for that user, seeded with a
  default chart of accounts (`src/lib/accounting.js`).
- **Data**: Firestore, scoped under `orgs/{orgId}/...` (`accounts`,
  `journalEntries`, `invoices`, `bills`). Every screen subscribes with
  `onSnapshot`, so any change shows up on every open device instantly -
  no manual sync/backup step.
- **Double-entry**: every transaction - manual journal entry, invoice,
  or bill - becomes one balanced journal entry (`validateJournalLines`
  enforces debit total == credit total before it's saved). Invoices and
  bills always post to Accounts Receivable/Payable first
  (`buildInvoiceJournalLines` / `buildBillJournalLines`); money actually
  received or paid is recorded afterwards, separately, via "Record
  payment" (`buildPaymentJournalLines`) - so partial payments and an
  accurate balance-due are tracked correctly, the way real books work.
- **Estimates**: a quote with the same party/items/GST shape as a Sales
  Invoice, but no accounting effect of its own - "Convert to Invoice"
  posts the real invoice and journal entry (reusing
  `buildInvoiceJournalLines` directly) only once the customer accepts.
- **Customers, Vendors, Items**: reusable contact and product/service
  catalogs (with HSN/SAC codes and default rates) that invoices and
  bills pick from - typing a new party name on an invoice also adds it
  to Customers/Vendors automatically.
- **Business Settings**: company name, GSTIN, address and invoice/bill
  numbering, used as the letterhead on every printable invoice and bill.
- **Credit &amp; debit notes**: a return or correction against a posted
  invoice ("Credit Note") or bill ("Debit Note"), taxed at the original
  document's own GST rate and capped at what's left of it
  (`buildCreditNoteJournalLines` / `buildDebitNoteJournalLines`,
  `creditableAmount`).
- **Inventory**: a goods item can opt into stock tracking with an
  opening balance; every sale, purchase, and manual adjustment posts a
  stock movement, netting out to a live stock-on-hand figure
  (`stockOnHand`).
- **Void, not edit**: a posted journal entry, invoice, or bill is never
  rewritten - voiding it posts an equal-and-opposite reversing entry
  (`reverseLines`), so the books keep a full audit trail while every
  balance, ledger, and report nets back to zero on its own. Only
  available before any payment or note has been recorded against a
  document (`canVoid`).
- **Reports**: computed on the client from the live journal entries -
  Trial Balance, date-ranged Profit & Loss, an as-of-date Balance
  Sheet, and a GSTR-style GST Summary (output tax on sales net of
  credit notes, against input tax credit on purchases net of debit
  notes, netted per GST head) (`src/lib/accounting.js`).
- **Command Palette**: press Ctrl/Cmd+K (or tap Search in the topbar)
  to jump anywhere or find anything instantly - invoices, bills,
  estimates, customers, vendors, items, accounts, and journal entries,
  searched client-side against the same live data every screen already
  renders from, with full keyboard navigation
  (`src/components/CommandPalette.jsx`).
- **Dark mode**: the sun/moon toggle in the topbar switches every
  screen between light and dark instantly - the whole design is built
  on CSS custom properties (`src/index.css`), so a single
  `data-theme="dark"` attribute on `<html>` re-themes colors, shadows,
  and inputs everywhere at once. The choice is remembered in
  `localStorage` and restored on the next visit.
- **Offline support**: Firestore's persistent local cache
  (`initializeFirestore` with `persistentLocalCache` in `src/firebase.js`)
  keeps the last-synced data readable with no connection, and queues
  any invoice, bill, or journal entry you save offline to sync
  automatically once you're back - a banner in the topbar says so
  while it's happening. The app itself is installable and loads with
  no connection too, via a manifest (`public/manifest.webmanifest`)
  and a small same-origin-only service worker (`public/sw.js`) that
  never touches Firebase/Auth traffic.
- **CSV export**: every report (Trial Balance, Profit &amp; Loss,
  Balance Sheet, GST Summary) and the Ledger have an Export CSV button
  that builds the file client-side (`src/lib/csv.js`) from the exact
  numbers already on screen - no export service, and it opens correctly
  in Excel (UTF-8 with a BOM, so the ₹ sign doesn't get mangled).
- **Due dates**: every invoice and bill has a real due date (defaulting
  to the org's configurable payment terms, Settings → Invoicing), and
  "overdue" is computed from that date, not just "any amount still
  owed" (`computeDueDate` / `isOverdue` in `src/lib/accounting.js`).
  The Dashboard's "Upcoming dues" widget lists the nearest-due unpaid
  invoices and bills, overdue ones first (`upcomingDues`).
- **Recurring invoices &amp; bills**: a saved template (party, items, GST,
  frequency) for a monthly retainer, subscription, or a recurring vendor
  charge like rent. There's no server here to fire it in the background, so
  it isn't a true background job - the next invoice/bill generates the next
  time someone opens Khata Cloud on or after the scheduled date
  (`isTemplateDue` / `advanceDate` in `src/lib/accounting.js`, checked once
  on load in `App.jsx`), catching up one period at a time if several were
  missed. A template can be paused/resumed at any time
  (`src/components/Recurring.jsx`, shared between Recurring Invoices and
  Recurring Bills the same way Invoicing.jsx shares one form between Sales
  Invoices and Purchase Bills).
- **Payment reminders**: unpaid or overdue invoices get Email and WhatsApp
  action-pills that open a pre-filled `mailto:`/`wa.me:` message using the
  customer's saved contact details - nothing is sent automatically, the
  business owner reviews and sends it themselves.
- **Bank reconciliation**: tick off each Cash/Bank transaction as it shows
  up on the real bank/passbook statement (`src/components/Reconciliation.jsx`,
  stored per account+entry in `reconciledEntries`); the reconciled total is
  checked against a statement closing balance you enter yourself - there's
  no live bank feed here, so nothing is fetched or matched automatically.
- **Aging report**: a Reports → Aging tab groups unpaid invoices and bills
  into Current / 1-30 / 31-60 / 61-90 / 90+ day buckets by how overdue they
  are (`computeAging` in `src/lib/accounting.js`), so it's obvious at a
  glance who's owed money the longest and who you owe the longest.
- **Team**: a business can have more than one person on it. Settings → Team
  shows a business code (the org's own id) - anyone who signs up with that
  code in "Business code" joins the same books instead of starting a new
  business, with full access (no separate roles yet). See "Firestore
  security rules" below - this needs a one-time rule change to actually
  take effect, since the org id no longer equals the only uid allowed to
  touch it.
- **Audit trail**: every save is stamped with who made it - `createdBy` on
  new records, `lastModifiedBy`/`lastModifiedAt` on updates - centrally in
  `addOrgDoc`/`setOrgDoc` (`src/firebase.js`), so it applies everywhere
  without every screen having to remember to pass it along. Shown as "by
  someone@example.com" on Journal entries, Invoices/Bills, and Recurring
  templates - useful now that a business can have more than one person on
  its books (see Team, above).
- **Opening balances**: a business switching to Khata Cloud isn't starting
  at zero - Opening Balances (`src/components/OpeningBalances.jsx`) brings
  in account balances, what customers already owe, and what's already owed
  to vendors, as of a chosen date. Never a raw overwrite: account balances
  post as one balanced journal entry against a found-or-created "Opening
  Balance Equity" account (`buildOpeningBalanceLines` in
  `src/lib/accounting.js`); customer/vendor balances post as real
  `OB`-numbered invoices/bills, so they show up in that party's own history
  and count correctly toward Aging and Dashboard's upcoming dues, not just
  as one lump sum. Safe to use more than once (e.g. one party at a time).
- **Multiple bank accounts**: any asset account other than Accounts
  Receivable/Input GST Credit (`liquidAccounts` in `src/lib/accounting.js`)
  counts as a place money can be received into or paid from - so adding a
  second (or third) bank account in Chart of Accounts makes it show up
  everywhere a payment or reconciliation account is picked, and in the
  Dashboard's Cash &amp; Bank total, not just the two seeded by default.
- **Transfer Funds**: moving money between your own accounts - Cash to
  Bank, or one bank account to another - isn't income or an expense, so
  `src/components/TransferFunds.jsx` gives it its own simple From/To/amount
  form instead of routing everyone through a manual Journal Entry. Posts
  one journal entry and never touches Profit &amp; Loss; voidable from the
  Journal like a manual entry, since it's a self-contained transaction
  nothing else depends on.
- **Search &amp; date filter**: Sales Invoices and Purchase Bills have a
  search box (party name or number) and a From/To date range above the
  list (`src/components/Invoicing.jsx`), filtered client-side over the
  data already on screen - no extra query - so finding an old invoice
  doesn't mean scrolling through everything that came after it.
- **Logo on invoices**: Settings → Business Profile can upload a logo -
  resized and compressed to a small JPEG right in the browser and stored
  directly on the org doc, so it needs no Firebase Storage bucket or any
  other setup step. Shown on the printed letterhead of invoices, bills, and
  estimates.
- **Purchase Orders**: the purchase-side mirror of Estimates
  (`src/components/PurchaseOrders.jsx`) - a PO sent to a vendor before a
  bill, same shape (party, items, GST) but no accounting effect of its own
  until "Convert to Bill" posts the real bill and journal entry, reusing
  `buildBillJournalLines` exactly the way Estimates reuses
  `buildInvoiceJournalLines`.
- **Low stock alert**: a tracked item can have an optional reorder level -
  once stock falls to or below it, the item is flagged in the Items table
  and listed on the Dashboard (`lowStockItems` in `src/lib/accounting.js`).
  Leaving the reorder level at 0 (the default) opts an item out, so nothing
  is flagged just for reaching zero stock unless you asked for that alert.
- **HSN/SAC-wise GST breakdown**: the GST Summary report has two extra
  tables - Sales and Purchases each broken down by their line items' own
  HSN/SAC code (`hsnSummary` in `src/lib/accounting.js`, included in the CSV
  export too) - the shape a GSTR-1 filing actually asks for, not just one
  combined total. A line with no catalog item, or whose item has no code,
  groups under "Not specified" rather than being dropped.
- **Statement of Account**: pick a customer or vendor (`src/components/Statements.jsx`)
  to see what they owe you, or what you owe them, right now - open
  invoices/bills with balances due, plus the full document history and any
  credit/debit notes - and print it to send. Built entirely from
  invoices/bills and their notes (which already carry a real `partyName`),
  not a fabricated day-by-day running balance - this app only tracks each
  document's own cumulative amount paid, not a separately dated record per
  partial payment, so it shows open items and history honestly instead of
  inventing payment dates it doesn't have.
- **Delivery Challan**: goods sent without a tax invoice - for approval,
  job work, a sample, or on returnable loan (`src/components/DeliveryChallan.jsx`).
  No GST and no accounting effect (no journal entry, no Accounts
  Receivable), but a tracked item still gets a stock movement, since the
  goods really did leave the premises whether or not they were ever
  invoiced.
- **Full data backup**: Settings → Data Backup downloads every collection
  (accounts, journal entries, invoices, bills, customers, vendors, items,
  notes, stock movements, estimates, purchase orders, delivery challans,
  recurring templates, reconciled entries) plus the org profile as one JSON
  file (`downloadJson` in `src/lib/csv.js`) - the business's own copy of its
  data, readable independently of this app or Firebase. Not a restore tool,
  just a safety net.
- **CSV import for Customers, Vendors, and Items**: a business switching
  over usually already has these lists in a spreadsheet - each screen's
  "Bulk Import" section (`src/components/CsvImport.jsx`, `parseCsvObjects`
  in `src/lib/csv.js`) accepts a CSV with a header row, skips any row with
  a blank name or a name that already exists (case-insensitively, including
  duplicates within the same file), and reports how many were added vs.
  skipped - safe to re-import the same file twice. A "Download CSV
  template" link on each screen shows the exact columns expected.
- **GSTR-1 export**: Reports -> GSTR-1 Export builds the B2B, B2CL, B2CS,
  CDNR, and HSN sections of a GSTR-1 return from the period's sales
  invoices and credit notes, in the shape of the GST portal's own
  "Returns Offline Tool" JSON (`buildGstr1` in `src/lib/gstr1.js`), plus a
  human-readable CSV companion. Classification (B2B vs. B2C, place of
  supply) depends on each Customer's GSTIN and State (`src/lib/gstStateCodes.js`
  has the official 2-digit state codes; Customers/Vendors got a State field
  for this). Deliberately out of scope: exports, advances (AT/ATADJ), the
  documents-issued summary, and credit/debit notes against unregistered
  customers (CDNUR) - edge cases most small domestic-only filers won't
  hit. This is a best-effort match to the publicly documented schema, not
  something issued or validated by the GST portal - the screen says so,
  and flags both a missing org GSTIN and any invoice whose party name
  doesn't match a saved customer (so it was defaulted to B2C).
- **Purchase Register**: Reports -> Purchase Register lists the period's
  bills and debit notes vendor-wise (`buildPurchaseRegister` in
  `src/lib/purchaseRegister.js`), with an HSN/SAC summary and a CSV
  export. This is deliberately not a GSTR-2A/2B - that statement is
  generated by the GST portal from what your vendors themselves reported
  in their own GSTR-1, so no accounting software can produce it from its
  own data. What this register is for: checking line by line against the
  2A/2B you download from the portal (Returns Dashboard) - a bill here
  with no matching row there usually means that vendor hasn't filed yet,
  or filed it differently, so that ITC isn't safe to claim until it shows
  up. Flags any bill whose party name doesn't match a saved vendor.
- **GSTR-2B Match**: Reports -> GSTR-2B Match automates that check. This
  app can't download your GSTR-2B itself (only the GST portal can, since
  it's built from your vendors' own filings), but once you've downloaded
  it there and saved the B2B sheet as CSV, uploading it here
  (`parseGstr2bRows`/`reconcileGstr2b` in `src/lib/gstr2bReconcile.js`)
  matches it against this period's bills by vendor GSTIN + invoice number
  and sorts them into four buckets: matched, mismatched (amount differs -
  worth a closer look), missing from the portal (booked but not yet in
  your vendor's filing, so that ITC isn't safe to claim yet), and missing
  from your books (a portal row with no matching bill - something you may
  not have entered). Recognizes both this app's own CSV template and,
  best-effort, several of the portal's own Excel column names. Bills whose
  vendor has no saved GSTIN can't be matched at all and are flagged
  separately rather than silently skipped.
- **GSTR-3B Summary**: Reports -> GSTR-3B Summary is a worksheet for the
  return tax actually gets paid through - filled in directly on the GST
  portal rather than uploaded as a file, so this is meant to be copied
  across, not filed from (`buildGstr3b` in `src/lib/gstr3b.js`). Built
  from the same totals GSTR-1 and Purchase Register already use: Table
  3.1(a) outward taxable supplies, Table 3.2 interstate supplies to
  unregistered persons (state-wise, reusing GSTR-1's B2CS/B2CL data), Table
  4 eligible ITC (reported as one "all other ITC" figure - imports,
  reverse charge, and ISD credit aren't tracked here), and Table 6.1 tax
  payable/paid. Table 6.1's cash-payable figures apply GST's actual
  IGST-first ITC set-off order (Rule 88A) rather than netting each tax
  head separately, since that would overstate cash due whenever IGST
  credit is available to cover a CGST/SGST shortfall - still worth
  checking against the portal's own set-off calculation before paying.
- **GSTR-9 Annual**: Reports -> GSTR-9 Annual is the same worksheet as
  GSTR-3B rolled up over a financial year (1 April - 31 March, defaulted
  to the current one - `financialYearRange` in `src/lib/gstr9.js`) instead
  of one period, since GSTR-9 (the annual return) is itself a once-a-year
  roll-up of the same figures already reported monthly. Adds Part VI, an
  annual HSN-wise summary. Same gaps as GSTR-3B (no exports, advances, or
  reverse charge) plus Part V (amendments to prior-year figures in
  returns filed this year) - also filled in directly on the portal, so
  copy it across and check it against the 12 months of returns actually
  filed for the year.
- **GSTR-9C Reconciliation**: Reports -> GSTR-9C Reconciliation covers
  only that form's central check - turnover per Profit & Loss against
  turnover per GST returns for the year (`buildGstr9cCore` in
  `src/lib/gstr9c.js`) - not the full official form, which needs audited
  financial statements and a dozen adjustment categories (discounts,
  unbilled revenue, deemed supplies) this app has no way to know about.
  In a business that books all its sales through this app the two totals
  should already match; a mismatch here is worth chasing down (most often
  a manual journal entry credited straight to Sales Revenue without going
  through an invoice) before it becomes a bigger one on the actual 9C,
  which still needs a CA to prepare and certify.
- **Print / PDF for every report**: every screen under Reports (Trial
  Balance, P&L, Balance Sheet, GST Summary, all six GST return worksheets,
  and Aging) has a "Print / PDF" button next to its CSV export. It opens
  the same letterhead print overlay already used for invoices and bills
  (`ReportPrintView` in `src/components/Reports.jsx`), reusing each
  report's own already-rendered tables as-is so the print/PDF output can
  never drift from what's on screen - "Save as PDF" is one of the
  destinations in the browser's own print dialog, so no PDF library is
  needed. The print sheet's tables pin their colors to light-mode values
  regardless of the app's current theme, so a report printed from dark
  mode doesn't come out with an unreadable dark table header on an
  otherwise white page.
- **Quick Entry**: a fast bulk-entry grid for simple cash/bank vouchers
  (`src/components/QuickEntry.jsx`) - pick a direction (Receipt/Payment)
  and a bank/cash account once, then add as many dated rows (date,
  account, party name, narration, amount) as needed and post them all in
  one save. Each row becomes its own two-line journal entry - the bank/
  cash account on one side, the row's own account on the other - posted
  with source `manual`, so these show up in, and can be voided from, the
  regular Journal Voucher register and share its JV-#### numbering. For
  anything with GST, Sales Invoices/Purchase Bills are still the right
  screen - this posts straight to the ledger with no tax calculated.

## Run locally

```bash
npm install
npm run dev
```

The Firebase web API key in `src/firebase.js` is a public client key,
safe to ship. Email/Password sign-in must be enabled for the Firebase
project under Authentication → Sign-in method, or signup will fail.

## Live demo

Pushing to `main` builds and deploys this app to GitHub Pages via
`.github/workflows/deploy.yml` (Settings → Pages → Source must be set
to "GitHub Actions" once, the first time).

## Firestore security rules (required for Team to work)

Team support means a business's data is no longer readable/writable only
by the uid that matches its org id - it's readable/writable by anyone
listed in that org's `members` subcollection. That needs a rule change in
the Firebase console (Firestore Database → Rules → paste, then Publish) -
this can't be done from this repo, since Firestore rules aren't project
files, they're a separate config on the Firebase project itself:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /accountingUsers/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /orgs/{orgId} {
      function isMember() {
        return request.auth != null &&
          exists(/databases/$(database)/documents/orgs/$(orgId)/members/$(request.auth.uid));
      }

      allow read, write: if isMember();

      match /members/{uid} {
        // Anyone signed in can create ONLY their own membership doc (this
        // is how joining with a business code works) - members can read
        // the team list, but never add or remove someone else.
        allow create: if request.auth != null && request.auth.uid == uid;
        allow read, update, delete: if isMember();
      }

      match /{subcollection}/{docId} {
        allow read, write: if isMember();
      }
    }
  }
}
```

If your project's rules already have custom logic beyond the default
(unlikely, since none was set up in this repo), merge rather than
overwrite - message where to look if unsure.

## Not in this first pass

- Actually filing GST returns (the GST Summary report covers what's
  owed; filing itself is out of scope).
- Exporting to PDF (reports export to CSV; invoices/bills have a print
  view, which covers PDF via the browser's own print-to-PDF).
