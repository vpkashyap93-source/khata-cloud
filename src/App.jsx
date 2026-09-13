import { useEffect, useRef, useState } from 'react'
import { watchAuthState, ensureOrg, watchOrg, watchOrgCollection, addOrgDoc, setOrgDoc, logOut, isFirebaseConfigured } from './firebase.js'
import { isTemplateDue, advanceDate, buildInvoiceJournalLines, buildBillJournalLines, calcGst, round2 } from './lib/accounting.js'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import ChartOfAccounts from './components/ChartOfAccounts.jsx'
import JournalEntries from './components/JournalEntries.jsx'
import { Invoices, Bills } from './components/Invoicing.jsx'
import Estimates from './components/Estimates.jsx'
import PurchaseOrders from './components/PurchaseOrders.jsx'
import { RecurringInvoices, RecurringBills } from './components/Recurring.jsx'
import Reconciliation from './components/Reconciliation.jsx'
import TransferFunds from './components/TransferFunds.jsx'
import { Customers, Vendors } from './components/Contacts.jsx'
import Items from './components/Items.jsx'
import Settings from './components/Settings.jsx'
import Ledger from './components/Ledger.jsx'
import Reports from './components/Reports.jsx'
import Statements from './components/Statements.jsx'
import DeliveryChallan from './components/DeliveryChallan.jsx'
import OpeningBalances from './components/OpeningBalances.jsx'
import Icon from './components/icons.jsx'
import CommandPalette from './components/CommandPalette.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'accounts', label: 'Chart of Accounts', icon: 'accounts' },
  { id: 'openingBalances', label: 'Opening Balances', icon: 'asset' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'estimates', label: 'Estimates', icon: 'estimates' },
  { id: 'invoices', label: 'Sales Invoices', icon: 'invoices' },
  { id: 'purchaseOrders', label: 'Purchase Orders', icon: 'bills' },
  { id: 'deliveryChallan', label: 'Delivery Challan', icon: 'invoices' },
  { id: 'bills', label: 'Purchase Bills', icon: 'bills' },
  { id: 'recurring', label: 'Recurring Invoices', icon: 'repeat' },
  { id: 'recurringBills', label: 'Recurring Bills', icon: 'repeat' },
  { id: 'customers', label: 'Customers', icon: 'customers' },
  { id: 'vendors', label: 'Vendors', icon: 'vendors' },
  { id: 'items', label: 'Items', icon: 'items' },
  { id: 'ledger', label: 'Ledger', icon: 'ledger' },
  { id: 'reconciliation', label: 'Reconciliation', icon: 'check' },
  { id: 'transfer', label: 'Transfer Funds', icon: 'repeat' },
  { id: 'statements', label: 'Statements', icon: 'ledger' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

export default function App() {
  const [user, setUser] = useState(undefined)
  const [org, setOrg] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [bills, setBills] = useState([])
  const [customers, setCustomers] = useState([])
  const [vendors, setVendors] = useState([])
  const [items, setItems] = useState([])
  const [creditNotes, setCreditNotes] = useState([])
  const [debitNotes, setDebitNotes] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [estimates, setEstimates] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [deliveryChallans, setDeliveryChallans] = useState([])
  const [recurringTemplates, setRecurringTemplates] = useState([])
  const [reconciledEntries, setReconciledEntries] = useState([])
  const [members, setMembers] = useState([])
  const [orgError, setOrgError] = useState('')
  const joinCodeRef = useRef('')
  const [tab, setTab] = useState('dashboard')
  const [navOpen, setNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('khata-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('khata-theme', theme)
    } catch {
      // ignore - private browsing / storage disabled
    }
  }, [theme])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => watchAuthState((nextUser) => {
    setUser(nextUser)
    if (!nextUser) setOrg(null)
  }), [])

  useEffect(() => {
    if (!user) return
    let unsub = () => {}
    let cancelled = false
    ensureOrg(user.uid, user.email, joinCodeRef.current).then((orgId) => {
      if (cancelled) return
      unsub = watchOrg(orgId, setOrg)
    }).catch((err) => {
      if (cancelled) return
      // A bad join code (or any other setup failure) can't leave the user
      // stuck on a blank "Setting up your business..." screen with no way
      // back - sign them out so Login reappears with the error, letting
      // them log back in (same credentials) and try again.
      joinCodeRef.current = ''
      setOrgError(err.message)
      logOut()
    })
    return () => { cancelled = true; unsub() }
  }, [user])

  useEffect(() => {
    if (!org) return
    const unsubs = [
      watchOrgCollection(org.id, 'accounts', setAccounts, 'code'),
      watchOrgCollection(org.id, 'journalEntries', setEntries, 'date'),
      watchOrgCollection(org.id, 'invoices', setInvoices, 'date'),
      watchOrgCollection(org.id, 'bills', setBills, 'date'),
      watchOrgCollection(org.id, 'customers', setCustomers, 'name'),
      watchOrgCollection(org.id, 'vendors', setVendors, 'name'),
      watchOrgCollection(org.id, 'items', setItems, 'name'),
      watchOrgCollection(org.id, 'creditNotes', setCreditNotes, 'date'),
      watchOrgCollection(org.id, 'debitNotes', setDebitNotes, 'date'),
      watchOrgCollection(org.id, 'stockMovements', setStockMovements, 'date'),
      watchOrgCollection(org.id, 'estimates', setEstimates, 'date'),
      watchOrgCollection(org.id, 'purchaseOrders', setPurchaseOrders, 'date'),
      watchOrgCollection(org.id, 'deliveryChallans', setDeliveryChallans, 'date'),
      watchOrgCollection(org.id, 'recurringTemplates', setRecurringTemplates, 'nextRunDate'),
      watchOrgCollection(org.id, 'reconciledEntries', setReconciledEntries, 'accountId'),
      watchOrgCollection(org.id, 'members', setMembers, 'joinedAt'),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [org])

  // Generate the next invoice/bill for any recurring template whose
  // scheduled date has arrived. This only runs when the app is open -
  // there's no server here to fire it in the background while nobody's
  // looking, so a template just catches up the next time someone loads
  // Khata Cloud on or after its due date. generatingRef guards against
  // firing twice for the same scheduled run while the write is still in
  // flight (this effect can re-run before the Firestore snapshot listener
  // reports the template's advanced nextRunDate).
  const generatingRef = useRef({})
  useEffect(() => {
    if (!org || accounts.length === 0) return
    const dueTemplates = recurringTemplates.filter(
      (template) => isTemplateDue(template) && generatingRef.current[template.id] !== template.nextRunDate,
    )
    if (dueTemplates.length === 0) return
    dueTemplates.forEach(async (template) => {
      generatingRef.current[template.id] = template.nextRunDate
      const isBill = template.docType === 'bill'
      const gst = calcGst(
        round2(template.items.reduce((total, item) => total + (Number(item.qty) || 0) * (Number(item.rate) || 0), 0)),
        template.gstPercent,
        template.interState,
      )
      const prefix = (isBill ? org.billPrefix : org.invoicePrefix) || (isBill ? 'BILL' : 'INV')
      const number = `${prefix}-${String((isBill ? bills.length : invoices.length) + 1).padStart(4, '0')}`
      const docData = {
        number,
        date: template.nextRunDate,
        dueDate: template.nextRunDate,
        partyName: template.partyName,
        items: template.items,
        gstPercent: template.gstPercent,
        interState: template.interState,
        amountPaid: 0,
        adjustedAmount: 0,
        ...gst,
      }
      const lines = isBill ? buildBillJournalLines(accounts, gst) : buildInvoiceJournalLines(accounts, gst)
      const docLabel = isBill ? 'Bill' : 'Invoice'
      const journalEntryId = await addOrgDoc(org.id, 'journalEntries', {
        date: template.nextRunDate,
        narration: `${docLabel} ${number} - ${template.partyName} (recurring)`,
        lines,
        source: isBill ? 'bill' : 'invoice',
      })
      await addOrgDoc(org.id, isBill ? 'bills' : 'invoices', { ...docData, journalEntryId })
      await setOrgDoc(org.id, 'recurringTemplates', template.id, {
        nextRunDate: advanceDate(template.nextRunDate, template.frequency),
        generatedCount: (Number(template.generatedCount) || 0) + 1,
        lastGeneratedDate: template.nextRunDate,
      })
    })
  }, [org, accounts, recurringTemplates, invoices.length, bills.length])

  if (!isFirebaseConfigured) {
    return <div className="auth-screen"><div className="auth-card"><p>Firebase is not configured for Khata Cloud.</p></div></div>
  }

  if (user === undefined) return <div className="loading-screen">Loading...</div>
  if (user === null) {
    return (
      <Login
        onJoinCodeChange={(value) => { joinCodeRef.current = value }}
        externalError={orgError}
        onDismissError={() => setOrgError('')}
      />
    )
  }
  if (!org) return <div className="loading-screen">Setting up your business...</div>

  const currentLabel = NAV.find((item) => item.id === tab)?.label || ''

  const selectTab = (id) => { setTab(id); setNavOpen(false) }

  return (
    <div className={`app-shell ${navOpen ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span className="brand-name">Khata Cloud</span>
        </div>
        <nav className="side-nav">
          {NAV.map((item) => (
            <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="link-button" onClick={logOut}>Log out</button>
        </div>
      </aside>

      <div className="app-body">
        {!isOnline && (
          <div className="offline-banner">
            <Icon name="offline" size={14} />
            You're offline - showing last synced data. Changes will sync automatically once you're back online.
          </div>
        )}
        <header className="topbar">
          <button className="nav-toggle" onClick={() => setNavOpen((open) => !open)} aria-label="Toggle menu">☰</button>
          <h1>{currentLabel}</h1>
          <button className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={15} />
            <span className="search-trigger-label">Search</span>
            <span className="search-trigger-kbd">Ctrl K</span>
          </button>
          <button
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
          <span className="org-name">
            <span className="org-avatar">{(org.name || '?').charAt(0).toUpperCase()}</span>
            {org.name}
          </span>
        </header>
        <main className="app-main">
          {tab === 'dashboard' && <Dashboard accounts={accounts} entries={entries} invoices={invoices} bills={bills} items={items} stockMovements={stockMovements} />}
          {tab === 'accounts' && <ChartOfAccounts orgId={org.id} accounts={accounts} />}
          {tab === 'openingBalances' && <OpeningBalances orgId={org.id} accounts={accounts} customers={customers} vendors={vendors} invoices={invoices} bills={bills} />}
          {tab === 'journal' && <JournalEntries orgId={org.id} accounts={accounts} entries={entries} />}
          {tab === 'estimates' && <Estimates orgId={org.id} accounts={accounts} estimates={estimates} invoices={invoices} customers={customers} items={items} org={org} />}
          {tab === 'purchaseOrders' && <PurchaseOrders orgId={org.id} accounts={accounts} purchaseOrders={purchaseOrders} bills={bills} vendors={vendors} items={items} org={org} />}
          {tab === 'deliveryChallan' && <DeliveryChallan orgId={org.id} challans={deliveryChallans} customers={customers} items={items} org={org} />}
          {tab === 'invoices' && <Invoices orgId={org.id} accounts={accounts} invoices={invoices} customers={customers} items={items} creditNotes={creditNotes} entries={entries} org={org} />}
          {tab === 'bills' && <Bills orgId={org.id} accounts={accounts} bills={bills} vendors={vendors} items={items} debitNotes={debitNotes} entries={entries} org={org} />}
          {tab === 'recurring' && <RecurringInvoices orgId={org.id} templates={recurringTemplates} customers={customers} items={items} />}
          {tab === 'recurringBills' && <RecurringBills orgId={org.id} templates={recurringTemplates} vendors={vendors} items={items} />}
          {tab === 'customers' && <Customers orgId={org.id} customers={customers} />}
          {tab === 'vendors' && <Vendors orgId={org.id} vendors={vendors} />}
          {tab === 'items' && <Items orgId={org.id} items={items} movements={stockMovements} />}
          {tab === 'ledger' && <Ledger accounts={accounts} entries={entries} />}
          {tab === 'reconciliation' && <Reconciliation orgId={org.id} accounts={accounts} entries={entries} reconciledEntries={reconciledEntries} />}
          {tab === 'transfer' && <TransferFunds orgId={org.id} accounts={accounts} entries={entries} />}
          {tab === 'statements' && <Statements customers={customers} vendors={vendors} invoices={invoices} bills={bills} creditNotes={creditNotes} debitNotes={debitNotes} org={org} />}
          {tab === 'reports' && <Reports accounts={accounts} entries={entries} invoices={invoices} bills={bills} creditNotes={creditNotes} debitNotes={debitNotes} items={items} customers={customers} org={org} />}
          {tab === 'settings' && (
            <Settings
              orgId={org.id}
              org={org}
              members={members}
              backupData={{
                accounts,
                journalEntries: entries,
                invoices,
                bills,
                customers,
                vendors,
                items,
                creditNotes,
                debitNotes,
                stockMovements,
                estimates,
                purchaseOrders,
                deliveryChallans,
                recurringTemplates,
                reconciledEntries,
              }}
            />
          )}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={selectTab}
        nav={NAV}
        data={{ accounts, entries, invoices, bills, estimates, purchaseOrders, customers, vendors, items }}
      />
    </div>
  )
}
