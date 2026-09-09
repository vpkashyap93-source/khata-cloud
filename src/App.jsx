import { useEffect, useState } from 'react'
import { watchAuthState, ensureOrg, getOrg, watchOrgCollection, logOut, isFirebaseConfigured } from './firebase.js'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import ChartOfAccounts from './components/ChartOfAccounts.jsx'
import JournalEntries from './components/JournalEntries.jsx'
import { Invoices, Bills } from './components/Invoicing.jsx'
import Ledger from './components/Ledger.jsx'
import Reports from './components/Reports.jsx'
import Icon from './components/icons.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'accounts', label: 'Chart of Accounts', icon: 'accounts' },
  { id: 'journal', label: 'Journal', icon: 'journal' },
  { id: 'invoices', label: 'Sales Invoices', icon: 'invoices' },
  { id: 'bills', label: 'Purchase Bills', icon: 'bills' },
  { id: 'ledger', label: 'Ledger', icon: 'ledger' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
]

export default function App() {
  const [user, setUser] = useState(undefined)
  const [org, setOrg] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState([])
  const [invoices, setInvoices] = useState([])
  const [bills, setBills] = useState([])
  const [tab, setTab] = useState('dashboard')
  const [navOpen, setNavOpen] = useState(false)

  useEffect(() => watchAuthState((nextUser) => {
    setUser(nextUser)
    if (!nextUser) setOrg(null)
  }), [])

  useEffect(() => {
    if (!user) return
    let active = true
    ensureOrg(user.uid, user.email).then(async (orgId) => {
      const orgData = await getOrg(orgId)
      if (active) setOrg(orgData)
    })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!org) return
    const unsubs = [
      watchOrgCollection(org.id, 'accounts', setAccounts, 'code'),
      watchOrgCollection(org.id, 'journalEntries', setEntries, 'date'),
      watchOrgCollection(org.id, 'invoices', setInvoices, 'date'),
      watchOrgCollection(org.id, 'bills', setBills, 'date'),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [org])

  if (!isFirebaseConfigured) {
    return <div className="auth-screen"><div className="auth-card"><p>Firebase is not configured for Khata Cloud.</p></div></div>
  }

  if (user === undefined) return <div className="loading-screen">Loading...</div>
  if (user === null) return <Login />
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
        <header className="topbar">
          <button className="nav-toggle" onClick={() => setNavOpen((open) => !open)} aria-label="Toggle menu">☰</button>
          <h1>{currentLabel}</h1>
          <span className="org-name">{org.name}</span>
        </header>
        <main className="app-main">
          {tab === 'dashboard' && <Dashboard accounts={accounts} entries={entries} invoices={invoices} bills={bills} />}
          {tab === 'accounts' && <ChartOfAccounts orgId={org.id} accounts={accounts} />}
          {tab === 'journal' && <JournalEntries orgId={org.id} accounts={accounts} entries={entries} />}
          {tab === 'invoices' && <Invoices orgId={org.id} accounts={accounts} invoices={invoices} />}
          {tab === 'bills' && <Bills orgId={org.id} accounts={accounts} bills={bills} />}
          {tab === 'ledger' && <Ledger accounts={accounts} entries={entries} />}
          {tab === 'reports' && <Reports accounts={accounts} entries={entries} />}
        </main>
      </div>
    </div>
  )
}
