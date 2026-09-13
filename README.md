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
