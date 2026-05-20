'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/calculations'
import { Expense, Category, Profile, PaymentMethod } from '@/lib/supabase/types'

const PAYMENT_METHODS: PaymentMethod[] = ['efectivo', 'débito', 'crédito', 'transferencia', 'otro']

export default function ExpensesPage() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const [form, setForm] = useState({
    name: '',
    category_id: '',
    amount: '',
    currency: 'PEN',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'efectivo' as PaymentMethod,
    note: '',
  })

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [expRes, catRes, profRes] = await Promise.all([
      supabase.from('expenses').select('*, category:categories(*)').eq('user_id', user.id).order('date', { ascending: false }).limit(100),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    ])
    setExpenses(expRes.data || [])
    setCategories(catRes.data || [])
    setProfile(profRes.data)
    if (catRes.data?.length) setForm(f => ({ ...f, category_id: catRes.data[0].id, currency: profRes.data?.currency || 'PEN' }))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('expenses').insert({
      user_id: user.id,
      name: form.name,
      category_id: form.category_id,
      amount: parseFloat(form.amount),
      currency: form.currency,
      date: form.date,
      payment_method: form.payment_method,
      note: form.note || null,
    })
    setForm({ name: '', category_id: categories[0]?.id || '', amount: '', currency: profile?.currency || 'PEN', date: new Date().toISOString().split('T')[0], payment_method: 'efectivo', note: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(e => e.filter(x => x.id !== id))
  }

  const filtered = filter
    ? expenses.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()) || e.category?.name?.toLowerCase().includes(filter.toLowerCase()))
    : expenses

  if (loading) return <PageShell><LoadingState /></PageShell>

  return (
    <PageShell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Gastos</h1>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', fontSize: 13 }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo gasto'}
        </button>
      </div>

      {/* Add expense form */}
      {showForm && (
        <div className="card animate-fade-up" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Registrar gasto</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Nombre / Descripción</Label>
                <input className="input-field" placeholder="Ej. Almuerzo en el trabajo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <Label>Categoría</Label>
                <select className="input-field" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} required>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Monto</Label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div>
                <Label>Moneda</Label>
                <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {['PEN','USD','EUR','COP','MXN','ARS','CLP'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Fecha</Label>
                <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div>
                <Label>Método de pago</Label>
                <select className="input-field" value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value as PaymentMethod }))}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <input className="input-field" placeholder="Detalles adicionales..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 4 }}>
              {saving ? 'Guardando...' : 'Guardar gasto'}
            </button>
          </form>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input className="input-field" placeholder="🔍 Buscar gastos..." value={filter} onChange={e => setFilter(e.target.value)} />
      </div>

      {/* Expenses list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No hay gastos registrados.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {filtered.map((exp, i) => (
            <div key={exp.id} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20, width: 32, textAlign: 'center' }}>{exp.category?.icon || '📦'}</span>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{exp.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {exp.category?.name} · {exp.date} · {exp.payment_method}
                    {exp.note && ` · ${exp.note}`}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  -{formatCurrency(exp.amount, exp.currency)}
                </span>
                <button onClick={() => handleDelete(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '4px', borderRadius: 6, lineHeight: 1 }}
                  title="Eliminar">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '20px 16px 0', maxWidth: 600, margin: '0 auto' }}>{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{children}</label>
}

function LoadingState() {
  return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
}
