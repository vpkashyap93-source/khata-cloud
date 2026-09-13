const paths = {
  dashboard: 'M3 3h7v7H3V3Zm11 0h7v4h-7V3ZM3 12h7v9H3v-9Zm11-4h7v13h-7V8Z',
  accounts: 'M4 4h16v3H4V4Zm0 6h16v3H4v-3Zm0 6h16v3H4v-3Z',
  journal: 'M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h8M8 12h8M8 16h5',
  estimates: 'M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm8 0v4h4M8 13l2.5 2.5L16 10',
  invoices: 'M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3Zm2 5h6M9 11h6M9 14h4',
  bills: 'M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 7Zm4 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
  ledger: 'M4 4h7v16H4V4Zm9 0h7v16h-7V4ZM4 10h7M13 10h7',
  reports: 'M5 20V10M11 20V4M17 20v-7',
  customers: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  vendors: 'M3 9l2-5h14l2 5M3 9v10h18V9M3 9h18M9 13v3M15 13v3',
  items: 'M12 2l9 5v10l-9 5-9-5V7l9-5Zm0 0v10m0 0l9-5m-9 5L3 7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a8 8 0 0 0-3-1.7L14 2h-4l-.4 2.5a8 8 0 0 0-3 1.7l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.1 1.2.2 1.8l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 3 1.7L10 22h4l.4-2.5a8 8 0 0 0 3-1.7l2.4 1 2-3.4-2-1.6c.1-.6.2-1.2.2-1.8Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm9 2-4.35-4.35',
  asset: 'M3 8a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm15 4.5h-3a1.5 1.5 0 0 0 0 3h3',
  liability: 'M12 3 2 8h20L12 3Zm-9 7v8m6-8v8m6-8v8m6-8v8M2 21h20',
  equity: 'M12 3v9l7.5 4.33A9 9 0 1 0 12 3Z',
  income: 'M3 17 9 11l4 4 8-8M15 7h6v6',
  expense: 'M3 7l6 6 4-4 8 8M21 11v6h-6',
  print: 'M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6v-7Z',
  payment: 'M3 10h18M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm2 8h4',
  note: 'M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 0v5h5M9 13h6M9 17h4',
  void: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM6 6l12 12',
  check: 'M5 12l5 5L20 7',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z',
  offline: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 5.5-1M5 13a9 9 0 0 1 3-2M19 13a9 9 0 0 0-2.5-2.1M2 9a13 13 0 0 1 4-2.6M22 9a13 13 0 0 0-6-3.5M12 20h.01',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  pause: 'M8 4h3v16H8zM13 4h3v16h-3z',
  play: 'M6 3l15 9-15 9V3z',
  mail: 'M4 6h16v12H4V6Zm0 0 8 7 8-7',
  chat: 'M21 11.5a8.5 8.5 0 0 1-12.7 7.4L4 20l1.1-4.2A8.5 8.5 0 1 1 21 11.5Z',
}

export default function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}
