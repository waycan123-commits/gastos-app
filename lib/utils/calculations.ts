import { Expense, DashboardMetrics, AlertLevel, RecurringExpense, Account } from '@/lib/supabase/types'
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

export function getMonthlyRecurringTotal(recurringExpenses: RecurringExpense[]): number {
  return recurringExpenses
    .filter(r => r.is_active)
    .reduce((sum, r) => {
      const base = r.amount
      if (r.frequency === 'mensual') return sum + base
      if (r.frequency === 'quincenal') return sum + base * 2
      if (r.frequency === 'semanal') return sum + base * 4.33
      if (r.frequency === 'anual') return sum + base / 12
      return sum + base
    }, 0)
}

export function calculateMetrics(
  expenses: Expense[],
  monthlyIncome: number,
  financialDayStart: number = 1,
  recurringExpenses: RecurringExpense[] = [],
  accounts: Account[] = []
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

  // Credit card spent this month
  const creditCardSpentMonth = monthExpenses
    .filter(e => e.credit_card_id || e.payment_method === 'crédito')
    .reduce((sum, e) => sum + e.amount, 0)

  // Total accounts balance
  const accountsBalance = accounts
    .filter(a => a.is_active)
    .reduce((sum, a) => sum + a.current_balance, 0)

  // Recurring
  const recurringEstimatedMonth = getMonthlyRecurringTotal(recurringExpenses)
  const recurringPercentOfIncome = monthlyIncome > 0 ? (recurringEstimatedMonth / monthlyIncome) * 100 : 0

  // Savings estimate
  const savingsEstimated = monthlyIncome - monthlyProjection

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
    totalSpent, remaining, percentageSpent, dailyAverage, recommendedDaily,
    topCategory, monthlyProjection, alertLevel, daysRemaining, currentDay, totalDays,
    creditCardSpentMonth, accountsBalance, recurringEstimatedMonth, savingsEstimated,
    recurringPercentOfIncome,
  }
}

export function getAlertStyle(level: AlertLevel): { bg: string; text: string; bar: string } {
  switch (level) {
    case 'green':    return { bg: 'alert-green',    text: '#22c55e', bar: '#22c55e' }
    case 'yellow':   return { bg: 'alert-yellow',   text: '#f59e0b', bar: '#f59e0b' }
    case 'orange':   return { bg: 'alert-orange',   text: '#f97316', bar: '#f97316' }
    case 'red':      return { bg: 'alert-red',      text: '#f43f5e', bar: '#f43f5e' }
    case 'critical': return { bg: 'alert-critical', text: '#ef4444', bar: '#ef4444' }
    default:         return { bg: 'alert-green',    text: '#22c55e', bar: '#22c55e' }
  }
}

// Keep old helpers for backwards compat
export function getAlertColor(level: AlertLevel): string { return getAlertStyle(level).text }
export function getAlertBg(level: AlertLevel): string { return getAlertStyle(level).bg }
export function getAlertProgressColor(level: AlertLevel): string { return getAlertStyle(level).bar }

export function formatCurrency(amount: number, currency: string = 'PEN'): string {
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function getRecommendations(
  metrics: DashboardMetrics,
  monthlyIncome: number,
  currency: string,
  nextCardPaymentDays?: number
): string[] {
  const recs: string[] = []
  const { totalSpent, remaining, percentageSpent, recommendedDaily, topCategory,
    monthlyProjection, daysRemaining, recurringPercentOfIncome, savingsEstimated,
    accountsBalance, dailyAverage } = metrics

  if (topCategory !== '-') {
    recs.push(`Tu mayor gasto este mes es ${topCategory}.`)
  }

  if (recurringPercentOfIncome > 40) {
    recs.push(`Tus gastos recurrentes representan el ${recurringPercentOfIncome.toFixed(0)}% de tu ingreso mensual.`)
  }

  if (daysRemaining > 0 && remaining > 0) {
    recs.push(`Te quedan ${daysRemaining} días del mes y puedes gastar ${formatCurrency(recommendedDaily, currency)}/día.`)
  }

  if (monthlyProjection > monthlyIncome) {
    recs.push(`⚠️ Tu gasto proyectado (${formatCurrency(monthlyProjection, currency)}) supera tu ingreso mensual.`)
  }

  if (savingsEstimated > 0) {
    recs.push(`Si mantienes este ritmo, ahorrarías aproximadamente ${formatCurrency(savingsEstimated, currency)} este mes.`)
  }

  if (accountsBalance > 0 && dailyAverage > 0) {
    const daysOfCash = accountsBalance / dailyAverage
    if (daysOfCash < 7) {
      recs.push(`Tu saldo disponible en cuentas alcanza solo para ~${Math.floor(daysOfCash)} días al ritmo actual.`)
    }
  }

  if (nextCardPaymentDays !== undefined && nextCardPaymentDays <= 5) {
    recs.push(`Tu próxima fecha de pago de tarjeta está en ${nextCardPaymentDays} días.`)
  }

  if (percentageSpent >= 90 && percentageSpent < 100) {
    recs.push(`Evita gastos no esenciales hasta fin de mes. Ya usaste el ${percentageSpent.toFixed(0)}% de tu ingreso.`)
  }

  if (totalSpent > monthlyIncome) {
    recs.push(`🔴 Has superado tu ingreso mensual. Revisa tus finanzas con urgencia.`)
  }

  return recs
}

export function getNextOccurrence(chargeDay: number): Date {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()

  if (day <= chargeDay) {
    return new Date(year, month, chargeDay)
  } else {
    return new Date(year, month + 1, chargeDay)
  }
}

export function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
