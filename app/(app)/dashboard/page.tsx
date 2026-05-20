import { createClient } from '@/lib/supabase/server'
import { calculateMetrics, formatCurrency, getAlertBg, getAlertColor, getAlertProgressColor, getRecommendations } from '@/lib/utils/calculations'
import { Expense, Profile } from '@/lib/supabase/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, expensesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user!.id).single(),
    supabase.from('expenses').select('*, category:categories(*)').eq('user_id', user!.id).order('date', { ascending: false }),
  ])

  const profile: Profile | null = profileRes.data
  const expenses: Expense[] = expensesRes.data || []

  if (!profile) {
    return (
      <div style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>
        <div className="card animate-fade-up" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Configura tu perfil</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            Para empezar, ingresa tu ingreso mensual y preferencias financieras.
          </p>
          <Link href="/settings" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Ir a configuración
          </Link>
        </div>
      </div>
    )
  }

  const metrics = calculateMetrics(expenses, profile.monthly_income, profile.financial_day_start)
  const recommendations = getRecommendations(metrics, profile.monthly_income, profile.currency)
  const recentExpenses = expenses.slice(0, 5)

  const today = new Date()
  const monthLabel = format(today, 'MMMM yyyy', { locale: es })

  // Category totals for current month
  const categoryTotals: Record<string, { total: number; color: string; icon: string }> = {}
  expenses.slice(0, 50).forEach(e => {
    const name = e.category?.name || 'Otros'
    const color = e.category?.color || '#6b7280'
    const icon = e.category?.icon || '📦'
    if (!categoryTotals[name]) categoryTotals[name] = { total: 0, color, icon }
    categoryTotals[name].total += e.amount
  })
  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total).slice(0, 6)

  const alertBg = getAlertBg(metrics.alertLevel)
  const alertText = getAlertColor(metrics.alertLevel)
  const progressColor = getAlertProgressColor(metrics.alertLevel)
  const progressWidth = Math.min(metrics.percentageSpent, 100)

  const alertEmoji = { green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴', critical: '💀' }[metrics.alertLevel]

  return (
    <div style={{ padding: '20px 16px 0', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div className="animate-fade-up" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {monthLabel}
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginTop: 2 }}>
          Dashboard
        </h1>
      </div>

      {/* Alert bar */}
      <div className={`animate-fade-up delay-1`} style={{ marginBottom: 16, borderRadius: 12, padding: '12px 16px', border: '1px solid', ...parseBgBorder(alertBg) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{alertEmoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: resolveAlertTextColor(metrics.alertLevel) }}>
            {getAlertMessage(metrics)}
          </span>
        </div>
      </div>

      {/* Main metric cards */}
      <div className="animate-fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <MetricCard
          label="Gastado"
          value={formatCurrency(metrics.totalSpent, profile.currency)}
          sub={`${metrics.percentageSpent.toFixed(0)}% del ingreso`}
          color="var(--accent-rose)"
        />
        <MetricCard
          label="Disponible"
          value={formatCurrency(metrics.remaining, profile.currency)}
          sub={`de ${formatCurrency(profile.monthly_income, profile.currency)}`}
          color={metrics.remaining >= 0 ? 'var(--accent-emerald)' : 'var(--accent-rose)'}
        />
      </div>

      {/* Progress bar */}
      <div className="animate-fade-up delay-2 card" style={{ padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progreso del mes</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: resolveAlertTextColor(metrics.alertLevel) }}>
            {metrics.percentageSpent.toFixed(1)}%
          </span>
        </div>
        <div className="progress-bar">
          <div className={`progress-fill ${progressColor}`} style={{ width: `${progressWidth}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Día {metrics.currentDay}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Día {metrics.totalDays}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="animate-fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        <SmallStat label="Diario prom." value={formatCurrency(metrics.dailyAverage, profile.currency)} />
        <SmallStat label="Rec. por día" value={formatCurrency(Math.max(0, metrics.recommendedDaily), profile.currency)} />
        <SmallStat label="Proyección" value={formatCurrency(metrics.monthlyProjection, profile.currency)} accent={metrics.monthlyProjection > profile.monthly_income} />
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="animate-fade-up delay-3 card" style={{ padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Recomendaciones
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 1 }}>→</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {sortedCategories.length > 0 && (
        <div className="animate-fade-up delay-3 card" style={{ padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Por categoría
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedCategories.map(([name, data]) => {
              const pct = metrics.totalSpent > 0 ? (data.total / metrics.totalSpent) * 100 : 0
              return (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{data.icon} {name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(data.total, profile.currency)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: data.color, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent expenses */}
      <div className="animate-fade-up delay-4 card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Gastos recientes
          </p>
          <Link href="/expenses" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
            Ver todos →
          </Link>
        </div>
        {recentExpenses.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No hay gastos registrados aún.{' '}
            <Link href="/expenses" style={{ color: 'var(--accent-blue)' }}>Agregar primero</Link>
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentExpenses.map(exp => (
              <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{exp.category?.icon || '📦'}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{exp.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{exp.category?.name} · {exp.date}</p>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  -{formatCurrency(exp.amount, exp.currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card" style={{ padding: '16px 14px' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</p>
    </div>
  )
}

function SmallStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: '12px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color: accent ? 'var(--accent-rose)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</p>
    </div>
  )
}

function getAlertMessage(metrics: ReturnType<typeof calculateMetrics>): string {
  switch (metrics.alertLevel) {
    case 'green': return `Vas bien, has gastado el ${metrics.percentageSpent.toFixed(0)}% de tu ingreso.`
    case 'yellow': return `Atención: ya usaste el ${metrics.percentageSpent.toFixed(0)}% de tu ingreso.`
    case 'orange': return `Cuidado: ${metrics.percentageSpent.toFixed(0)}% gastado. Modera los gastos.`
    case 'red': return `Alerta: has gastado el ${metrics.percentageSpent.toFixed(0)}% de tu ingreso.`
    case 'critical': return `¡Superaste tu ingreso mensual! Revisa tus finanzas.`
    default: return ''
  }
}

function parseBgBorder(cls: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    'bg-emerald-500/20 border-emerald-500/30': { background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' },
    'bg-yellow-500/20 border-yellow-500/30': { background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' },
    'bg-orange-500/20 border-orange-500/30': { background: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.25)' },
    'bg-red-500/20 border-red-500/30': { background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' },
    'bg-red-700/30 border-red-600/50': { background: 'rgba(185,28,28,0.2)', borderColor: 'rgba(220,38,38,0.4)' },
  }
  return map[cls] || { background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }
}

function resolveAlertTextColor(level: string): string {
  const map: Record<string, string> = {
    green: '#10b981', yellow: '#f59e0b', orange: '#f97316', red: '#ef4444', critical: '#dc2626'
  }
  return map[level] || '#10b981'
}

export const dynamic = 'force-dynamic'
