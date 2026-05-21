'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CreditCard, Currency, Expense } from '@/lib/supabase/types'
import { formatCurrency, daysUntil, getNextOccurrence, getMonthExpenses } from '@/lib/utils/calculations'

const CURRENCIES: Currency[] = ['PEN', 'USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP']
const CARD_COLORS = ['#3b82f6','#8b5cf6','#f43f5e','#f59e0b','#14b8a6','#22c55e','#f97316','#ec4899']

type CardForm = {
  name: string; bank: string; currency: Currency; credit_limit: string
  current_balance: string; billing_close_day: string; payment_due_day: string
  color: string; note: string; is_active: boolean
}
const emptyCard = (): CardForm => ({
  name: '', bank: '', currency: 'PEN', credit_limit: '', current_balance: '0',
  billing_close_day: '25', payment_due_day: '10', color: CARD_COLORS[0], note: '', is_active: true,
})

export default function CardsPage() {
  const supabase = createClient()
  const [cards, setCards] = useState<CreditCard[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editCard, setEditCard] = useState<CreditCard | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CardForm>(emptyCard())

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [cardsRes, expRes] = await Promise.all([
      supabase.from('credit_cards').select('*').eq('user_id', user.id).order('name'),
      supabase.from('expenses').select('*, category:categories(*)')
        .eq('user_id', user.id).not('credit_card_id', 'is', null),
    ])
    setCards(cardsRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() { setEditCard(null); setForm(emptyCard()); setShowForm(true) }
  function openEdit(c: CreditCard) {
    setEditCard(c)
    setForm({
      name: c.name, bank: c.bank, currency: c.currency,
      credit_limit: c.credit_limit != null ? String(c.credit_limit) : '',
      current_balance: String(c.current_balance),
      billing_close_day: String(c.billing_close_day),
      payment_due_day: String(c.payment_due_day),
      color: c.color, note: c.note || '', is_active: c.is_active,
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditCard(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      name: form.name, bank: form.bank, currency: form.currency,
      credit_limit: form.credit_limit ? parseFloat(form.credit_limit) : null,
      current_balance: parseFloat(form.current_balance) || 0,
      billing_close_day: parseInt(form.billing_close_day),
      payment_due_day: parseInt(form.payment_due_day),
      color: form.color, note: form.note || null, is_active: form.is_active,
      updated_at: new Date().toISOString(),
    }
    if (editCard) {
      await supabase.from('credit_cards').update(payload).eq('id', editCard.id)
    } else {
      await supabase.from('credit_cards').insert({ ...payload, user_id: user.id })
    }
    setSaving(false); closeForm(); load()
  }

  async function handleToggle(card: CreditCard) {
    await supabase.from('credit_cards').update({ is_active: !card.is_active }).eq('id', card.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tarjeta? Los gastos asociados no se eliminarán.')) return
    await supabase.from('credit_cards').delete().eq('id', id)
    setCards(prev => prev.filter(c => c.id !== id))
  }

  function getCardMonthSpent(cardId: string): number {
    const month = getMonthExpenses(expenses.filter(e => e.credit_card_id === cardId))
    return month.reduce((s, e) => s + e.amount, 0)
  }

  if (loading) return <Shell><div className="empty-state"><p>Cargando...</p></div></Shell>

  return (
    <Shell>
      <div className="page-header anim-fade-up d0">
        <div>
          <h1 className="page-title">Tarjetas</h1>
          <p className="page-subtitle">{cards.filter(c => c.is_active).length} activas</p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ padding: '9px 16px', fontSize: 14 }}>+ Nueva</button>
      </div>

      {cards.length === 0 ? (
        <div className="card card-glass empty-state anim-fade-up d1">
          <div className="empty-state-icon">💳</div>
          <p className="empty-state-title">Sin tarjetas registradas</p>
          <p className="empty-state-desc">Agrega tus tarjetas de crédito para controlar tu deuda y próximas fechas de pago.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cards.map((card, idx) => {
            const monthSpent = getCardMonthSpent(card.id)
            const usagePct = card.credit_limit ? Math.min((card.current_balance / card.credit_limit) * 100, 100) : 0
            const nextClose = getNextOccurrence(card.billing_close_day)
            const nextPay = getNextOccurrence(card.payment_due_day)
            const daysToClose = daysUntil(nextClose)
            const daysToPay = daysUntil(nextPay)
            const payUrgent = daysToPay <= 5

            return (
              <div key={card.id} className={`card card-glass anim-fade-up d${Math.min(idx + 1, 5)}`} style={{ overflow: 'hidden', opacity: card.is_active ? 1 : 0.55 }}>
                {/* Card header */}
                <div style={{ background: `radial-gradient(circle at 90% 0%, ${card.color}33, transparent 36%), linear-gradient(135deg, ${card.color}24, rgba(255,255,255,0.018))`, padding: '18px 18px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{card.name}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{card.bank} · {card.currency}</p>
                    </div>
                    <div style={{ width: 38, height: 38, borderRadius: 14, background: card.color + '33', border: `1px solid ${card.color}55`, boxShadow: `0 0 22px ${card.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💳</div>
                  </div>

                  {card.credit_limit && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Usado: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(card.current_balance, card.currency)}</strong>
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Límite: <strong style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(card.credit_limit, card.currency)}</strong>
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${usagePct}%`, background: usagePct > 80 ? 'var(--accent-rose)' : usagePct > 60 ? 'var(--accent-amber)' : card.color }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '14px 16px', gap: 8 }}>
                  <Stat label="Gasto mes" value={formatCurrency(monthSpent, card.currency)} mono />
                  <Stat
                    label="Cierre"
                    value={`${daysToClose}d`}
                    sub={`Día ${card.billing_close_day}`}
                    accent={daysToClose <= 3 ? 'amber' : undefined}
                  />
                  <Stat
                    label="Pago"
                    value={`${daysToPay}d`}
                    sub={`Día ${card.payment_due_day}`}
                    accent={payUrgent ? 'red' : undefined}
                  />
                </div>

                {payUrgent && (
                  <div style={{ margin: '0 16px 14px', padding: '10px 12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 10, fontSize: 12, color: 'var(--accent-rose)' }}>
                    ⚠️ Fecha de pago en {daysToPay} día{daysToPay !== 1 ? 's' : ''}. No olvides pagar.
                  </div>
                )}

                {card.note && (
                  <p style={{ padding: '0 16px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{card.note}</p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.025)' }}>
                  <button className="btn-ghost" onClick={() => openEdit(card)} style={{ flex: 1, fontSize: 13, padding: '8px' }}>Editar</button>
                  <button className="btn-ghost" onClick={() => handleToggle(card)} style={{ flex: 1, fontSize: 13, padding: '8px' }}>
                    {card.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn-icon" onClick={() => handleDelete(card.id)} style={{ color: 'var(--accent-rose)', width: 36 }} title="Eliminar">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="modal-sheet anim-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editCard ? 'Editar tarjeta' : 'Nueva tarjeta'}
              </h2>
              <button className="btn-icon" onClick={closeForm} style={{ fontSize: 18 }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Nombre tarjeta</label>
                  <input className="input-field" placeholder="Visa Banco X" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="form-label">Banco / Entidad</label>
                  <input className="input-field" placeholder="BCP, BBVA..." value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Moneda</label>
                  <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Línea de crédito</label>
                  <input className="input-field" type="number" step="0.01" placeholder="Opcional" value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="form-label">Monto usado actual</label>
                <input className="input-field" type="number" step="0.01" placeholder="0.00" value={form.current_balance} onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Día de cierre</label>
                  <select className="input-field" value={form.billing_close_day} onChange={e => setForm(f => ({ ...f, billing_close_day: e.target.value }))}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Día de pago</label>
                  <select className="input-field" value={form.payment_due_day} onChange={e => setForm(f => ({ ...f, payment_due_day: e.target.value }))}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Color de tarjeta</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {CARD_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                      width: 28, height: 28, borderRadius: 8, background: c, border: form.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', outline: 'none', transition: 'transform 0.1s',
                      transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label">Nota (opcional)</label>
                <input className="input-field" placeholder="Ej. Principal para compras en línea" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Guardando...' : editCard ? 'Guardar cambios' : 'Crear tarjeta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="page-shell">{children}</div>
}

function Stat({ label, value, sub, mono, accent }: { label: string; value: string; sub?: string; mono?: boolean; accent?: 'amber' | 'red' }) {
  const color = accent === 'red' ? 'var(--accent-rose)' : accent === 'amber' ? 'var(--accent-amber)' : 'var(--text-primary)'
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color, fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

export const dynamic = 'force-dynamic'
