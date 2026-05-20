'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/dashboard` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 400, padding: '36px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
        <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Revisa tu correo</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Te enviamos un enlace de confirmación a <strong>{email}</strong>. Confirma tu cuenta para comenzar.
        </p>
        <Link href="/login" style={{ display: 'block', marginTop: 20, color: 'var(--accent-blue)', fontWeight: 600, fontSize: 14 }}>
          Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="card animate-fade-up" style={{ width: '100%', maxWidth: 400, padding: '36px 32px' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          💰 Gastos
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
          Crea tu cuenta gratuita
        </p>
      </div>

      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            CORREO ELECTRÓNICO
          </label>
          <input type="email" className="input-field" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
            CONTRASEÑA
          </label>
          <input type="password" className="input-field" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required />
        </div>

        {error && (
          <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f43f5e' }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 4 }}>
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600 }}>
          Iniciar sesión
        </Link>
      </p>
    </div>
  )
}

export const dynamic = 'force-dynamic'
