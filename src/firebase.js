import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth'
import { DEFAULT_ACCOUNTS } from './lib/accounting.js'

// Dedicated Firebase project for Khata Cloud - separate from the
// restaurant app's project, so the two products never share users or data.
// The web API key is public by design (safe to ship in client code).
const firebaseConfig = {
  apiKey: 'AIzaSyABc2iBGPGWS7OOSMbMWPtXTpH40oO8Jc0',
  authDomain: 'khatacloud-a53c6.firebaseapp.com',
  projectId: 'khatacloud-a53c6',
  storageBucket: 'khatacloud-a53c6.firebasestorage.app',
  messagingSenderId: '1086015124583',
  appId: '1:1086015124583:web:965e349a6e751c629290c2',
}

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('PASTE_')

let db = null
let auth = null
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig)
  // Persistent local cache: reads keep working offline (last synced data),
  // and writes queue in IndexedDB and flush automatically on reconnect -
  // no separate "offline mode" to build, Firestore just does it. Falls back
  // to the plain in-memory client if IndexedDB isn't available (e.g. some
  // private-browsing modes).
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    db = getFirestore(app)
  }
  auth = getAuth(app)
}

export const watchAuthState = (callback) => {
  if (!auth) { callback(null); return () => {} }
  return onAuthStateChanged(auth, callback)
}

export const signUp = (email, password) => createUserWithEmailAndPassword(auth, email, password)
export const logIn = (email, password) => signInWithEmailAndPassword(auth, email, password)
export const logOut = () => signOut(auth)
export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

// Every signed-in user maps to exactly one organisation. The first time a
// user is seen we create a fresh org for them (seeded with a default chart
// of accounts) - this keeps onboarding to a single step while still keeping
// each business's ledgers isolated under orgs/{orgId}. Passing joinCode
// (the org's own id, shared by its owner from Settings -> Team) joins that
// existing org instead of creating a new one - the simplest possible team
// model for a small business: every member gets the same full access, no
// separate invite/approval step. Every org keeps an orgs/{orgId}/members/
// {uid} doc for each person on it (used by Settings to list the team, and
// by Firestore security rules to decide who can read/write that org).
export const ensureOrg = async (uid, email, joinCode) => {
  const userRef = doc(db, 'accountingUsers', uid)
  const userSnap = await getDoc(userRef)
  if (userSnap.exists() && userSnap.data().orgId) {
    const orgId = userSnap.data().orgId
    // Orgs created before the Team feature existed never got a members
    // doc for their own owner - only a brand-new org's creation
    // transaction does that - so isMember() (and everything gated by it)
    // permission-denies that owner on any device without a local
    // Firestore cache built up from before this became a requirement.
    // This merge is idempotent and self-heals it on every sign-in;
    // joinedAt is deliberately left out so it never resets an existing
    // member's actual join date, just backfills the missing doc itself.
    await setDoc(doc(db, 'orgs', orgId, 'members', uid), { email: email || '' }, { merge: true })
    return orgId
  }

  const trimmedCode = (joinCode || '').trim()
  if (trimmedCode) {
    const orgRef = doc(db, 'orgs', trimmedCode)
    const orgSnap = await getDoc(orgRef)
    if (!orgSnap.exists()) {
      throw new Error(`No business found for code "${trimmedCode}" - check the code and try again.`)
    }
    await setDoc(doc(db, 'orgs', trimmedCode, 'members', uid), { email: email || '', joinedAt: serverTimestamp() }, { merge: true })
    await setDoc(userRef, { email: email || '', orgId: trimmedCode }, { merge: true })
    return trimmedCode
  }

  const orgId = uid
  await runTransaction(db, async (tx) => {
    const orgRef = doc(db, 'orgs', orgId)
    const orgSnap = await tx.get(orgRef)
    if (!orgSnap.exists()) {
      tx.set(orgRef, {
        name: email ? email.split('@')[0] : 'My Business',
        ownerUid: uid,
        gstin: '',
        state: '',
        createdAt: serverTimestamp(),
      })
      DEFAULT_ACCOUNTS.forEach((account) => {
        const accountRef = doc(collection(db, 'orgs', orgId, 'accounts'))
        tx.set(accountRef, { ...account, createdAt: serverTimestamp() })
      })
      tx.set(doc(db, 'orgs', orgId, 'members', uid), { email: email || '', joinedAt: serverTimestamp() })
    }
    tx.set(userRef, { email: email || '', orgId }, { merge: true })
  })
  return orgId
}

export const getOrg = async (orgId) => {
  const snap = await getDoc(doc(db, 'orgs', orgId))
  return snap.exists() ? { id: orgId, ...snap.data() } : null
}

// Live subscription to the org profile itself - so a Settings change
// (business name, address, invoice prefix) shows up everywhere it's used
// (letterhead, invoice numbering) without needing to log back in.
export const watchOrg = (orgId, callback) => {
  if (!db) { callback(null); return () => {} }
  return onSnapshot(doc(db, 'orgs', orgId), (snap) => {
    callback(snap.exists() ? { id: orgId, ...snap.data() } : null)
  })
}

export const updateOrg = (orgId, fields) => setDoc(doc(db, 'orgs', orgId), fields, { merge: true })

// Generic real-time subscription to one of an org's sub-collections,
// newest-first. Every screen in the app (accounts, journal entries,
// invoices, bills, customers, vendors) reads through this one helper so
// data is always live across every open device - no manual refresh/sync.
export const watchOrgCollection = (orgId, name, callback, orderField = 'createdAt') => {
  if (!db) { callback([]); return () => {} }
  const q = query(collection(db, 'orgs', orgId, name), orderBy(orderField, 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((item) => ({ id: item.id, ...item.data() })))
  })
}

// Every write is stamped with who made it (createdBy / lastModifiedBy, the
// signed-in user's email) here - centrally, once - so every screen's audit
// trail (who posted this invoice, who voided that entry) comes for free
// without each component having to remember to pass it along.
export const addOrgDoc = async (orgId, name, data) => {
  const ref = doc(collection(db, 'orgs', orgId, name))
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), createdBy: auth?.currentUser?.email || '' })
  return ref.id
}

export const setOrgDoc = (orgId, name, docId, data) =>
  setDoc(
    doc(db, 'orgs', orgId, name, docId),
    { ...data, lastModifiedAt: serverTimestamp(), lastModifiedBy: auth?.currentUser?.email || '' },
    { merge: true },
  )

export { db }
