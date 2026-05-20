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
    const inserts = toImport.map(t => ({
      user_id: user.id,
      name: t.description,
      category_id: t.categoryId,
      amount: t.amount,
      currency,
      date: t.date,
      payment_method: 'crédito',
      note: 'Importado desde estado de cuenta',
    }))

    if (inserts.length > 0) {
      await supabase.from('expenses').insert(inserts)
    }

    // Log the import
    await supabase.from('statement_imports').insert({
      user_id: user.id,
      raw_text: text.slice(0, 2000),
      transactions_count: inserts.length,
    })

    setImported(inserts.length)
    setStep('done')
    setImporting(false)
  }

  function reset() {
    setText('')
    setParsed([])
    setStep('input')
    setImported(0)
  }

  return (
    <div style={{ padding: '20px 16px 0', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Importar tarjeta</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Pega texto de tu estado de cuenta para importar transacciones automáticamente.
        </p>
      </div>

      {/* Security warning */}
      <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>⚠️ Privacidad</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          No pegues datos sensibles como número completo de tarjeta, DNI, dirección o claves. <strong>Redacta esos datos antes</strong> de pegar el texto.
        </p>
      </div>

      {step === 'input' && (
        <div className="card animate-fade-up" style={{ padding: 20 }}>
          <Label>Texto del estado de cuenta</Label>
          <textarea
            className="input-field"
            placeholder={`Pega aquí el texto copiado de tu estado de cuenta.\n\nEjemplo:\n01/05/2025  WONG SURCO                    S/ 45.60\n02/05/2025  UBER TRIP                     S/ 12.50\n03/05/2025  NETFLIX                       S/ 35.90`}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{ minHeight: 200, resize: 'vertical', lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {text.split('\n').filter(l => l.trim()).length} líneas
            </span>
            <button className="btn-primary" onClick={handleParse} disabled={!text.trim()}>
              Analizar texto →
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="animate-fade-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Se detectaron <strong style={{ color: 'var(--text-primary)' }}>{parsed.length} transacciones</strong>
            </p>
            <button className="btn-ghost" onClick={reset} style={{ fontSize: 12, padding: '6px 12px' }}>← Volver</button>
          </div>

          <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
            {parsed.map((t, i) => (
              <div key={i} style={{
                padding: '14px 16px',
                borderBottom: i < parsed.length - 1 ? '1px solid var(--border)' : 'none',
                background: t.selected ? 'transparent' : 'rgba(0,0,0,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input type="checkbox" checked={t.selected} onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))}
                    style={{ marginTop: 3, accentColor: 'var(--accent-blue)', cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                      <input
                        value={t.description}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-display)' }}
                      />
                      <input
                        type="number"
                        value={t.amount}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 13, color: 'var(--accent-rose)', outline: 'none', width: 90, fontFamily: 'var(--font-mono)', textAlign: 'right' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select
                        value={t.categoryId}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, categoryId: e.target.value } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-display)' }}
                      >
                        {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                      </select>
                      <input
                        type="date"
                        value={t.date}
                        onChange={e => setParsed(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))}
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-display)' }}
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
            <button className="btn-primary" onClick={handleImport} disabled={importing || parsed.filter(t => t.selected).length === 0}>
              {importing ? 'Importando...' : `Importar ${parsed.filter(t => t.selected).length} transacciones`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="card animate-fade-up" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>¡Listo!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Se importaron <strong>{imported} transacciones</strong> correctamente.
          </p>
          <button className="btn-primary" onClick={reset} style={{ marginTop: 20 }}>
            Importar más
          </button>
        </div>
      )}

      {/* OCR placeholder */}
      <div style={{ marginTop: 20, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '14px 16px' }}>
        <p style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600, marginBottom: 4 }}>🔮 Próximamente</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Importación desde PDF o imagen de estado de cuenta usando OCR. Por ahora, copia y pega el texto manualmente.
        </p>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>{children}</label>
}
