'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/lib/supabase/types'

const CURRENCIES = [
  { code: 'PEN', label: 'Sol Peruano (S/)' },
  { code: 'USD', label: 'Dólar Americano ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'COP', label: 'Peso Colombiano ($)' },
  { code: 'MXN', label: 'Peso Mexicano ($)' },
  { code: 'ARS', label: 'Peso Argentino ($)' },
  { code: 'CLP', label: 'Peso Chileno ($)' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    monthly_income: '',
    currency: 'PEN',
    financial_day_start: '1',
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single()
      if (data) {
        setProfile(data)
        setForm({
          monthly_income: String(data.monthly_income),
          currency: data.currency,
          financial_day_start: String(data.financial_day_start),
        })
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
      await supabase.from('profiles').update(payload).eq('user_id', user.id)
    } else {
      await supabase.from('profiles').insert(payload)
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

  if (loading) return <Shell><div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div></Shell>

  return (
    <Shell>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: 24 }}>
        Configuración
      </h1>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Income section */}
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>💰 Perfil financiero</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <Label>Ingreso mensual</Label>
              <input
                className="input-field"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej. 3500.00"
                value={form.monthly_income}
                onChange={e => setForm(f => ({ ...f, monthly_income: e.target.value }))}
                required
                style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600 }}
              />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Tu ingreso neto mensual en la moneda principal.</p>
            </div>
            <div>
              <Label>Moneda principal</Label>
              <select className="input-field" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Día de inicio del mes financiero</Label>
              <select className="input-field" value={form.financial_day_start} onChange={e => setForm(f => ({ ...f, financial_day_start: e.target.value }))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>Día {d}{d === 1 ? ' (predeterminado)' : ''}</option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Útil si tu quincena o sueldo llega en un día distinto al 1.
              </p>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '13px' }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar configuración'}
        </button>
      </form>

      {/* App info */}
      <div className="card" style={{ padding: 20, marginTop: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>📱 Instalar como app</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Esta app funciona como PWA (Progressive Web App). Puedes instalarla en tu dispositivo:
        </p>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 4 }}>Android (Chrome)</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Menú ⋮ → "Añadir a pantalla de inicio"</p>
          </div>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>iPhone (Safari)</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Botón compartir → "Añadir a inicio"</p>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', padding: '13px', color: 'var(--accent-rose)', borderColor: 'rgba(244,63,94,0.2)' }}>
          Cerrar sesión
        </button>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '20px 16px 0', maxWidth: 600, margin: '0 auto' }}>{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>{children}</label>
}
