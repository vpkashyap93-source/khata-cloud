const paths = {
  dashboard: 'M3 3h7v7H3V3Zm11 0h7v4h-7V3ZM3 12h7v9H3v-9Zm11-4h7v13h-7V8Z',
  accounts: 'M4 4h16v3H4V4Zm0 6h16v3H4v-3Zm0 6h16v3H4v-3Z',
  journal: 'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h8M8 12h8M8 16h5',
  invoices: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Zm2 5h6M9 11h6M9 14h4',
  bills: 'M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 7Zm4 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
  ledger: 'M4 4h7v16H4V4Zm9 0h7v16h-7V4ZM4 10h7M13 10h7',
  reports: 'M5 20V10M11 20V4M17 20v-7',
}

export default function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
