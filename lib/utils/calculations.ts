import {
  Account,
  CashFlowCurrencySummary,
  CashFlowEvent,
  CashFlowPoint,
  CreditCard,
  Currency,
  DashboardMetrics,
  Expense,
  IncomeSource,
  AlertLevel,
  RecurringExpense,
} from '@/lib/supabase/types'
import { getDaysInMonth, getDate, startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns'

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

function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(day, 1), getDaysInMonth(new Date(year, month, 1)))
}

function monthDate(year: number, month: number, day: number): Date {
  return new Date(year, month, clampDay(year, month, day))
}

function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

function normalizeIncomeFrequency(frequency: IncomeSource['frequency']): IncomeSource['frequency'] {
  return frequency === 'unico' ? 'único' : frequency
}

export function getIncomeOccurrencesForMonth(income: IncomeSource, baseDate: Date = new Date()): CashFlowEvent[] {
  if (!income.is_active) return []
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const frequency = normalizeIncomeFrequency(income.frequency)
  const daysInMonth = getDaysInMonth(baseDate)
  const days: number[] = []

  if (frequency === 'mensual' || frequency === 'único') {
    days.push(clampDay(year, month, income.day_of_month))
  } else if (frequency === 'quincenal') {
    days.push(clampDay(year, month, income.day_of_month))
    days.push(clampDay(year, month, income.day_of_month + 15))
  } else if (frequency === 'semanal') {
    let day = clampDay(year, month, income.day_of_month)
    while (day <= daysInMonth) {
      days.push(day)
      day += 7
    }
  }

  return Array.from(new Set(days)).sort((a, b) => a - b).map(day => {
    const date = monthDate(year, month, day)
    return {
      id: `income-${income.id}-${day}`,
      date: dateKey(date),
      day,
      type: 'income',
      label: income.name,
      amount: income.amount,
      currency: income.currency,
      status: date < startOfToday(baseDate) ? 'done' : 'pending',
      source: income.destination_account?.name || undefined,
      color: 'var(--accent-green)',
    }
  })
}

export function getRecurringOccurrencesForMonth(recurring: RecurringExpense, baseDate: Date = new Date()): CashFlowEvent[] {
  if (!recurring.is_active) return []
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const daysInMonth = getDaysInMonth(baseDate)
  const days: number[] = []

  if (recurring.frequency === 'mensual' || recurring.frequency === 'anual') {
    days.push(clampDay(year, month, recurring.charge_day))
  } else if (recurring.frequency === 'quincenal') {
    days.push(clampDay(year, month, recurring.charge_day))
    days.push(clampDay(year, month, recurring.charge_day + 15))
  } else if (recurring.frequency === 'semanal') {
    let day = clampDay(year, month, recurring.charge_day)
    while (day <= daysInMonth) {
      days.push(day)
      day += 7
    }
  }

  return Array.from(new Set(days)).sort((a, b) => a - b).map(day => {
    const date = monthDate(year, month, day)
    return {
      id: `recurring-${recurring.id}-${day}`,
      date: dateKey(date),
      day,
      type: 'recurring',
      label: recurring.name,
      amount: -recurring.amount,
      currency: recurring.currency,
      status: date < startOfToday(baseDate) ? 'done' : 'pending',
      source: recurring.category?.name || recurring.payment_method,
      color: recurring.category?.color || 'var(--accent-amber)',
    }
  })
}

function startOfToday(baseDate: Date = new Date()): Date {
  const today = new Date(baseDate)
  today.setHours(0, 0, 0, 0)
  return today
}

export function getCurrentMonthExpenses(expenses: Expense[], baseDate: Date = new Date()): Expense[] {
  const start = startOfMonth(baseDate)
  const end = endOfMonth(baseDate)
  return expenses.filter(e => isWithinInterval(parseISO(e.date), { start, end }))
}

function getMonthCardPaymentEvents(cards: CreditCard[], baseDate: Date = new Date()): CashFlowEvent[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const today = startOfToday(baseDate)
  return cards
    .filter(card => card.is_active)
    .flatMap(card => {
      const dueDate = monthDate(year, month, card.payment_due_day)
      const closeDate = monthDate(year, month, card.billing_close_day)
      const events: CashFlowEvent[] = [{
        id: `card-close-${card.id}`,
        date: dateKey(closeDate),
        day: closeDate.getDate(),
        type: 'card_close',
        label: `Corte ${card.name}`,
        amount: 0,
        currency: card.currency,
        status: 'marker',
        source: card.bank,
        color: card.color,
      }]

      if (card.current_balance > 0) {
        events.push({
          id: `card-payment-${card.id}`,
          date: dateKey(dueDate),
          day: dueDate.getDate(),
          type: 'card_payment',
          label: `Pago ${card.name}`,
          amount: -card.current_balance,
          currency: card.currency,
          status: dueDate < today ? 'done' : 'pending',
          source: card.bank,
          color: card.color,
        })
      }

      return events
    })
}

export function buildCashFlow(
  accounts: Account[],
  incomeSources: IncomeSource[],
  expenses: Expense[],
  recurringExpenses: RecurringExpense[],
  cards: CreditCard[],
  baseDate: Date = new Date()
): { summaries: CashFlowCurrencySummary[]; events: CashFlowEvent[]; pointsByCurrency: Record<string, CashFlowPoint[]> } {
  const today = startOfToday(baseDate)
  const monthExpenses = getCurrentMonthExpenses(expenses, baseDate)
  const incomeEvents = incomeSources.flatMap(income => getIncomeOccurrencesForMonth(income, baseDate))
  const recurringEvents = recurringExpenses.flatMap(rec => getRecurringOccurrencesForMonth(rec, baseDate))
  const expenseEvents: CashFlowEvent[] = monthExpenses.map(exp => ({
    id: `expense-${exp.id}`,
    date: exp.date,
    day: parseISO(exp.date).getDate(),
    type: 'expense',
    label: exp.name,
    amount: -exp.amount,
    currency: exp.currency,
    status: 'done',
    source: exp.category?.name || exp.payment_method,
    color: exp.category?.color || 'var(--accent-rose)',
  }))
  const cardEvents = getMonthCardPaymentEvents(cards, baseDate)

  const events = [...incomeEvents, ...expenseEvents, ...recurringEvents, ...cardEvents]
    .sort((a, b) => a.date.localeCompare(b.date) || eventWeight(a.type) - eventWeight(b.type))

  const currencies = new Set<Currency>()
  accounts.forEach(a => currencies.add(a.currency))
  incomeSources.forEach(i => currencies.add(i.currency))
  monthExpenses.forEach(e => currencies.add(e.currency))
  recurringExpenses.forEach(r => currencies.add(r.currency))
  cards.forEach(c => currencies.add(c.currency))

  const summaries = Array.from(currencies).sort().map(currency => {
    const saldoActual = accounts
      .filter(a => a.is_active && a.currency === currency)
      .reduce((sum, a) => sum + a.current_balance, 0)
    const ingresos = incomeEvents.filter(e => e.currency === currency)
    const recurrentes = recurringEvents.filter(e => e.currency === currency)
    const gastos = monthExpenses.filter(e => e.currency === currency)
    const pagosTarjeta = cardEvents.filter(e => e.currency === currency && e.type === 'card_payment')

    const ingresosTotalesMes = ingresos.reduce((sum, e) => sum + Math.max(e.amount, 0), 0)
    const ingresosPendientesMes = ingresos
      .filter(e => parseISO(e.date) >= today)
      .reduce((sum, e) => sum + Math.max(e.amount, 0), 0)
    const gastosRegistradosMes = gastos.reduce((sum, e) => sum + e.amount, 0)
    const gastosRecurrentesEstimadosMes = recurrentes.reduce((sum, e) => sum + Math.abs(e.amount), 0)
    const gastosRecurrentesPendientes = recurrentes
      .filter(e => parseISO(e.date) >= today && !isRecurringAlreadyRegistered(e, monthExpenses))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0)
    const pagosTarjetaPendientes = pagosTarjeta
      .filter(e => parseISO(e.date) >= today)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0)
    const saldoEstimadoCierre = saldoActual + ingresosPendientesMes - gastosRecurrentesPendientes - pagosTarjetaPendientes
    const resultadoMes = ingresosTotalesMes - gastosRegistradosMes - gastosRecurrentesEstimadosMes - pagosTarjetaPendientes

    return {
      currency,
      saldoActual,
      ingresosPendientesMes,
      ingresosTotalesMes,
      gastosRegistradosMes,
      gastosRecurrentesEstimadosMes,
      gastosRecurrentesPendientes,
      pagosTarjetaPendientes,
      saldoEstimadoCierre,
      resultadoMes,
      acumuladoLibre: saldoEstimadoCierre,
    }
  })

  return {
    summaries,
    events,
    pointsByCurrency: Object.fromEntries(Array.from(currencies).map(currency => [
      currency,
      buildCashFlowPoints(currency, accounts, events, baseDate),
    ])),
  }
}

function eventWeight(type: CashFlowEvent['type']): number {
  return { income: 1, expense: 2, recurring: 3, card_payment: 4, card_close: 5 }[type]
}

function isRecurringAlreadyRegistered(event: CashFlowEvent, expenses: Expense[]): boolean {
  return expenses.some(exp =>
    exp.recurring_expense_id &&
    exp.name.trim().toLowerCase() === event.label.trim().toLowerCase() &&
    exp.date.slice(0, 7) === event.date.slice(0, 7)
  )
}

function buildCashFlowPoints(currency: Currency, accounts: Account[], events: CashFlowEvent[], baseDate: Date): CashFlowPoint[] {
  const daysInMonth = getDaysInMonth(baseDate)
  let balance = accounts
    .filter(a => a.is_active && a.currency === currency)
    .reduce((sum, a) => sum + a.current_balance, 0)

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    const dayEvents = events.filter(e => e.currency === currency && e.day === day && e.type !== 'card_close')
    const income = dayEvents.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0)
    const expenses = dayEvents.filter(e => e.type === 'expense').reduce((sum, e) => sum + Math.abs(e.amount), 0)
    const recurring = dayEvents.filter(e => e.type === 'recurring').reduce((sum, e) => sum + Math.abs(e.amount), 0)
    const cards = dayEvents.filter(e => e.type === 'card_payment').reduce((sum, e) => sum + Math.abs(e.amount), 0)
    balance += income - expenses - recurring - cards

    return {
      day,
      date: dateKey(monthDate(baseDate.getFullYear(), baseDate.getMonth(), day)),
      balance,
      income,
      expenses,
      recurring,
      cards,
    }
  })
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
