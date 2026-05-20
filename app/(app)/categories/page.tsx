'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category, CategoryBudget } from '@/lib/supabase/types'
import { DEFAULT_CATEGORIES } from '@/lib/utils/classifier'
import { formatCurrency } from '@/lib/utils/calculations'
import { format } from 'date-fns'

export default function CategoriesPage() {
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<CategoryBudget[]>([])
  const [currency, setCurrency] = useState('PEN')
  const [loading, setLoading] = useState(true)
  const [editBudget, setEditBudget] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newCat, setNewCat] = useState({ name: '', icon: '📦', color: '#6b7280' })

  const currentMonth = format(new Date(), 'yyyy-MM')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [catRes, budRes, profRes] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('category_budgets').select('*').eq('user_id', user.id).eq('month', currentMonth),
      supabase.from('profiles').select('currency').eq('user_id', user.id).single(),
    ])
    setCategories(catRes.data || [])
    setBudgets(budRes.data || [])
    setCurrency(profRes.data?.currency || 'PEN')
    const eb: Record<string, string> = {}
    ;(budRes.data || []).forEach((b: CategoryBudget) => {
      eb[b.category_id] = String(b.budget_amount)
    })
    setEditBudget(eb)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveBudget(categoryId: string) {
    setSaving(categoryId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const amount = parseFloat(editBudget[categoryId] || '0')
    const existing = budgets.find(b => b.category_id === categoryId)
    if (existing) {
      await supabase.from('category_budgets').update({ budget_amount: amount }).eq('id', existing.id)
    } else {
      await supabase.from('category_budgets').insert({ user_id: user.id, category_id: categoryId, month: currentMonth, budget_amount: amount })
    }
    setSaving(null)
    load()
  }

  async function initDefaults() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const inserts = DEFAULT_CATEGORIES.map(c => ({ user_id: user.id, name: c.name, icon: c.icon, color: c.color, is_default: true }))
    await supabase.from('categories').insert(inserts)
    load()
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('categories').insert({ user_id: user.id, name: newCat.name, icon: newCat.icon, color: newCat.color, is_default: false })
    setNewCat({ name: '', icon: '📦', color: '#6b7280' })
    setShowAdd(false)
    load()
  }

  async function deleteCategory(id: string) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(c => c.filter(x => x.id !== id))
  }

  if (loading) return <Shell><div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div></Shell>

  return (
    <Shell>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Categorías</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {categories.length === 0 && (
            <button className="btn-ghost" onClick={initDefaults} style={{ fontSize: 12, padding: '8px 12px' }}>
              Crear predeterminadas
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 12, padding: '8px 14px' }}>
            {showAdd ? '✕' : '+ Nueva'}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Presupuesto para <strong style={{ color: 'var(--text-secondary)' }}>{format(new Date(), 'MMMM yyyy')}</strong> · Opcional
      </p>

      {showAdd && (
        <div className="card animate-fade-up" style={{ padding: 20, marginBottom: 16 }}>
          <form onSubmit={addCategory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 10 }}>
              <div>
                <Label>Nombre</Label>
                <input className="input-field" placeholder="Nueva categoría" value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))} required />
              </div>
              <div>
                <Label>Emoji</Label>
                <input className="input-field" placeholder="🏷️" value={newCat.icon} onChange={e => setNewCat(n => ({ ...n, icon: e.target.value }))} style={{ textAlign: 'center', fontSize: 18 }} />
              </div>
              <div>
                <Label>Color</Label>
                <input type="color" value={newCat.color} onChange={e => setNewCat(n => ({ ...n, color: e.target.value }))} style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: 'pointer', padding: 4 }} />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>Guardar categoría</button>
          </form>
        </div>
      )}

      {categories.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>🏷️</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No hay categorías.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Crea las categorías predeterminadas o agrega una nueva.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {categories.map((cat, i) => {
            const budget = budgets.find(b => b.category_id === cat.id)
            const budgetVal = editBudget[cat.id] ?? (budget ? String(budget.budget_amount) : '')
            return (
              <div key={cat.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: i < categories.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <span style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0 }}>{cat.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <input
                      type="number"
                      placeholder="Sin presupuesto"
                      value={budgetVal}
                      onChange={e => setEditBudget(eb => ({ ...eb, [cat.id]: e.target.value }))}
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-primary)', width: 120, outline: 'none', fontFamily: 'var(--font-mono)' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currency}/mes</span>
                    <button onClick={() => saveBudget(cat.id)} disabled={saving === cat.id}
                      style={{ background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: saving === cat.id ? 0.5 : 1 }}>
                      {saving === cat.id ? '...' : 'Guardar'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  {!cat.is_default && (
                    <button onClick={() => deleteCategory(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 4 }}>✕</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '20px 16px 0', maxWidth: 600, margin: '0 auto' }}>{children}</div>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>{children}</label>
}
