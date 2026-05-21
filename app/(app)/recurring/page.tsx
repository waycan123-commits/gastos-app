'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RecurringExpense, Category, CreditCard, Account, PaymentMethod, Currency, RecurringFrequency } from '@/lib/supabase/types'
import { formatCurrency, getMonthlyRecurringTotal, getNextOccurrence, daysUntil } from '@/lib/utils/calculations'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const FREQUENCIES: { value: RecurringFrequency; label: string }[] = [
  { value: 'semanal',   label: 'Semanal' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'mensual',   label: 'Mensual' },
  { value: 'anual',     label: 'Anual' },
]
const PAYMENT_METHODS: PaymentMethod[] = ['efectivo','débito','crédito','transferencia','otro']
const CURRENCIES: Currency[] = ['PEN','USD','EUR','COP','MXN','ARS','CLP']

type RecForm = {
  name: string; category_id: string; amount: string; currency: Currency
  frequency: RecurringFrequency; charge_day: string
  payment_method: PaymentMethod; account_id: string; credit_card_id: string
  start_date: string; end_date: string; is_active: boolean; note: string
}
const emptyRec = (): RecForm => ({
  name: '', category_id: '', amount: '', currency: 'PEN',
  frequency: 'mensual', charge_day: '1',
  payment_method: 'débito', account_id: '', credit_card_id: '',
  start_date: new Date().toISOString().split('T')[0], end_date: '', is_active: true, note: '',
})

export default function RecurringPage() {
  const supabase = createClient()
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currency, setCurrency] = useState('PEN')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState<RecurringExpense | null>(null)
  const [saving, setSaving] = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)
  const [form, setForm] = useState<RecForm>(emptyRec())

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [recRes, catRes, cardsRes, accsRes, profRes] = await Promise.all([
      supabase.from('recurring_expenses').select('*, category:categories(*), account:accounts(*), credit_card:credit_cards(*)')
        .eq('user_id', user.id).order('name'),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('credit_cards').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('profiles').select('currency').eq('user_id', user.id).single(),
    ])
    setRecurring(recRes.data || [])
    setCategories(catRes.data || [])
    setCards(cardsRes.data || [])
    setAccounts(accsRes.data || [])
    setCurrency(profRes.data?.currency || 'PEN')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() { setEditRec(null); setForm({ ...emptyRec(), currency: currency as Currency, category_id: categories[0]?.id || '' }); setShowForm(true) }
  function openEdit(r: RecurringExpense) {
    setEditRec(r)
    setForm({
      name: r.name, category_id: r.category_id || '', amount: String(r.amount), currency: r.currency,
      frequency: r.frequency, charge_day: String(r.charge_day),
      payment_method: r.payment_method, account_id: r.account_id || '', credit_card_id: r.credit_card_id || '',
      start_date: r.start_date, end_date: r.end_date || '', is_active: r.is_active, note: r.note || '',
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditRec(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      name: form.name, category_id: form.category_id || null, amount: parseFloat(form.amount),
      currency: form.currency, frequency: form.frequency, charge_day: parseInt(form.charge_day),
      payment_method: form.payment_method, account_id: form.account_id || null, credit_card_id: form.credit_card_id || null,
      start_date: form.start_date, end_date: form.end_date || null,
      is_active: form.is_active, note: form.note || null, updated_at: new Date().toISOString(),
    }
    if (editRec) {
      await supabase.from('recurring_expenses').update(payload).eq('id', editRec.id)
    } else {
      await supabase.from('recurring_expenses').insert({ ...payload, user_id: user.id })
    }
    setSaving(false); closeForm(); load()
  }

  async function handleToggle(r: RecurringExpense) {
    await supabase.from('recurring_expenses').update({ is_active: !r.is_active }).eq('id', r.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto recurrente?')) return
    await supabase.from('recurring_expenses').delete().eq('id', id)
    setRecurring(prev => prev.filter(r => r.id !== id))
  }

  async function handleRegisterMonth(r: RecurringExpense) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const thisMonth = format(new Date(), 'yyyy-MM')
    // Check for duplicate this month
    const { data: existing } = await supabase.from('expenses')
      .select('id').eq('user_id', user.id).eq('recurring_expense_id', r.id)
      .gte('date', `${thisMonth}-01`).lte('date', `${thisMonth}-31`)
    if (existing && existing.length > 0) {
      alert('Este gasto ya fue registrado este mes.')
      return
    }
    setRegistering(r.id)
    await supabase.from('expenses').insert({
      user_id: user.id, name: r.name, category_id: r.category_id,
      amount: r.amount, currency: r.currency,
      date: new Date().toISOString().split('T')[0],
      payment_method: r.payment_method, account_id: r.account_id,
      credit_card_id: r.credit_card_id, recurring_expense_id: r.id,
      note: `Recurrente: ${r.frequency}`,
    })
    setRegistering(null)
    alert(`✅ "${r.name}" registrado como gasto de este mes.`)
  }

  const activeRecs = recurring.filter(r => r.is_active)
  const monthlyTotal = getMonthlyRecurringTotal(activeRecs)

  if (loading) return <Shell><div className="empty-state"><p>Cargando...</p></div></Shell>

  return (
    <Shell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recurrentes</h1>
          <p className="page-subtitle">{activeRecs.length} activos</p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ padding: '9px 16px', fontSize: 14 }}>+ Nuevo</button>
      </div>

      {activeRecs.length > 0 && (
        <div className="card metric-card anim-fade-up d0" style={{ marginBottom: 16 }}>
          <p className="metric-label">Total mensual estimado</p>
          <p className="metric-value" style={{ color: 'var(--accent-amber)' }}>
            {formatCurrency(monthlyTotal, currency)}
          </p>
          <p className="metric-sub">Suma ponderada de todos los recurrentes activos</p>
        </div>
      )}

      {recurring.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🔄</div>
          <p className="empty-state-title">Sin gastos recurrentes</p>
          <p className="empty-state-desc">Registra Netflix, servicios, suscripciones y cuotas para anticipar tus gastos.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {recurring.map((r, idx) => {
            const nextDate = getNextOccurrence(r.charge_day)
            const days = daysUntil(nextDate)
            const soon = days <= 5
            return (
              <div key={r.id} className={`card anim-fade-up d${Math.min(idx + 1, 5)}`} style={{ overflow: 'hidden', opacity: r.is_active ? 1 : 0.5 }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${r.category?.color || '#6b7280'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {r.category?.icon || '🔄'}
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{r.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {r.category?.name || '—'} · {FREQUENCIES.find(f => f.value === r.frequency)?.label}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(r.amount, r.currency)}</p>
                      {!r.is_active && <span className="badge badge-red" style={{ marginTop: 4 }}>Inactivo</span>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Próximo cobro</p>
                      <p style={{ fontSize: 14, fontWeight: 600, color: soon ? 'var(--accent-amber)' : 'var(--text-primary)', marginTop: 3 }}>
                        {soon ? `⚠️ ` : ''}{days === 0 ? 'Hoy' : `en ${days} días`}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Día {r.charge_day} del mes</p>
                    </div>
                    <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '10px 12px' }}>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pago via</p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>{r.payment_method}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {r.credit_card ? `💳 ${r.credit_card.name}` : r.account ? `🏦 ${r.account.name}` : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', flexWrap: 'wrap' }}>
                  <button className="btn-ghost" onClick={() => openEdit(r)} style={{ flex: 1, minWidth: 72, fontSize: 12, padding: '7px 10px' }}>Editar</button>
                  <button className="btn-ghost" onClick={() => handleToggle(r)} style={{ flex: 1, minWidth: 72, fontSize: 12, padding: '7px 10px' }}>
                    {r.is_active ? 'Pausar' : 'Activar'}
                  </button>
                  {r.is_active && (
                    <button className="btn-primary" onClick={() => handleRegisterMonth(r)} disabled={registering === r.id} style={{ flex: 2, minWidth: 120, fontSize: 12, padding: '7px 10px' }}>
                      {registering === r.id ? '...' : '✓ Registrar mes'}
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => handleDelete(r.id)} style={{ color: 'var(--accent-rose)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
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
                {editRec ? 'Editar recurrente' : 'Nuevo recurrente'}
              </h2>
              <button className="btn-icon" onClick={closeForm} style={{ fontSize: 18 }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label className="form-label">Nombre</label>
                <input className="input-field" placeholder="Netflix, Seguro, Cuota..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Categoría</label>
                  <select className="input-field" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Frecuencia</label>
                  <select className="input-field" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as RecurringFrequency }))}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Monto</label>
                  <input className="input-field" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label className="form-label">Moneda</label>
                  <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Día de cobro</label>
                  <select className="input-field" value={form.charge_day} onChange={e => setForm(f => ({ ...f, charge_day: e.target.value }))}>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Método de pago</label>
                <select className="input-field" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as PaymentMethod }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>

              {cards.length > 0 && (
                <div>
                  <label className="form-label">Tarjeta asociada</label>
                  <select className="input-field" value={form.credit_card_id} onChange={e => setForm(f => ({ ...f, credit_card_id: e.target.value, account_id: e.target.value ? '' : f.account_id }))}>
                    <option value="">— Ninguna —</option>
                    {cards.map(c => <option key={c.id} value={c.id}>💳 {c.name}</option>)}
                  </select>
                </div>
              )}
              {accounts.length > 0 && (
                <div>
                  <label className="form-label">Cuenta asociada</label>
                  <select className="input-field" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value, credit_card_id: e.target.value ? '' : f.credit_card_id }))}>
                    <option value="">— Ninguna —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>🏦 {a.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Fecha de inicio</label>
                <input className="input-field" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
              </div>

              <div>
                <label className="form-label">Fecha de fin (opcional)</label>
                <input className="input-field" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>

              <div>
                <label className="form-label">Nota (opcional)</label>
                <input className="input-field" placeholder="Detalles..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Guardando...' : editRec ? 'Guardar cambios' : 'Crear recurrente'}
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

export const dynamic = 'force-dynamic'
