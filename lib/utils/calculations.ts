import { Expense, DashboardMetrics, AlertLevel } from '@/lib/supabase/types'
import { getDaysInMonth, getDate, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'

export function getMonthExpenses(expenses: Expense[], financialDayStart: number = 1): Expense[] {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  let periodStart: Date
  let periodEnd: Date

  if (financialDayStart === 1) {
    periodStart = startOfMonth(today)
    periodEnd = endOfMonth(today)
  } else {
    const startDay = financialDayStart
    if (today.getDate() >= startDay) {
      periodStart = new Date(year, month, startDay)
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      periodEnd = new Date(nextYear, nextMonth, startDay - 1, 23, 59, 59)
    } else {
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      periodStart = new Date(prevYear, prevMonth, startDay)
      periodEnd = new Date(year, month, startDay - 1, 23, 59, 59)
    }
  }

  return expenses.filter(e => {
    const expDate = parseISO(e.date)
    return isWithinInterval(expDate, { start: periodStart, end: periodEnd })
  })
}

export function calculateMetrics(
  expenses: Expense[],
  monthlyIncome: number,
  financialDayStart: number = 1
): DashboardMetrics {
  const today = new Date()
  const totalDays = getDaysInMonth(today)
  const currentDay = getDate(today)

  const monthExpenses = getMonthExpenses(expenses, financialDayStart)
  const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0)
  const remaining = monthlyIncome - totalSpent
  const percentageSpent = monthlyIncome > 0 ? (totalSpent / monthlyIncome) * 100 : 0

  const daysRemaining = totalDays - currentDay
  const dailyAverage = currentDay > 0 ? totalSpent / currentDay : 0
  const monthlyProjection = dailyAverage * totalDays
  const recommendedDaily = daysRemaining > 0 ? remaining / daysRemaining : 0

  // Top category
  const categoryTotals: Record<string, number> = {}
  monthExpenses.forEach(e => {
    const catName = e.category?.name || 'Otros'
    categoryTotals[catName] = (categoryTotals[catName] || 0) + e.amount
  })
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

  // Alert level
  let alertLevel: AlertLevel = 'green'
  if (monthlyIncome <= 0) {
    alertLevel = 'green'
  } else if (totalSpent > monthlyIncome) {
    alertLevel = 'critical'
  } else if (percentageSpent >= 90) {
    alertLevel = 'red'
  } else if (percentageSpent >= 75) {
    alertLevel = 'orange'
  } else if (percentageSpent >= 50) {
    alertLevel = 'yellow'
  }

  return {
    totalSpent,
    remaining,
    percentageSpent,
    dailyAverage,
    recommendedDaily,
    topCategory,
    monthlyProjection,
    alertLevel,
    daysRemaining,
    currentDay,
    totalDays,
  }
}

export function getAlertColor(level: AlertLevel): string {
  switch (level) {
    case 'green': return 'text-emerald-400'
    case 'yellow': return 'text-yellow-400'
    case 'orange': return 'text-orange-400'
    case 'red': return 'text-red-400'
    case 'critical': return 'text-red-600'
    default: return 'text-emerald-400'
  }
}

export function getAlertBg(level: AlertLevel): string {
  switch (level) {
    case 'green': return 'bg-emerald-500/20 border-emerald-500/30'
    case 'yellow': return 'bg-yellow-500/20 border-yellow-500/30'
    case 'orange': return 'bg-orange-500/20 border-orange-500/30'
    case 'red': return 'bg-red-500/20 border-red-500/30'
    case 'critical': return 'bg-red-700/30 border-red-600/50'
    default: return 'bg-emerald-500/20 border-emerald-500/30'
  }
}

export function getAlertProgressColor(level: AlertLevel): string {
  switch (level) {
    case 'green': return 'bg-emerald-400'
    case 'yellow': return 'bg-yellow-400'
    case 'orange': return 'bg-orange-400'
    case 'red': return 'bg-red-400'
    case 'critical': return 'bg-red-600'
    default: return 'bg-emerald-400'
  }
}

export function formatCurrency(amount: number, currency: string = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function getRecommendations(
  metrics: DashboardMetrics,
  monthlyIncome: number,
  currency: string
): string[] {
  const recs: string[] = []
  const { totalSpent, remaining, percentageSpent, recommendedDaily, topCategory, monthlyProjection, daysRemaining } = metrics

  if (topCategory !== '-') {
    recs.push(`Tu mayor gasto este mes es ${topCategory}.`)
  }

  if (daysRemaining > 0 && remaining > 0) {
    recs.push(`Te quedan ${daysRemaining} días del mes y puedes gastar aproximadamente ${formatCurrency(recommendedDaily, currency)} por día.`)
  }

  if (monthlyProjection > monthlyIncome) {
    recs.push(`⚠️ Cuidado: tu proyección mensual (${formatCurrency(monthlyProjection, currency)}) supera tu ingreso.`)
  }

  if (percentageSpent >= 90 && percentageSpent < 100) {
    recs.push(`Evita gastos no esenciales hasta fin de mes. Ya usaste el ${percentageSpent.toFixed(0)}% de tu ingreso.`)
  }

  if (totalSpent > monthlyIncome) {
    recs.push(`🔴 Has superado tu ingreso mensual. Revisa tus gastos con urgencia.`)
  }

  return recs
}
