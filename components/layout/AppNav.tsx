'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/dashboard', label: 'Inicio',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9 21 9 15 12 15C15 15 15 21 15 21M9 21H15"/>
      </svg>
    ),
  },
  {
    href: '/expenses', label: 'Gastos',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <path d="M2 8.5C2 7.4 2.9 6.5 4 6.5H20C21.1 6.5 22 7.4 22 8.5V17.5C22 18.6 21.1 19.5 20 19.5H4C2.9 19.5 2 18.6 2 17.5V8.5ZM4.5 4.5H19.5M7.5 4.5V6.5M16.5 4.5V6.5"/>
          : <><path d="M2 8.5H22M2 8.5V17.5C2 18.6 2.9 19.5 4 19.5H20C21.1 19.5 22 18.6 22 17.5V8.5M2 8.5C2 7.4 2.9 6.5 4 6.5H20C21.1 6.5 22 7.4 22 8.5"/><path d="M6 13H10M6 16H8"/></>
        }
      </svg>
    ),
  },
  {
    href: '/cards', label: 'Tarjetas',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <path d="M2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6ZM2 9H22"/>
          : <><rect x="2" y="4" width="20" height="16" rx="3"/><line x1="2" y1="9" x2="22" y2="9"/><path d="M6 14H8M11 14H13"/></>
        }
      </svg>
    ),
  },
  {
    href: '/accounts', label: 'Cuentas',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <path d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V8.5C22 9.6 21.1 10.5 20 10.5H4C2.9 10.5 2 9.6 2 8.5V7ZM3 10.5V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V10.5M7 14H9M12 14H14"/>
          : <><path d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V8.5"/><path d="M2 8.5C2 9.6 2.9 10.5 4 10.5H20C21.1 10.5 22 9.6 22 8.5"/><path d="M3 10.5V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V10.5"/><path d="M7 14H9"/></>
        }
      </svg>
    ),
  },
  {
    href: '/recurring', label: 'Recurrentes',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12C3 7.03 7.03 3 12 3C15.5 3 18.5 4.9 20.1 7.7M21 12C21 16.97 16.97 21 12 21C8.5 21 5.5 19.1 3.9 16.3"/>
        <path d="M21 3L20.1 7.7L15.5 6.5M3 21L3.9 16.3L8.5 17.5"/>
      </svg>
    ),
  },
  {
    href: '/settings', label: 'Config.',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        {active
          ? <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15ZM19.9 13.6C19.96 13.2 20 12.6 20 12C20 11.4 19.96 10.8 19.86 10.4L22.02 8.72C22.21 8.57 22.26 8.3 22.14 8.08L20.1 4.54C19.98 4.32 19.71 4.25 19.49 4.32L16.93 5.36C16.38 4.94 15.79 4.59 15.15 4.32L14.75 1.6C14.71 1.36 14.5 1.18 14.25 1.18H10.25C10 1.18 9.79 1.36 9.75 1.6L9.35 4.32C8.71 4.59 8.12 4.95 7.57 5.36L5.01 4.32C4.79 4.24 4.52 4.32 4.4 4.54L2.37 8.08C2.24 8.3 2.3 8.57 2.49 8.72L4.65 10.4C4.55 10.8 4.5 11.41 4.5 12C4.5 12.59 4.55 13.2 4.65 13.6L2.49 15.28C2.3 15.43 2.24 15.7 2.37 15.92L4.4 19.46C4.52 19.68 4.79 19.75 5.01 19.68L7.57 18.64C8.12 19.06 8.71 19.41 9.35 19.68L9.75 22.4C9.79 22.64 10 22.82 10.25 22.82H14.25C14.5 22.82 14.71 22.64 14.75 22.4L15.15 19.68C15.79 19.41 16.38 19.05 16.93 18.64L19.49 19.68C19.71 19.76 19.98 19.68 20.1 19.46L22.14 15.92C22.26 15.7 22.21 15.43 22.02 15.28L19.9 13.6Z"/>
          : <><circle cx="12" cy="12" r="3"/><path d="M19.4 15C19.1 15.5 19.3 16.1 19.7 16.5L19.8 16.6C20.2 17 20.2 17.6 19.8 17.9L18.6 19.1C18.2 19.5 17.6 19.5 17.2 19.1L17.1 19C16.7 18.6 16.1 18.4 15.6 18.7C15.1 18.9 14.8 19.4 14.8 19.9V20C14.8 20.6 14.3 21 13.7 21H12C11.4 21 10.9 20.5 10.9 19.9V19.8C10.8 19.3 10.5 18.9 10 18.7C9.5 18.5 8.9 18.6 8.5 19L8.4 19.1C8 19.5 7.4 19.5 7 19.1L5.8 17.9C5.4 17.5 5.4 16.9 5.8 16.6L5.9 16.5C6.3 16.1 6.5 15.5 6.2 15C6 14.5 5.5 14.2 5 14.2H4.9C4.3 14.2 3.9 13.7 3.9 13.1V11.4C3.9 10.8 4.4 10.3 5 10.3H5.1C5.6 10.3 6 10 6.2 9.5C6.4 9 6.3 8.4 5.9 8L5.8 7.9C5.4 7.5 5.4 6.9 5.8 6.6L7 5.4C7.4 5 8 5 8.4 5.4L8.5 5.5C8.9 5.9 9.5 6.1 10 5.8C10.5 5.6 10.8 5.1 10.8 4.6V4.5C10.8 3.9 11.3 3.5 11.9 3.5H13.6C14.2 3.5 14.7 4 14.7 4.6V4.7C14.7 5.2 15 5.6 15.5 5.8C16 6 16.6 5.9 17 5.5L17.1 5.4C17.5 5 18.1 5 18.4 5.4L19.6 6.6C20 7 20 7.6 19.6 7.9L19.5 8C19.1 8.4 18.9 9 19.2 9.5C19.4 10 19.9 10.3 20.4 10.3H20.5C21.1 10.3 21.6 10.8 21.6 11.4V13.1C21.6 13.7 21.1 14.2 20.5 14.2H20.4C19.9 14.2 19.5 14.5 19.4 15Z"/></>
        }
      </svg>
    ),
  },
]

export default function AppNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      background: 'rgba(18,21,31,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(37,44,66,0.8)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'stretch',
        padding: '6px 0 2px',
        maxWidth: 600, margin: '0 auto',
      }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '5px 8px 7px',
              borderRadius: 12,
              textDecoration: 'none',
              color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
              minWidth: 48,
              flex: 1,
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.15s',
            }}>
              {item.icon(active)}
              <span style={{ fontSize: 9, fontWeight: active ? 700 : 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
