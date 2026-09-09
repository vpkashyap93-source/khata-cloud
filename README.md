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
  bills auto-post their entry (`buildInvoiceJournalLines` /
  `buildBillJournalLines`) so users never touch a debit/credit form
  unless they want to.
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
- Exporting reports to PDF/Excel.
