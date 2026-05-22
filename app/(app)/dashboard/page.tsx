import { createClient } from '@/lib/supabase/server'
import { calculateMetrics, formatCurrency, getAlertStyle, getRecommendations, daysUntil, getNextOccurrence, getMonthlyRecurringTotal, buildCashFlow } from '@/lib/utils/calculations'
import { Expense, Profile, CreditCard, Account, RecurringExpense, IncomeSource, CashFlowEvent } from '@/lib/supabase/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import CashFlowChart from '@/components/dashboard/CashFlowChart'
import FinanceLogo from '@/components/brand/FinanceLogo'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, expensesRes, cardsRes, accountsRes, recurringRes, incomesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user!.id).single(),
    supabase.from('expenses').select('*, category:categories(*)')
      .eq('user_id', user!.id).order('date', { ascending: false }),
    supabase.from('credit_cards').select('*').eq('user_id', user!.id).eq('is_active', true).order('name'),
    supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true).order('name'),
    supabase.from('recurring_expenses').select('*, category:categories(*)')
      .eq('user_id', user!.id).eq('is_active', true),
    supabase.from('income_sources').select('*, destination_account:accounts(*)')
      .eq('user_id', user!.id).eq('is_active', true),
  ])

  const profile: Profile | null = profileRes.data
  const expenses: Expense[] = expensesRes.data || []
  const cards: CreditCard[] = cardsRes.data || []
  const accounts: Account[] = accountsRes.data || []
  const recurring: RecurringExpense[] = recurringRes.data || []
  const incomes: IncomeSource[] = (incomesRes.data || []) as IncomeSource[]

  if (!profile) {
    return (
      <div className="page-shell">
        <div className="card card-glass anim-fade-up d0" style={{ padding: '40px 28px', textAlign: 'center', marginTop: 24 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🎯</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Configura tu perfil</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Ingresa tu ingreso mensual para comenzar a controlar tus finanzas.
          </p>
          <Link href="/settings" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            Ir a configuración
          </Link>
        </div>
      </div>
    )
  }

  const metrics = calculateMetrics(expenses, profile.monthly_income, profile.financial_day_start, recurring, accounts)

  // Next card payment urgency
  const nextPayDays = cards.length > 0
    ? Math.min(...cards.map(c => daysUntil(getNextOccurrence(c.payment_due_day))))
    : undefined

  const recommendations = getRecommendations(metrics, profile.monthly_income, profile.currency, nextPayDays)
  const recentExpenses = expenses.slice(0, 6)
  const monthLabel = format(new Date(), "MMMM 'de' yyyy", { locale: es })

  // Category totals
  const categoryTotals: Record<string, { total: number; color: string; icon: string }> = {}
  expenses.slice(0, 100).forEach(e => {
    const name = e.category?.name || 'Otros'
    if (!categoryTotals[name]) categoryTotals[name] = { total: 0, color: e.category?.color || '#6b7280', icon: e.category?.icon || '📦' }
    categoryTotals[name].total += e.amount
  })
  const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1].total - a[1].total).slice(0, 5)

  const alertStyle = getAlertStyle(metrics.alertLevel)
  const progressWidth = Math.min(metrics.percentageSpent, 100)
  const alertEmoji = { green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴', critical: '🚨' }[metrics.alertLevel] || '🟢'

  const recurringTotal = getMonthlyRecurringTotal(recurring)
  const cashFlow = buildCashFlow(accounts, incomes, expenses, recurring, cards)
  const primarySummary = cashFlow.summaries.find(s => s.currency === profile.currency) || cashFlow.summaries[0]
  const primaryCurrency = primarySummary?.currency || profile.currency
  const primaryPoints = cashFlow.pointsByCurrency[primaryCurrency] || []
  const upcomingFlowEvents = cashFlow.events
    .filter(event => event.status !== 'done')
    .slice(0, 10)

  return (
    <div className="page-shell">
      {/* Header */}
      <div className="anim-fade-up d0" style={{ marginBottom: 20, paddingTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
        <FinanceLogo size={42} />
        <div>
          <p className="label-caps" style={{ marginBottom: 4 }}>{monthLabel}</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: 0, lineHeight: 1.12 }}>
            Pulso de caja
          </h1>
        </div>
      </div>

      {/* Cash flow pulse */}
      {primarySummary && (
        <div className="card card-glass anim-fade-up d1" style={{ padding: '18px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <p className="label-caps" style={{ marginBottom: 6 }}>Dinero disponible hoy</p>
              <p style={{ fontSize: 30, lineHeight: 1, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(primarySummary.saldoActual, primarySummary.currency)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Cierre estimado: <strong style={{ color: primarySummary.saldoEstimadoCierre >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(primarySummary.saldoEstimadoCierre, primarySummary.currency)}</strong>
              </p>
            </div>
            <div className={primarySummary.resultadoMes >= 0 ? 'badge badge-green' : 'badge badge-red'}>
              {primarySummary.resultadoMes >= 0 ? 'A favor' : 'Déficit'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <PulseItem label="Por cobrar" value={formatCurrency(primarySummary.ingresosPendientesMes, primarySummary.currency)} tone="green" />
            <PulseItem label="Recurrentes pendientes" value={formatCurrency(primarySummary.gastosRecurrentesPendientes, primarySummary.currency)} tone="amber" />
            <PulseItem label="Gastos registrados" value={formatCurrency(primarySummary.gastosRegistradosMes, primarySummary.currency)} tone="red" />
            <PulseItem label="Tarjetas por pagar" value={formatCurrency(primarySummary.pagosTarjetaPendientes, primarySummary.currency)} tone="blue" />
          </div>

          <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {primarySummary.resultadoMes >= 0
              ? `Este mes podrías cerrar con ${formatCurrency(primarySummary.resultadoMes, primarySummary.currency)} a favor.`
              : `Con este ritmo, este mes podrías quedar ${formatCurrency(Math.abs(primarySummary.resultadoMes), primarySummary.currency)} por debajo.`}
          </p>
        </div>
      )}

      {cashFlow.summaries.length > 1 && (
        <div className="anim-fade-up d1" style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {cashFlow.summaries.map(summary => (
            <div key={summary.currency} className="card-glass" style={{ borderRadius: 14, padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{summary.currency}</span>
              <strong style={{ color: summary.saldoEstimadoCierre >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(summary.saldoEstimadoCierre, summary.currency)}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="card card-glass anim-fade-up d2" style={{ padding: '16px 14px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 8px' }}>
          <p className="label-caps">Flujo acumulado · {primaryCurrency}</p>
          <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent-green)' }}>Ingresos</span>
            <span style={{ color: 'var(--accent-rose)' }}>Gastos</span>
            <span style={{ color: 'var(--accent-amber)' }}>Recurrentes</span>
            <span style={{ color: 'var(--accent-blue)' }}>Tarjetas</span>
          </div>
        </div>
        <CashFlowChart points={primaryPoints} currency={primaryCurrency} />
      </div>

      <div className="card card-glass anim-fade-up d2" style={{ padding: '16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="label-caps">Línea de tiempo del mes</p>
          <Link href="/income" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 700 }}>Ingresos →</Link>
        </div>
        {upcomingFlowEvents.length === 0 ? (
          <div className="empty-state" style={{ padding: '18px 10px' }}>
            <p className="empty-state-desc">Sin eventos pendientes este mes.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {upcomingFlowEvents.map(event => <TimelineEvent key={event.id} event={event} />)}
          </div>
        )}
      </div>

      {/* Alert pill */}
      <div className={`anim-fade-up d1 ${alertStyle.bg}`} style={{ borderRadius: 16, padding: '12px 15px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 9, boxShadow: 'var(--shadow-card)', backdropFilter: 'blur(16px)' }}>
        <span style={{ fontSize: 16 }}>{alertEmoji}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: alertStyle.text }}>
            {getAlertMessage(metrics)}
          </span>
      </div>

      {/* Main metrics 2x2 */}
      <div className="anim-fade-up d1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div className="metric-card card-glass">
          <p className="metric-label">Gastado</p>
          <p className="metric-value" style={{ color: 'var(--accent-rose)' }}>{formatCurrency(metrics.totalSpent, profile.currency)}</p>
          <p className="metric-sub">{metrics.percentageSpent.toFixed(0)}% del ingreso</p>
        </div>
        <div className="metric-card card-glass">
          <p className="metric-label">Disponible</p>
          <p className="metric-value" style={{ color: metrics.remaining >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
            {formatCurrency(metrics.remaining, profile.currency)}
          </p>
          <p className="metric-sub">de {formatCurrency(profile.monthly_income, profile.currency)}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="card card-glass anim-fade-up d2" style={{ padding: '16px 18px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progreso mensual</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: alertStyle.text }}>{metrics.percentageSpent.toFixed(1)}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressWidth}%`, background: alertStyle.bar }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Día {metrics.currentDay}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{metrics.daysRemaining} días restantes</span>
        </div>
      </div>

      {/* Stats 3-col */}
      <div className="anim-fade-up d2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <SmallMetric label="Prom. diario" value={formatCurrency(metrics.dailyAverage, profile.currency)} />
        <SmallMetric label="Rec. hoy" value={formatCurrency(Math.max(0, metrics.recommendedDaily), profile.currency)} />
        <SmallMetric label="Proyección" value={formatCurrency(metrics.monthlyProjection, profile.currency)} alert={metrics.monthlyProjection > profile.monthly_income} />
      </div>

      {/* Cards + Accounts + Recurring row */}
      {(cards.length > 0 || accounts.length > 0 || recurring.length > 0) && (
        <div className="anim-fade-up d2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
          {cards.length > 0 && (
            <div className="metric-card card-glass" style={{ padding: '13px 12px' }}>
              <p className="metric-label">Tarjetas</p>
              <p className="metric-value" style={{ fontSize: 15, color: 'var(--accent-violet)' }}>{formatCurrency(metrics.creditCardSpentMonth, profile.currency)}</p>
              <p className="metric-sub">gasto en {cards.length} tarjeta{cards.length !== 1 ? 's' : ''}</p>
            </div>
          )}
          {accounts.length > 0 && (
            <div className="metric-card card-glass" style={{ padding: '13px 12px' }}>
              <p className="metric-label">Saldo ctrs.</p>
              <p className="metric-value" style={{ fontSize: 15, color: 'var(--accent-green)' }}>{formatCurrency(metrics.accountsBalance, profile.currency)}</p>
              <p className="metric-sub">{accounts.length} cuenta{accounts.length !== 1 ? 's' : ''}</p>
            </div>
          )}
          {recurring.length > 0 && (
            <div className="metric-card card-glass" style={{ padding: '13px 12px' }}>
              <p className="metric-label">Recurrentes</p>
              <p className="metric-value" style={{ fontSize: 15, color: 'var(--accent-amber)' }}>{formatCurrency(recurringTotal, profile.currency)}</p>
              <p className="metric-sub">/mes estimado</p>
            </div>
          )}
        </div>
      )}

      {/* Ahorro estimado */}
      {metrics.savingsEstimated > 0 && (
        <div className="card-glass anim-fade-up d3" style={{ background: 'linear-gradient(145deg, rgba(45,223,136,0.11), rgba(45,223,136,0.035))', border: '1px solid rgba(45,223,136,0.22)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, boxShadow: 'var(--glow-green)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-green)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>💰 Ahorro estimado</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>Si mantienes este ritmo</p>
            </div>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(metrics.savingsEstimated, profile.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Next card payments */}
      {cards.length > 0 && (
        <div className="card anim-fade-up d3" style={{ padding: '14px 16px', marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="label-caps">Próximos pagos tarjeta</p>
            <Link href="/cards" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>Ver →</Link>
          </div>
          {cards.slice(0, 3).map(card => {
            const days = daysUntil(getNextOccurrence(card.payment_due_day))
            const urgent = days <= 5
            return (
              <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: card.color, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{card.name}</p>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: urgent ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                  {urgent ? '⚠️ ' : ''}{days === 0 ? 'Hoy' : `${days}d`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="card anim-fade-up d3" style={{ padding: '14px 16px', marginBottom: 10 }}>
          <p className="label-caps" style={{ marginBottom: 10 }}>Recomendaciones</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--accent-blue)', fontSize: 12, marginTop: 1, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {sortedCats.length > 0 && (
        <div className="card anim-fade-up d4" style={{ padding: '14px 16px', marginBottom: 10 }}>
          <p className="label-caps" style={{ marginBottom: 12 }}>Por categoría</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {sortedCats.map(([name, data]) => {
              const pct = metrics.totalSpent > 0 ? (data.total / metrics.totalSpent) * 100 : 0
              return (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{data.icon}</span> {name}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(data.total, profile.currency)}
                    </span>
                  </div>
                  <div className="progress-track">
                    <div style={{ height: '100%', borderRadius: 999, width: `${pct}%`, background: data.color, transition: 'width 0.7s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent expenses */}
      <div className="card card-glass anim-fade-up d4" style={{ overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p className="label-caps">Gastos recientes</p>
          <Link href="/expenses" style={{ fontSize: 12, color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>Ver todos →</Link>
        </div>
        {recentExpenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <p className="empty-state-desc">No hay gastos aún. <Link href="/expenses" style={{ color: 'var(--accent-blue)' }}>Agrega uno</Link></p>
          </div>
        ) : (
          recentExpenses.map((exp, i) => (
            <div key={exp.id} className="list-row" style={{ gap: 12, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${exp.category?.color || '#6b7280'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                  {exp.category?.icon || '📦'}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{exp.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{exp.category?.name || '—'} · {exp.date}</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                -{formatCurrency(exp.amount, exp.currency)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SmallMetric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="metric-card card-glass" style={{ padding: '12px 10px', textAlign: 'center' }}>
      <p className="metric-label">{label}</p>
      <p className="metric-value" style={{ fontSize: 13, color: alert ? 'var(--accent-rose)' : 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

function PulseItem({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'red' | 'blue' }) {
  const color = {
    green: 'var(--accent-green)',
    amber: 'var(--accent-amber)',
    red: 'var(--accent-rose)',
    blue: 'var(--accent-blue)',
  }[tone]
  return (
    <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '11px 12px' }}>
      <p style={{ fontSize: 10, color: 'var(--text-label)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</p>
      <p style={{ fontSize: 14, color, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{value}</p>
    </div>
  )
}

function TimelineEvent({ event }: { event: CashFlowEvent }) {
  const positive = event.amount > 0
  const neutral = event.amount === 0
  const color = neutral ? 'var(--accent-blue)' : positive ? 'var(--accent-green)' : 'var(--accent-rose)'
  const label = {
    income: 'Ingreso',
    expense: 'Gasto',
    recurring: 'Recurrente',
    card_payment: 'Pago tarjeta',
    card_close: 'Corte tarjeta',
  }[event.type]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 10, alignItems: 'center' }}>
      <div style={{ position: 'relative', minHeight: 42, display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: color, boxShadow: `0 0 18px ${color}` }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.label}</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Día {event.day} · {label}{event.source ? ` · ${event.source}` : ''}</p>
      </div>
      <span style={{ color, fontSize: 13, fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
        {neutral ? 'Fecha' : `${positive ? '+' : '-'}${formatCurrency(Math.abs(event.amount), event.currency)}`}
      </span>
    </div>
  )
}

function getAlertMessage(metrics: ReturnType<typeof calculateMetrics>): string {
  switch (metrics.alertLevel) {
    case 'green':    return `Bien encaminado. Gastaste el ${metrics.percentageSpent.toFixed(0)}% de tu ingreso.`
    case 'yellow':   return `Atención: ya usaste el ${metrics.percentageSpent.toFixed(0)}% de tu ingreso mensual.`
    case 'orange':   return `Cuidado: ${metrics.percentageSpent.toFixed(0)}% gastado. Modera tus gastos.`
    case 'red':      return `Alerta: ${metrics.percentageSpent.toFixed(0)}% gastado. Evita gastos no esenciales.`
    case 'critical': return `¡Superaste tu ingreso mensual! Revisa tus finanzas con urgencia.`
    default:         return ''
  }
}

export const dynamic = 'force-dynamic'
