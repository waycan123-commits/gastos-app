export type Currency = 'PEN' | 'USD' | 'EUR' | 'COP' | 'MXN' | 'ARS' | 'CLP'
export type PaymentMethod = 'efectivo' | 'débito' | 'crédito' | 'transferencia' | 'otro'

export interface Profile {
  id: string
  user_id: string
  monthly_income: number
  currency: Currency
  financial_day_start: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  is_default: boolean
  created_at: string
}

export interface CategoryBudget {
  id: string
  user_id: string
  category_id: string
  month: string // YYYY-MM
  budget_amount: number
  created_at: string
}

export interface Expense {
  id: string
  user_id: string
  category_id: string
  name: string
  amount: number
  currency: Currency
  date: string
  payment_method: PaymentMethod
  note?: string
  created_at: string
  category?: Category
}

export interface StatementImport {
  id: string
  user_id: string
  raw_text: string
  transactions_count: number
  imported_at: string
}

export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red' | 'critical'

export interface DashboardMetrics {
  totalSpent: number
  remaining: number
  percentageSpent: number
  dailyAverage: number
  recommendedDaily: number
  topCategory: string
  monthlyProjection: number
  alertLevel: AlertLevel
  daysRemaining: number
  currentDay: number
  totalDays: number
}
