import { initializeApp } from 'firebase/app'
import {
  getFirestore,
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

// Same Firebase project as the restaurant app (the web API key is public by
// design), but this product lives under its own top-level collections
// ("accountingUsers" / "orgs") so the two never share data.
const firebaseConfig = {
  apiKey: 'AIzaSyCMVGfxpbxJJW2y3imKjRp6adhtR69DfkQ',
  authDomain: 'resturent-order.firebaseapp.com',
  projectId: 'resturent-order',
  storageBucket: 'resturent-order.firebasestorage.app',
  messagingSenderId: '801428487693',
  appId: '1:801428487693:web:9191d342b050119f845f44',
}

export const isFirebaseConfigured = !firebaseConfig.apiKey.startsWith('PASTE_')

let db = null
let auth = null
if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig)
  db = getFirestore(app)
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
