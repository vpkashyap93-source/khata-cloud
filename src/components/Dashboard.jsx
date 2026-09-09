import { accountBalance, cashTrend, monthlyIncomeExpense, topExpenseAccounts, invoiceStats, round2 } from '../lib/accounting.js'

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const monthLabel = (key) => new Date(`${key}-01`).toLocaleDateString('en-IN', { month: 'short' })

function KpiCard({ label, value, tone, sub }) {
  return (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function CashTrendChart({ points }) {
  if (points.length < 2) {
    return <p className="empty-note">Post a few transactions to see your cash trend here.</p>
  }
  const width = 560
  const height = 160
  const padding = { top: 24, right: 12, bottom: 22, left: 46 }
  const values = points.map((point) => point.balance)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom
  const xFor = (index) => padding.left + (index / (points.length - 1)) * plotWidth
  const yFor = (value) => padding.top + plotHeight - ((value - min) / range) * plotHeight
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(point.balance).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${xFor(points.length - 1).toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} L ${xFor(0).toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} Z`
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Cash position trend, currently ${money(last.balance)}`}>
      <line x1={padding.left} y1={padding.top} x2={width - padding.right} y2={padding.top} className="chart-grid" />
      <line x1={padding.left} y1={padding.top + plotHeight / 2} x2={width - padding.right} y2={padding.top + plotHeight / 2} className="chart-grid" />
      <line x1={padding.left} y1={padding.top + plotHeight} x2={width - padding.right} y2={padding.top + plotHeight} className="chart-grid" />
      <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className="chart-axis-label">{money(max)}</text>
      <text x={padding.left - 8} y={padding.top + plotHeight + 4} textAnchor="end" className="chart-axis-label">{money(min)}</text>
      <path d={areaPath} className="chart-area" />
      <path d={linePath} className="chart-line" />
      <circle cx={xFor(points.length - 1)} cy={yFor(last.balance)} r="4.5" className="chart-dot" />
      <text
        x={xFor(points.length - 1) - 6}
        y={yFor(last.balance) < padding.top + 16 ? yFor(last.balance) + 16 : yFor(last.balance) - 10}
        textAnchor="end"
        className="chart-point-label"
      >
        {money(last.balance)}
      </text>
    </svg>
  )
}

function IncomeExpenseChart({ series }) {
  const width = 560
  const height = 170
  const padding = { top: 12, right: 12, bottom: 24, left: 12 }
  const max = Math.max(...series.map((row) => Math.max(row.income, row.expense)), 1)
  const plotHeight = height - padding.top - padding.bottom
  const groupWidth = (width - padding.left - padding.right) / series.length
  const barWidth = Math.min(20, groupWidth / 3)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income versus expense for the last six months">
      <line x1={padding.left} y1={padding.top + plotHeight} x2={width - padding.right} y2={padding.top + plotHeight} className="chart-grid" />
      {series.map((row, index) => {
        const groupX = padding.left + index * groupWidth + groupWidth / 2
        const incomeHeight = (row.income / max) * plotHeight
        const expenseHeight = (row.expense / max) * plotHeight
        return (
          <g key={row.month}>
            <rect x={groupX - barWidth - 2} y={padding.top + plotHeight - incomeHeight} width={barWidth} height={Math.max(incomeHeight, 1)} rx="3" className="bar-income" />
            <rect x={groupX + 2} y={padding.top + plotHeight - expenseHeight} width={barWidth} height={Math.max(expenseHeight, 1)} rx="3" className="bar-expense" />
            <text x={groupX} y={height - 6} textAnchor="middle" className="chart-axis-label">{monthLabel(row.month)}</text>
          </g>
        )
      })}
    </svg>
  )
}

export default function Dashboard({ accounts, entries, invoices, bills }) {
  const receivable = accounts.find((account) => account.name === 'Accounts Receivable')
  const payable = accounts.find((account) => account.name === 'Accounts Payable')
  const cash = accounts.find((account) => account.name === 'Cash')
  const bank = accounts.find((account) => account.name === 'Bank')

  const receivableBalance = receivable ? accountBalance(receivable, entries).balance : 0
  const payableBalance = payable ? accountBalance(payable, entries).balance : 0
  const cashBalance = cash ? accountBalance(cash, entries).balance : 0
  const bankBalance = bank ? accountBalance(bank, entries).balance : 0

  const monthStart = new Date().toISOString().slice(0, 8) + '01'
  const incomeAccounts = accounts.filter((account) => account.type === 'income')
  const expenseAccounts = accounts.filter((account) => account.type === 'expense')
  const monthEntries = entries.filter((entry) => entry.date >= monthStart)
  const monthIncome = incomeAccounts.reduce((total, account) => total + accountBalance(account, monthEntries).balance, 0)
  const monthExpense = expenseAccounts.reduce((total, account) => total + accountBalance(account, monthEntries).balance, 0)
  const netProfit = round2(monthIncome - monthExpense)

  const trend = cashTrend(accounts, entries)
  const series = monthlyIncomeExpense(accounts, entries, 6)
  const topExpenses = topExpenseAccounts(accounts, entries, 5)
  const salesStats = invoiceStats(invoices)
  const purchaseStats = invoiceStats(bills)
  const maxExpense = Math.max(...topExpenses.map((row) => row.amount), 1)

  const recent = entries.slice(0, 6)
  const accountName = (id) => accounts.find((account) => account.id === id)?.name || 'Unknown'

  return (
    <div className="dashboard">
      <div className="kpi-row">
        <KpiCard label="Cash &amp; Bank" value={money(cashBalance + bankBalance)} tone="blue" sub={`Cash ${money(cashBalance)} · Bank ${money(bankBalance)}`} />
        <KpiCard label="Receivables" value={money(receivableBalance)} tone="green" sub={`${salesStats.overdueCount} overdue invoice${salesStats.overdueCount === 1 ? '' : 's'}`} />
        <KpiCard label="Payables" value={money(payableBalance)} tone="orange" sub={`${purchaseStats.unpaidCount} unpaid bill${purchaseStats.unpaidCount === 1 ? '' : 's'}`} />
        <KpiCard label="Net Profit (MTD)" value={money(netProfit)} tone={netProfit >= 0 ? 'green' : 'orange'} sub={`Income ${money(monthIncome)} · Expense ${money(monthExpense)}`} />
      </div>

      <div className="dash-grid">
        <div className="dash-card wide">
          <div className="dash-card-head"><h3>Cash position</h3><span className="dash-card-sub">Running Cash + Bank balance</span></div>
          <CashTrendChart points={trend} />
        </div>

        <div className="dash-card wide">
          <div className="dash-card-head"><h3>Income vs. Expense</h3><span className="dash-card-sub">Last 6 months</span></div>
          <div className="legend-row">
            <span className="legend-item"><i className="swatch income" /> Income</span>
            <span className="legend-item"><i className="swatch expense" /> Expense</span>
          </div>
          <IncomeExpenseChart series={series} />
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><h3>Top expenses</h3><span className="dash-card-sub">All time</span></div>
          {topExpenses.length === 0 && <p className="empty-note">No expenses posted yet.</p>}
          {topExpenses.map((row) => (
            <div className="expense-row" key={row.account.id}>
              <div className="expense-row-head">
                <span>{row.account.name}</span>
                <span>{money(row.amount)}</span>
              </div>
              <div className="expense-bar-track">
                <div className="expense-bar-fill" style={{ width: `${(row.amount / maxExpense) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="dash-card">
          <div className="dash-card-head"><h3>Invoices &amp; bills</h3><span className="dash-card-sub">Status snapshot</span></div>
          <div className="status-row">
            <span className="status-pill paid">Paid</span>
            <span>{salesStats.paidCount} invoices · {money(salesStats.paidAmount)}</span>
          </div>
          <div className="status-row">
            <span className="status-pill due">Unpaid</span>
            <span>{salesStats.unpaidCount} invoices · {money(salesStats.unpaidAmount)}</span>
          </div>
          <div className="status-row">
            <span className="status-pill overdue">Overdue</span>
            <span>{salesStats.overdueCount} invoices · {money(salesStats.overdueAmount)}</span>
          </div>
          <div className="status-row" style={{ marginTop: 10 }}>
            <span className="status-pill due">Bills unpaid</span>
            <span>{purchaseStats.unpaidCount} bills · {money(purchaseStats.unpaidAmount)}</span>
          </div>
        </div>

        <div className="dash-card wide">
          <div className="dash-card-head"><h3>Recent activity</h3><span className="dash-card-sub">Latest journal entries</span></div>
          {recent.length === 0 && <p className="empty-note">Nothing posted yet - add a journal entry, invoice, or bill.</p>}
          {recent.length > 0 && (
            <table className="recent-table">
              <thead><tr><th>Date</th><th>Narration</th><th className="amt">Amount</th></tr></thead>
              <tbody>
                {recent.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.narration}<div className="recent-sub">{entry.lines.map((line) => accountName(line.accountId)).join(' → ')}</div></td>
                    <td className="amt">{money(entry.lines.reduce((total, line) => total + (Number(line.debit) || 0), 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
