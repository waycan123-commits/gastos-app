'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/calculations'
import { Expense, Category, Profile, PaymentMethod, CreditCard, Account } from '@/lib/supabase/types'

const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'débito', 'crédito', 'transferencia', 'otro']
const CURRENCIES = ['PEN', 'USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP']

type ExpenseForm = {
  name: string
  category_id: string
  amount: string
  currency: string
  date: string
  payment_method: PaymentMethod
  note: string
  account_id: string
  credit_card_id: string
}

const emptyForm = (currency = 'PEN', catId = ''): ExpenseForm => ({
  name: '', category_id: catId, amount: '', currency,
  date: new Date().toISOString().split('T')[0],
  payment_method: 'efectivo', note: '', account_id: '', credit_card_id: '',
})

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<ExpenseForm>(emptyForm())

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [expRes, catRes, profRes, cardsRes, accsRes] = await Promise.all([
      supabase.from('expenses').select('*, category:categories(*), account:accounts(*), credit_card:credit_cards(*)')
        .eq('user_id', user.id).order('date', { ascending: false }).limit(150),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('credit_cards').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
    ])
    if (expRes.error) { console.error('Error loading expenses', expRes.error); setError('No se pudieron cargar los gastos.') }
    if (catRes.error) console.error('Error loading categories', catRes.error)
    if (cardsRes.error) console.error('Error loading cards', cardsRes.error)
    if (accsRes.error) console.error('Error loading accounts', accsRes.error)
    setExpenses(expRes.data || [])
    setCategories(catRes.data || [])
    setProfile(profRes.data)
    setCards(cardsRes.data || [])
    setAccounts(accsRes.data || [])
    const defaultCur = profRes.data?.currency || 'PEN'
    const defaultCat = catRes.data?.[0]?.id || ''
    setForm(emptyForm(defaultCur, defaultCat))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditExpense(null)
    setForm(emptyForm(profile?.currency || 'PEN', categories[0]?.id || ''))
    setShowForm(true)
  }

  function openEdit(exp: Expense) {
    setEditExpense(exp)
    setForm({
      name: exp.name,
      category_id: exp.category_id,
      amount: String(exp.amount),
      currency: exp.currency,
      date: exp.date,
      payment_method: exp.payment_method,
      note: exp.note || '',
      account_id: exp.account_id || '',
      credit_card_id: exp.credit_card_id || '',
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditExpense(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      amount: parseFloat(form.amount),
      currency: form.currency,
      date: form.date,
      payment_method: form.payment_method,
      note: form.note || null,
      account_id: form.account_id || null,
      credit_card_id: form.credit_card_id || null,
      payment_source_type: form.credit_card_id ? 'credit_card' : form.account_id ? 'account' : 'none',
    }

    if (editExpense) {
      const { error: saveError } = await supabase.from('expenses').update(payload).eq('id', editExpense.id)
      if (saveError) { console.error('Error updating expense', saveError); setError('No se pudo guardar el gasto.'); setSaving(false); return }
    } else {
      const { error: saveError } = await supabase.from('expenses').insert({ ...payload, user_id: user.id })
      if (saveError) { console.error('Error creating expense', saveError); setError('No se pudo registrar el gasto.'); setSaving(false); return }
    }

    setMessage(editExpense ? 'Gasto actualizado.' : 'Gasto registrado.')
    setTimeout(() => setMessage(''), 2600)
    setSaving(false)
    closeForm()
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error: deleteError } = await supabase.from('expenses').delete().eq('id', id)
    if (deleteError) { console.error('Error deleting expense', deleteError); setError('No se pudo eliminar el gasto.'); return }
    setExpenses(prev => prev.filter(x => x.id !== id))
  }

  const filtered = filter
    ? expenses.filter(e =>
        e.name.toLowerCase().includes(filter.toLowerCase()) ||
        e.category?.name?.toLowerCase().includes(filter.toLowerCase())
      )
    : expenses

  if (loading) return <Shell><div className="empty-state"><p>Cargando...</p></div></Shell>

  return (
    <Shell>
      <div className="page-header anim-fade-up d0">
        <div>
          <h1 className="page-title">Gastos</h1>
          <p className="page-subtitle">{expenses.length} registros</p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ padding: '9px 16px', fontSize: 14 }}>
          + Nuevo
        </button>
      </div>
      {message && <div className="toast-success anim-fade-up d0">{message}</div>}
      {error && <div className="toast-error anim-fade-up d0">{error}</div>}

      {/* Search */}
      <div className="anim-fade-up d1" style={{ marginBottom: 16 }}>
        <input className="input-field" placeholder="Buscar gastos..." value={filter} onChange={e => setFilter(e.target.value)} style={{ fontSize: 15 }} />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card card-glass empty-state anim-fade-up d2">
          <div className="empty-state-icon">💸</div>
          <p className="empty-state-title">Sin gastos registrados</p>
          <p className="empty-state-desc">Toca "+ Nuevo" para agregar tu primer gasto.</p>
        </div>
      ) : (
        <div className="card card-glass anim-fade-up d2" style={{ overflow: 'hidden' }}>
          {filtered.map((exp, i) => (
            <div key={exp.id} className="list-row" style={{ gap: 12, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(145deg, ${exp.category?.color || '#6b7280'}24, rgba(255,255,255,0.035))`, border: `1px solid ${exp.category?.color || '#6b7280'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {exp.category?.icon || '📦'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {exp.category?.name || '—'} · {exp.date}
                    {exp.credit_card && <span> · 💳 {exp.credit_card.name}</span>}
                    {exp.account && <span> · 🏦 {exp.account.name}</span>}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                  -{formatCurrency(exp.amount, exp.currency)}
                </span>
                <button className="btn-icon" onClick={() => openEdit(exp)} title="Editar" style={{ color: 'var(--accent-blue)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button className="btn-icon" onClick={() => handleDelete(exp.id)} title="Eliminar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="modal-sheet anim-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editExpense ? 'Editar gasto' : 'Nuevo gasto'}
              </h2>
              <button className="btn-icon" onClick={closeForm} style={{ fontSize: 18 }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} className="mobile-form">
              <div>
                <label className="form-label">Nombre / Descripción</label>
                <input className="input-field" placeholder="Ej. Almuerzo en el trabajo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
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
                  <label className="form-label">Método de pago</label>
                  <select className="input-field" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as PaymentMethod }))}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Monto</label>
                  <input className="input-field" type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label className="form-label">Moneda</label>
                  <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Fecha</label>
                <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>

              {cards.length > 0 && (
                <div>
                  <label className="form-label">Tarjeta de crédito (opcional)</label>
                  <select className="input-field" value={form.credit_card_id} onChange={e => setForm(f => ({ ...f, credit_card_id: e.target.value, account_id: e.target.value ? '' : f.account_id }))}>
                    <option value="">— Ninguna —</option>
                    {cards.map(c => <option key={c.id} value={c.id}>💳 {c.name} ({c.bank})</option>)}
                  </select>
                </div>
              )}

              {accounts.length > 0 && (
                <div>
                  <label className="form-label">Cuenta / Débito (opcional)</label>
                  <select className="input-field" value={form.account_id} onChange={e => setForm(f => ({ ...f, account_id: e.target.value, credit_card_id: e.target.value ? '' : f.credit_card_id }))}>
                    <option value="">— Ninguna —</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>🏦 {a.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="form-label">Nota (opcional)</label>
                <input className="input-field" placeholder="Detalles adicionales..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={closeForm} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Guardando...' : editExpense ? 'Guardar cambios' : 'Registrar gasto'}
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
