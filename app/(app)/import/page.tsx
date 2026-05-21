'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseStatementText, ParsedTransaction } from '@/lib/utils/classifier'
import { Category } from '@/lib/supabase/types'

export default function ImportPage() {
  const supabase = createClient()
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<(ParsedTransaction & { selected: boolean; categoryId: string })[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currency, setCurrency] = useState('PEN')
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(0)
  const [step, setStep] = useState<'input' | 'review' | 'done'>('input')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [catRes, profRes] = await Promise.all([
        supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
        supabase.from('profiles').select('currency').eq('user_id', user.id).single(),
      ])
      setCategories(catRes.data || [])
      setCurrency(profRes.data?.currency || 'PEN')
    }
    load()
  }, [])

  function handleParse() {
    const transactions = parseStatementText(text)
    if (!transactions.length) {
      alert('No se detectaron transacciones. Asegúrate de pegar texto con fechas y montos.')
      return
    }
    const withCategory = transactions.map(t => ({
      ...t,
      selected: true,
      categoryId: categories.find(c => c.name === t.suggestedCategory)?.id || categories[0]?.id || '',
    }))
    setParsed(withCategory)
    setStep('review')
  }

  async function handleImport() {
    setImporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const toImport = parsed.filter(t => t.selected)
    if (toImport.length > 0) {
      await supabase.from('expenses').insert(toImport.map(t => ({
        user_id: user.id, name: t.description, category_id: t.categoryId,
        amount: t.amount, currency, date: t.date,
        payment_method: 'crédito', note: 'Importado desde estado de cuenta',
      })))
    }
    await supabase.from('statement_imports').insert({
      user_id: user.id, raw_text: text.slice(0, 2000), transactions_count: toImport.length,
    })
    setImported(toImport.length)
    setStep('done')
    setImporting(false)
  }

  function reset() { setText(''); setParsed([]); setStep('input'); setImported(0) }

  return (
    <div className="page-shell">
      <div className="anim-fade-up d0" style={{ marginBottom: 20 }}>
        <h1 className="page-title">Importar tarjeta</h1>
        <p className="page-subtitle">Pega texto de tu estado de cuenta</p>
      </div>

      {/* Security notice */}
      <div className="anim-fade-up d1" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '13px 15px', marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-amber)', marginBottom: 4 }}>⚠️ Privacidad importante</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          No pegues número completo de tarjeta, DNI, dirección ni contraseñas. <strong>Redacta esos datos antes</strong> de pegar el texto.
        </p>
      </div>

      {/* Step indicator */}
      <div className="anim-fade-up d1" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['Pegar texto', 'input'], ['Revisar', 'review'], ['Listo', 'done']].map(([label, s], i) => {
          const steps = ['input', 'review', 'done']
          const current = steps.indexOf(step)
          const stepIdx = steps.indexOf(s)
          const active = step === s
          const done = current > stepIdx
          return (
            <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                flex: 1, padding: '7px 8px', borderRadius: 8, textAlign: 'center',
                background: active ? 'var(--accent-blue)' : done ? 'rgba(59,130,246,0.15)' : 'var(--bg-surface)',
                border: `1px solid ${active ? 'var(--accent-blue)' : done ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
              }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: active ? '#fff' : done ? 'var(--accent-blue)' : 'var(--text-muted)' }}>
                  {done ? '✓ ' : ''}{label}
                </p>
              </div>
              {i < 2 && <div style={{ width: 12, height: 1, background: 'var(--border)', flexShrink: 0 }} />}
            </div>
          )
        })}
      </div>

      {/* Step: input */}
      {step === 'input' && (
        <div className="card anim-fade-up d2" style={{ padding: 18 }}>
          <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Texto del estado de cuenta</label>
          <textarea
            className="input-field"
            placeholder={`Pega aquí el texto de tu banco.\n\nEjemplo:\n01/05/2025  WONG SURCO                S/ 45.60\n02/05/2025  UBER TRIP                  S/ 12.50\n03/05/2025  NETFLIX                    S/ 35.90`}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ minHeight: 200, resize: 'vertical', fontSize: 13 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {text.split('\n').filter(l => l.trim()).length} líneas
            </span>
            <button className="btn-primary" onClick={handleParse} disabled={!text.trim()}>
              Analizar →
            </button>
          </div>
        </div>
      )}

      {/* Step: review */}
      {step === 'review' && (
        <div className="anim-fade-up d1">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{parsed.length}</strong> transacciones detectadas
            </p>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '7px 12px' }}>← Volver</button>
          </div>

          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            {parsed.map((t, i) => (
              <div key={i} style={{
                padding: '13px 14px',
                borderBottom: i < parsed.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                background: t.selected ? 'transparent' : 'rgba(0,0,0,0.15)',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <input
                    type="checkbox" checked={t.selected}
                    onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                    style={{ marginTop: 4, accentColor: 'var(--accent-blue)', cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, marginBottom: 8 }}>
                      <input
                        value={t.description}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 9px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', minWidth: 0 }}
                      />
                      <input
                        type="number" value={t.amount}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 9px', fontSize: 13, color: 'var(--accent-rose)', outline: 'none', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select
                        value={t.categoryId}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, categoryId: e.target.value } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 9px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', appearance: 'none' }}
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                      <input
                        type="date" value={t.date}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 9px', fontSize: 12, color: 'var(--text-primary)', outline: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {parsed.filter(t => t.selected).length} de {parsed.length} seleccionadas
            </span>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || parsed.filter(t => t.selected).length === 0}
            >
              {importing ? 'Importando...' : `Importar ${parsed.filter(t => t.selected).length}`}
            </button>
          </div>
        </div>
      )}

      {/* Step: done */}
      {step === 'done' && (
        <div className="card anim-slide-up" style={{ padding: '44px 28px', textAlign: 'center' }}>
          <p style={{ fontSize: 52, marginBottom: 16 }}>✅</p>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>¡Importado!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Se registraron <strong>{imported} transacciones</strong> en tus gastos.
          </p>
          <button className="btn-primary" onClick={reset} style={{ marginTop: 24, padding: '11px 28px' }}>
            Importar más
          </button>
        </div>
      )}

      {/* OCR placeholder */}
      <div className="anim-fade-up d4" style={{ marginTop: 16, background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 12, padding: '13px 15px' }}>
        <p style={{ fontSize: 12, color: '#a78bfa', fontWeight: 700, marginBottom: 3 }}>🔮 Próximamente</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Importación desde PDF o imagen de estado de cuenta (OCR). Por ahora, copia y pega el texto manualmente.
        </p>
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
