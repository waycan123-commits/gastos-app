'use client'
import { useState, useEffect, useCallback } from 'react'
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

  const load = useCallback(async () => {
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
    ;(budRes.data || []).forEach((b: CategoryBudget) => { eb[b.category_id] = String(b.budget_amount) })
    setEditBudget(eb)
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { load() }, [load])

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
    await supabase.from('categories').insert(
      DEFAULT_CATEGORIES.map(c => ({ user_id: user.id, name: c.name, icon: c.icon, color: c.color, is_default: true }))
    )
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

  if (loading) return <Shell><div className="empty-state"><p style={{ color: 'var(--text-muted)' }}>Cargando...</p></div></Shell>

  return (
    <Shell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Presupuesto {format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {categories.length === 0 && (
            <button className="btn-ghost" onClick={initDefaults} style={{ fontSize: 12, padding: '8px 12px' }}>
              Predeterminadas
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowAdd(!showAdd)} style={{ fontSize: 13, padding: '9px 14px' }}>
            {showAdd ? '✕' : '+ Nueva'}
          </button>
        </div>
      </div>

      {/* New category form */}
      {showAdd && (
        <div className="card anim-slide-up" style={{ padding: 18, marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Nueva categoría</p>
          <form onSubmit={addCategory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 52px', gap: 10 }}>
              <div>
                <label className="form-label">Nombre</label>
                <input className="input-field" placeholder="Ej. Mascotas" value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Emoji</label>
                <input className="input-field" placeholder="🏷️" value={newCat.icon} onChange={e => setNewCat(n => ({ ...n, icon: e.target.value }))} style={{ textAlign: 'center', fontSize: 20, padding: '10px 6px' }} />
              </div>
              <div>
                <label className="form-label">Color</label>
                <input type="color" value={newCat.color} onChange={e => setNewCat(n => ({ ...n, color: e.target.value }))}
                  style={{ width: '100%', height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: 'pointer', padding: 4 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)} style={{ flex: 1, fontSize: 13 }}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 2, fontSize: 13 }}>Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">🏷️</div>
          <p className="empty-state-title">Sin categorías</p>
          <p className="empty-state-desc">Crea las categorías predeterminadas o agrega una personalizada.</p>
          <button className="btn-primary" onClick={initDefaults} style={{ marginTop: 16, fontSize: 14, padding: '10px 20px' }}>
            Crear predeterminadas
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {categories.map((cat, i) => {
            const budget = budgets.find(b => b.category_id === cat.id)
            const budgetVal = editBudget[cat.id] ?? (budget ? String(budget.budget_amount) : '')
            return (
              <div key={cat.id} className="list-row" style={{ gap: 12 }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${cat.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {cat.icon}
                </div>

                {/* Name + budget input */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{cat.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number" placeholder="Sin límite"
                      value={budgetVal}
                      onChange={e => setEditBudget(eb => ({ ...eb, [cat.id]: e.target.value }))}
                      style={{
                        width: 110, background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '5px 9px', fontSize: 13, color: 'var(--text-primary)',
                        outline: 'none', fontFamily: 'var(--font-mono)',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currency}/mes</span>
                    <button
                      onClick={() => saveBudget(cat.id)}
                      disabled={saving === cat.id}
                      style={{
                        background: 'var(--accent-blue)', color: '#fff', border: 'none',
                        borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', opacity: saving === cat.id ? 0.5 : 1,
                      }}
                    >
                      {saving === cat.id ? '...' : 'OK'}
                    </button>
                  </div>
                </div>

                {/* Color dot + delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div className="color-dot" style={{ background: cat.color }} />
                  {!cat.is_default && (
                    <button className="btn-icon" onClick={() => deleteCategory(cat.id)} style={{ color: 'var(--accent-rose)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                      </svg>
                    </button>
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
  return <div className="page-shell">{children}</div>
}

export const dynamic = 'force-dynamic'
