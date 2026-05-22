'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/supabase/types'

const CURRENCIES = [
  { code: 'PEN', label: 'Sol Peruano (S/)' },
  { code: 'USD', label: 'Dólar Americano ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'COP', label: 'Peso Colombiano' },
  { code: 'MXN', label: 'Peso Mexicano' },
  { code: 'ARS', label: 'Peso Argentino' },
  { code: 'CLP', label: 'Peso Chileno' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ monthly_income: '', currency: 'PEN', financial_day_start: '1' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email || '')
      const { data, error: profileError } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (profileError) console.error('Error loading profile', profileError)
      if (data) {
        setProfile(data)
        setForm({ monthly_income: String(data.monthly_income), currency: data.currency, financial_day_start: String(data.financial_day_start) })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      user_id: user.id,
      monthly_income: parseFloat(form.monthly_income),
      currency: form.currency,
      financial_day_start: parseInt(form.financial_day_start),
      updated_at: new Date().toISOString(),
    }
    if (profile) {
      const { error: saveError } = await supabase.from('profiles').update(payload).eq('user_id', user.id)
      if (saveError) { console.error('Error updating profile', saveError); setError('No se pudo guardar la configuración.'); setSaving(false); return }
    } else {
      const { error: saveError } = await supabase.from('profiles').insert(payload)
      if (saveError) { console.error('Error creating profile', saveError); setError('No se pudo crear tu perfil.'); setSaving(false); return }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card card-glass empty-state"><p style={{ color: 'var(--text-muted)' }}>Cargando...</p></div>
      </div>
    )
  }

  return (
    <div className="page-shell">
      <div className="anim-fade-up d0" style={{ marginBottom: 24 }}>
        <h1 className="page-title">Configuración</h1>
        <p className="page-subtitle">{email}</p>
      </div>
      {error && <div className="toast-error anim-fade-up d0">{error}</div>}

      <form onSubmit={handleSave} className="mobile-form">
        {/* Financial profile */}
        <div className="card card-glass anim-fade-up d1" style={{ padding: '20px 18px' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💰</span> Perfil financiero
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="form-label">Ingreso mensual neto</label>
              <input
                className="input-field"
                type="number" step="0.01" min="0"
                placeholder="Ej. 3500.00"
                value={form.monthly_income}
                onChange={e => setForm(f => ({ ...f, monthly_income: e.target.value }))}
                required
                style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 600 }}
              />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                Tu ingreso neto después de impuestos y descuentos.
              </p>
            </div>

            <div>
              <label className="form-label">Moneda principal</label>
              <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Día de inicio del período financiero</label>
              <select className="input-field" value={form.financial_day_start} onChange={e => setForm(f => ({ ...f, financial_day_start: e.target.value }))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Día {d}{d === 1 ? ' (predeterminado)' : ''}</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                Útil si cobras a mitad de mes. El período financiero arranca este día.
              </p>
            </div>
          </div>
        </div>

        <div className="form-actions anim-fade-up d2">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ width: '100%', padding: '13px', fontSize: 15, background: saved ? 'var(--accent-green)' : undefined }}
          >
            {saving ? 'Guardando...' : saved ? '✓ Cambios guardados' : 'Guardar configuración'}
          </button>
        </div>
      </form>

      {/* PWA install */}
      <div className="card card-glass anim-fade-up d3" style={{ padding: '18px 18px', marginTop: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📱</span> Instalar como app (PWA)
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-green)', marginBottom: 3 }}>Android · Chrome</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Menú ⋮ → <strong style={{ color: 'var(--text-secondary)' }}>"Añadir a pantalla de inicio"</strong>
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 3 }}>iPhone · Safari</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Botón compartir ↑ → <strong style={{ color: 'var(--text-secondary)' }}>"Añadir a inicio"</strong>
            </p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card card-glass anim-fade-up d4" style={{ padding: '18px 18px', marginTop: 12 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>ℹ️</span> Acerca de la app
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            ['Dashboard', 'Métricas, alertas y proyecciones'],
            ['Gastos', 'Registro y edición de gastos'],
            ['Tarjetas', 'Control de tarjetas de crédito'],
            ['Cuentas', 'Saldo en débito y efectivo'],
            ['Recurrentes', 'Suscripciones y pagos fijos'],
          ].map(([title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--accent-blue)', marginTop: 1 }}>·</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}> — {desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div style={{ marginTop: 20, marginBottom: 8 }}>
        <button
          onClick={handleLogout}
          className="btn-danger anim-fade-up d5"
          style={{ width: '100%', padding: '13px', fontSize: 15 }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
