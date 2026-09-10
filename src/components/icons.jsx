const paths = {
  dashboard: 'M3 3h7v7H3V3Zm11 0h7v4h-7V3ZM3 12h7v9H3v-9Zm11-4h7v13h-7V8Z',
  accounts: 'M4 4h16v3H4V4Zm0 6h16v3H4v-3Zm0 6h16v3H4v-3Z',
  journal: 'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h8M8 12h8M8 16h5',
  invoices: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Zm2 5h6M9 11h6M9 14h4',
  bills: 'M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 7Zm4 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
  ledger: 'M4 4h7v16H4V4Zm9 0h7v16h-7V4ZM4 10h7M13 10h7',
  reports: 'M5 20V10M11 20V4M17 20v-7',
  customers: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  vendors: 'M3 9l2-5h14l2 5M3 9v10h18V9M3 9h18M9 13v3M15 13v3',
  items: 'M12 2l9 5v10l-9 5-9-5V7l9-5Zm0 0v10m0 0l9-5m-9 5L3 7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a8 8 0 0 0-3-1.7L14 2h-4l-.4 2.5a8 8 0 0 0-3 1.7l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.1 1.2.2 1.8l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 3 1.7L10 22h4l.4-2.5a8 8 0 0 0 3-1.7l2.4 1 2-3.4-2-1.6c.1-.6.2-1.2.2-1.8Z',
}

export default function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
