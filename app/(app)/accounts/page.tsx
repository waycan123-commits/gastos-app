'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, AccountType, Currency, Expense } from '@/lib/supabase/types'
import { formatCurrency, getMonthExpenses } from '@/lib/utils/calculations'

const CURRENCIES: Currency[] = ['PEN', 'USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP']
const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'débito',           label: 'Tarjeta débito',    icon: '🏦' },
  { value: 'efectivo',         label: 'Efectivo',          icon: '💵' },
  { value: 'ahorro',           label: 'Cuenta ahorro',     icon: '🐷' },
  { value: 'billetera_digital',label: 'Billetera digital', icon: '📱' },
  { value: 'otra',             label: 'Otra',              icon: '💼' },
]

type AccForm = {
  name: string; type: AccountType; bank: string
  currency: Currency; current_balance: string; note: string; is_active: boolean
}
const emptyAcc = (): AccForm => ({
  name: '', type: 'débito', bank: '', currency: 'PEN', current_balance: '0', note: '', is_active: true,
})

export default function AccountsPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editAcc, setEditAcc] = useState<Account | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<AccForm>(emptyAcc())

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [accsRes, expRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user.id).order('name'),
      supabase.from('expenses').select('*, category:categories(*)')
        .eq('user_id', user.id).not('account_id', 'is', null),
    ])
    setAccounts(accsRes.data || [])
    setExpenses(expRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() { setEditAcc(null); setForm(emptyAcc()); setShowForm(true) }
  function openEdit(a: Account) {
    setEditAcc(a)
    setForm({ name: a.name, type: a.type, bank: a.bank || '', currency: a.currency, current_balance: String(a.current_balance), note: a.note || '', is_active: a.is_active })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditAcc(null) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      name: form.name, type: form.type, bank: form.bank || null,
      currency: form.currency, current_balance: parseFloat(form.current_balance) || 0,
      note: form.note || null, is_active: form.is_active, updated_at: new Date().toISOString(),
    }
    if (editAcc) {
      await supabase.from('accounts').update(payload).eq('id', editAcc.id)
    } else {
      await supabase.from('accounts').insert({ ...payload, user_id: user.id })
    }
    setSaving(false); closeForm(); load()
  }

  async function handleToggle(acc: Account) {
    await supabase.from('accounts').update({ is_active: !acc.is_active }).eq('id', acc.id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta cuenta? Los gastos asociados no se eliminarán.')) return
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  function getAccMonthSpent(accId: string): number {
    return getMonthExpenses(expenses.filter(e => e.account_id === accId)).reduce((s, e) => s + e.amount, 0)
  }

  const totalBalance = accounts.filter(a => a.is_active).reduce((s, a) => s + a.current_balance, 0)

  if (loading) return <Shell><div className="empty-state"><p>Cargando...</p></div></Shell>

  return (
    <Shell>
      <div className="page-header anim-fade-up d0">
        <div>
          <h1 className="page-title">Cuentas</h1>
          <p className="page-subtitle">{accounts.filter(a => a.is_active).length} activas</p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ padding: '9px 16px', fontSize: 14 }}>+ Nueva</button>
      </div>

      {accounts.length > 0 && (
        <div className="card card-glass metric-card anim-fade-up d1" style={{ marginBottom: 16 }}>
          <p className="metric-label">Saldo total disponible</p>
          <p className="metric-value" style={{ color: 'var(--accent-green)' }}>
            {formatCurrency(totalBalance, 'PEN')}
          </p>
          <p className="metric-sub">Suma de todas las cuentas activas</p>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card card-glass empty-state anim-fade-up d1">
          <div className="empty-state-icon">🏦</div>
          <p className="empty-state-title">Sin cuentas registradas</p>
          <p className="empty-state-desc">Agrega tus cuentas bancarias, billeteras o efectivo para tener un control completo.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.map((acc, idx) => {
            const typeInfo = ACCOUNT_TYPES.find(t => t.value === acc.type)
            const monthSpent = getAccMonthSpent(acc.id)
            return (
              <div key={acc.id} className={`card card-glass anim-fade-up d${Math.min(idx + 1, 5)}`} style={{ overflow: 'hidden', opacity: acc.is_active ? 1 : 0.55 }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(145deg, rgba(90,169,255,0.20), rgba(103,232,249,0.08))', border: '1px solid rgba(151,181,225,0.16)', boxShadow: 'var(--glow-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        {typeInfo?.icon || '💼'}
                      </div>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{acc.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                          {typeInfo?.label}{acc.bank ? ` · ${acc.bank}` : ''} · {acc.currency}
                        </p>
                      </div>
                    </div>
                    {!acc.is_active && <span className="badge badge-red">Inactiva</span>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Saldo</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: acc.current_balance >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(acc.current_balance, acc.currency)}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Gasto este mes</p>
                      <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-rose)', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(monthSpent, acc.currency)}
                      </p>
                    </div>
                  </div>

                  {acc.note && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>{acc.note}</p>}
                </div>

                <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.025)' }}>
                  <button className="btn-ghost" onClick={() => openEdit(acc)} style={{ flex: 1, fontSize: 13, padding: '8px' }}>Editar</button>
                  <button className="btn-ghost" onClick={() => handleToggle(acc)} style={{ flex: 1, fontSize: 13, padding: '8px' }}>
                    {acc.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button className="btn-icon" onClick={() => handleDelete(acc.id)} style={{ color: 'var(--accent-rose)' }} title="Eliminar">
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
                {editAcc ? 'Editar cuenta' : 'Nueva cuenta'}
              </h2>
              <button className="btn-icon" onClick={closeForm} style={{ fontSize: 18 }}>✕</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
              <div>
                <label className="form-label">Nombre de la cuenta</label>
                <input className="input-field" placeholder="Ej. BCP Soles, Efectivo casa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}>
                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Moneda</label>
                  <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Banco / Entidad (opcional)</label>
                <input className="input-field" placeholder="BCP, BBVA, Yape..." value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))} />
              </div>

              <div>
                <label className="form-label">Saldo actual</label>
                <input className="input-field" type="number" step="0.01" placeholder="0.00" value={form.current_balance} onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))} style={{ fontFamily: 'var(--font-mono)' }} />
              </div>

              <div>
                <label className="form-label">Nota (opcional)</label>
                <input className="input-field" placeholder="Detalles..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Guardando...' : editAcc ? 'Guardar cambios' : 'Crear cuenta'}
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
