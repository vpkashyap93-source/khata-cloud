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
- **Reports**: computed on the client from the live journal entries -
  Trial Balance, date-ranged Profit & Loss, and an as-of-date Balance
  Sheet (`src/lib/accounting.js`).

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

## Not in this first pass

- Inviting additional team members into an existing org (each signup
  currently gets its own single-owner org).
- Editing/voiding a posted invoice, bill, or journal entry.
- Exporting reports to PDF/Excel (invoices/bills do have a print view).
