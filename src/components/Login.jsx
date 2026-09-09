import { useState } from 'react'
import { signUp, logIn, resetPassword, isFirebaseConfigured } from '../firebase.js'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password)
      } else if (mode === 'reset') {
        await resetPassword(email.trim())
        setInfo('Password reset email sent - check your inbox.')
      } else {
        await logIn(email.trim(), password)
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''))
    } finally {
      setBusy(false)
    }
  }

  if (!isFirebaseConfigured) {
    return <div className="auth-screen"><div className="auth-card"><p>Firebase is not configured.</p></div></div>
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>Khata Cloud</h1>
        <p className="auth-subtitle">Cloud accounting - ledgers, invoices &amp; reports, always in sync.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
        </label>
        {mode !== 'reset' && (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
        )}
        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Log in'}
        </button>
        <div className="auth-links">
          {mode !== 'login' && <button type="button" onClick={() => setMode('login')}>Log in instead</button>}
          {mode !== 'signup' && <button type="button" onClick={() => setMode('signup')}>Create a new account</button>}
          {mode !== 'reset' && <button type="button" onClick={() => setMode('reset')}>Forgot password?</button>}
        </div>
      </form>
    </div>
  )
}
