'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: '📊' },
  { href: '/expenses', label: 'Gastos', icon: '💸' },
  { href: '/categories', label: 'Categ.', icon: '🏷️' },
  { href: '/import', label: 'Importar', icon: '📋' },
  { href: '/settings', label: 'Config.', icon: '⚙️' },
]

export default function AppNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(17, 21, 32, 0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0',
      }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 12px',
              borderRadius: 10,
              textDecoration: 'none',
              transition: 'all 0.2s',
              background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
              minWidth: 56,
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.02em',
                color: active ? 'var(--accent-blue)' : 'var(--text-muted)',
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
