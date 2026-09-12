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
// each business's ledgers isolated under orgs/{orgId}.
export const ensureOrg = async (uid, email) => {
  const userRef = doc(db, 'accountingUsers', uid)
  const userSnap = await getDoc(userRef)
  if (userSnap.exists() && userSnap.data().orgId) {
    return userSnap.data().orgId
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

export const addOrgDoc = async (orgId, name, data) => {
  const ref = doc(collection(db, 'orgs', orgId, name))
  await setDoc(ref, { ...data, createdAt: serverTimestamp() })
  return ref.id
}

export const setOrgDoc = (orgId, name, docId, data) =>
  setDoc(doc(db, 'orgs', orgId, name, docId), data, { merge: true })

export { db }
