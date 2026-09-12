import { useState } from 'react'
import { ACCOUNT_TYPES } from '../lib/accounting.js'
import { addOrgDoc } from '../firebase.js'
import Icon from './icons.jsx'

export default function ChartOfAccounts({ orgId, accounts }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('asset')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const addAccount = async (event) => {
    event.preventDefault()
    setError('')
    if (!name.trim()) return
    if (accounts.some((account) => account.name.toLowerCase() === name.trim().toLowerCase())) {
      setError('An account with that name already exists.')
      return
    }
    await addOrgDoc(orgId, 'accounts', { name: name.trim(), type, code: code.trim(), system: false })
    setName('')
    setCode('')
  }

  return (
    <div className="panel">
      <h2>Chart of Accounts</h2>
      <form className="inline-form" onSubmit={addAccount}>
        <input placeholder="Account name" value={name} onChange={(event) => setName(event.target.value)} />
        <input placeholder="Code (optional)" value={code} onChange={(event) => setCode(event.target.value)} />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {ACCOUNT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <button type="submit">Add account</button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {ACCOUNT_TYPES.map((groupType) => {
        const rows = accounts.filter((account) => account.type === groupType.value)
        if (rows.length === 0) return null
        return (
          <div key={groupType.value} className={`account-type-card type-${groupType.value}`}>
            <div className="account-type-head">
              <div className="account-type-icon"><Icon name={groupType.value} size={17} /></div>
              <h3>{groupType.label}</h3>
              <span className="account-type-count">{rows.length}</span>
            </div>
            <table>
              <thead><tr><th>Code</th><th>Name</th></tr></thead>
              <tbody>
                {rows.map((account) => (
                  <tr key={account.id}>
                    <td className="account-code">{account.code || '-'}</td>
                    <td>{account.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
