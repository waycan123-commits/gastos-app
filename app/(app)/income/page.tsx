'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Account, Currency, IncomeFrequency, IncomeSource } from '@/lib/supabase/types'
import { formatCurrency, getIncomeOccurrencesForMonth } from '@/lib/utils/calculations'

const CURRENCIES: Currency[] = ['PEN', 'USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP']
const FREQUENCIES: { value: IncomeFrequency; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'quincenal', label: 'Quincenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'único', label: 'Único' },
]

type IncomeForm = {
  name: string
  amount: string
  currency: Currency
  frequency: IncomeFrequency
  day_of_month: string
  destination_account_id: string
  is_active: boolean
  notes: string
}

const emptyIncome = (currency: Currency = 'PEN'): IncomeForm => ({
  name: '',
  amount: '',
  currency,
  frequency: 'mensual',
  day_of_month: '15',
  destination_account_id: '',
  is_active: true,
  notes: '',
})

export default function IncomePage() {
  const supabase = createClient()
  const [incomes, setIncomes] = useState<IncomeSource[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editIncome, setEditIncome] = useState<IncomeSource | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState<IncomeForm>(emptyIncome())

  const load = useCallback(async () => {
    setError('')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) console.error('Error getting user', userError)
    if (!user) return

    const [incomeRes, accountsRes, profileRes] = await Promise.all([
      supabase.from('income_sources').select('*, destination_account:accounts(*)').eq('user_id', user.id).order('day_of_month'),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
      supabase.from('profiles').select('currency').eq('user_id', user.id).single(),
    ])

    if (incomeRes.error) {
      console.error('Error loading income sources', incomeRes.error)
      setError('No se pudieron cargar los ingresos. Ejecuta la migración SQL de income_sources si aún no existe la tabla.')
    }
    if (accountsRes.error) console.error('Error loading accounts', accountsRes.error)

    setIncomes((incomeRes.data || []) as IncomeSource[])
    setAccounts(accountsRes.data || [])
    setForm(emptyIncome((profileRes.data?.currency || 'PEN') as Currency))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditIncome(null)
    setForm(emptyIncome(form.currency))
    setShowForm(true)
  }

  function openEdit(income: IncomeSource) {
    setEditIncome(income)
    setForm({
      name: income.name,
      amount: String(income.amount),
      currency: income.currency,
      frequency: income.frequency === 'unico' ? 'único' : income.frequency,
      day_of_month: String(income.day_of_month),
      destination_account_id: income.destination_account_id || '',
      is_active: income.is_active,
      notes: income.notes || '',
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditIncome(null)
    setSaving(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) console.error('Error getting user', userError)
    if (!user) return

    const payload = {
      name: form.name,
      amount: parseFloat(form.amount),
      currency: form.currency,
      frequency: form.frequency,
      day_of_month: parseInt(form.day_of_month),
      destination_account_id: form.destination_account_id || null,
      is_active: form.is_active,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }

    const res = editIncome
      ? await supabase.from('income_sources').update(payload).eq('id', editIncome.id)
      : await supabase.from('income_sources').insert({ ...payload, user_id: user.id })

    if (res.error) {
      console.error('Error saving income source', res.error)
      setError('No se pudo guardar el ingreso. Revisa la consola para más detalle.')
      setSaving(false)
      return
    }

    setMessage(editIncome ? 'Ingreso actualizado.' : 'Ingreso creado.')
    setTimeout(() => setMessage(''), 2600)
    closeForm()
    load()
  }

  async function handleToggle(income: IncomeSource) {
    const { error: toggleError } = await supabase.from('income_sources').update({ is_active: !income.is_active, updated_at: new Date().toISOString() }).eq('id', income.id)
    if (toggleError) {
      console.error('Error toggling income source', toggleError)
      setError('No se pudo cambiar el estado del ingreso.')
      return
    }
    setMessage(income.is_active ? 'Ingreso desactivado.' : 'Ingreso activado.')
    setTimeout(() => setMessage(''), 2600)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este ingreso recurrente?')) return
    const { error: deleteError } = await supabase.from('income_sources').delete().eq('id', id)
    if (deleteError) {
      console.error('Error deleting income source', deleteError)
      setError('No se pudo eliminar el ingreso.')
      return
    }
    setIncomes(prev => prev.filter(i => i.id !== id))
    setMessage('Ingreso eliminado.')
    setTimeout(() => setMessage(''), 2600)
  }

  const activeIncomes = incomes.filter(i => i.is_active)
  const totals = activeIncomes.reduce<Record<string, number>>((acc, income) => {
    getIncomeOccurrencesForMonth(income).forEach(event => {
      acc[event.currency] = (acc[event.currency] || 0) + event.amount
    })
    return acc
  }, {})
  const upcoming = activeIncomes.flatMap(income => getIncomeOccurrencesForMonth(income))
    .filter(event => event.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date))

  if (loading) return <Shell><div className="card card-glass empty-state"><p>Cargando...</p></div></Shell>

  return (
    <Shell>
      <div className="page-header anim-fade-up d0">
        <div>
          <h1 className="page-title">Ingresos</h1>
          <p className="page-subtitle">{activeIncomes.length} activos</p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ padding: '9px 16px', fontSize: 14 }}>+ Nuevo</button>
      </div>

      {message && <div className="toast-success anim-fade-up d0">{message}</div>}
      {error && <div className="toast-error anim-fade-up d0">{error}</div>}

      {activeIncomes.length > 0 && (
        <div className="card card-glass anim-fade-up d1" style={{ padding: '16px 18px', marginBottom: 14 }}>
          <p className="label-caps" style={{ marginBottom: 12 }}>Ingresos esperados del mes</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(totals).map(([currency, total]) => (
              <div key={currency} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{currency}</span>
                <strong style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>{formatCurrency(total, currency)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card card-glass anim-fade-up d2" style={{ padding: '16px 18px', marginBottom: 14 }}>
          <p className="label-caps" style={{ marginBottom: 12 }}>Próximos cobros</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {upcoming.slice(0, 5).map(event => (
              <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{event.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Día {event.day}{event.source ? ` · ${event.source}` : ''}</p>
                </div>
                <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{formatCurrency(event.amount, event.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {incomes.length === 0 ? (
        <div className="card card-glass empty-state anim-fade-up d2">
          <div className="empty-state-icon">$</div>
          <p className="empty-state-title">Sin ingresos registrados</p>
          <p className="empty-state-desc">Agrega tus sueldos, freelance, bonos o cualquier entrada recurrente para proyectar tu caja por fechas.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {incomes.map((income, idx) => (
            <div key={income.id} className={`card card-glass anim-fade-up d${Math.min(idx + 2, 5)}`} style={{ opacity: income.is_active ? 1 : 0.52 }}>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{income.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {FREQUENCIES.find(f => f.value === income.frequency || (f.value === 'único' && income.frequency === 'unico'))?.label} · Día {income.day_of_month}
                      {income.destination_account?.name ? ` · ${income.destination_account.name}` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>{formatCurrency(income.amount, income.currency)}</p>
                    {!income.is_active && <span className="badge badge-red" style={{ marginTop: 5 }}>Inactivo</span>}
                  </div>
                </div>
                {income.notes && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>{income.notes}</p>}
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.025)' }}>
                <button className="btn-ghost" onClick={() => openEdit(income)} style={{ flex: 1, fontSize: 13, padding: '8px' }}>Editar</button>
                <button className="btn-ghost" onClick={() => handleToggle(income)} style={{ flex: 1, fontSize: 13, padding: '8px' }}>
                  {income.is_active ? 'Desactivar' : 'Activar'}
                </button>
                <button className="btn-icon" onClick={() => handleDelete(income.id)} style={{ color: 'var(--accent-rose)' }} title="Eliminar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeForm() }}>
          <div className="modal-sheet anim-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                {editIncome ? 'Editar ingreso' : 'Nuevo ingreso'}
              </h2>
              <button className="btn-icon" onClick={closeForm} style={{ fontSize: 18 }}>x</button>
            </div>

            <form onSubmit={handleSubmit} className="mobile-form">
              <div>
                <label className="form-label">Nombre</label>
                <input className="input-field" placeholder="Sueldo quincena, freelance, bono..." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Monto</label>
                  <input className="input-field" type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required style={{ fontFamily: 'var(--font-mono)' }} />
                </div>
                <div>
                  <label className="form-label">Moneda</label>
                  <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value as Currency }))}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Frecuencia</label>
                  <select className="input-field" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as IncomeFrequency }))}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Día de cobro</label>
                  <select className="input-field" value={form.day_of_month} onChange={e => setForm(f => ({ ...f, day_of_month: e.target.value }))}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>Día {d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Cuenta destino opcional</label>
                <select className="input-field" value={form.destination_account_id} onChange={e => setForm(f => ({ ...f, destination_account_id: e.target.value }))}>
                  <option value="">Sin cuenta destino</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Nota opcional</label>
                <input className="input-field" placeholder="Detalles..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-ghost" onClick={closeForm} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2 }}>
                  {saving ? 'Guardando...' : editIncome ? 'Guardar cambios' : 'Crear ingreso'}
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
