'use client'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CashFlowPoint } from '@/lib/supabase/types'
import { formatCurrency } from '@/lib/utils/calculations'

export default function CashFlowChart({ points, currency }: { points: CashFlowPoint[]; currency: string }) {
  if (points.length === 0) {
    return <div className="empty-state" style={{ padding: 24 }}><p className="empty-state-desc">Sin datos suficientes para graficar este mes.</p></div>
  }

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.34} />
              <stop offset="52%" stopColor="#5aa9ff" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#5aa9ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(151,181,225,0.08)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={14}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={(value) => compactMoney(Number(value))}
          />
          <Tooltip
            cursor={{ stroke: 'rgba(103,232,249,0.45)', strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const point = payload[0].payload as CashFlowPoint
              return (
                <div style={{
                  background: 'rgba(8,12,23,0.96)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 14,
                  padding: '10px 12px',
                  boxShadow: 'var(--shadow-elevated)',
                  minWidth: 170,
                }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Día {label}</p>
                  <p style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{formatCurrency(point.balance, currency)}</p>
                  <div style={{ display: 'grid', gap: 3, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Ingresos: <strong style={{ color: 'var(--accent-green)' }}>{formatCurrency(point.income, currency)}</strong></span>
                    <span>Gastos: <strong style={{ color: 'var(--accent-rose)' }}>{formatCurrency(point.expenses, currency)}</strong></span>
                    <span>Recurrentes: <strong style={{ color: 'var(--accent-amber)' }}>{formatCurrency(point.recurring, currency)}</strong></span>
                    <span>Tarjetas: <strong style={{ color: 'var(--accent-blue)' }}>{formatCurrency(point.cards, currency)}</strong></span>
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#67e8f9"
            strokeWidth={2.4}
            fill="url(#cashFlowGradient)"
            activeDot={{ r: 5, stroke: '#06111d', strokeWidth: 2, fill: '#67e8f9' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function compactMoney(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`
  return String(Math.round(value))
}
