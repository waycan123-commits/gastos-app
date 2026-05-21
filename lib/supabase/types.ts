export type Currency = 'PEN' | 'USD' | 'EUR' | 'COP' | 'MXN' | 'ARS' | 'CLP'
export type PaymentMethod = 'efectivo' | 'débito' | 'crédito' | 'transferencia' | 'otro'
export type PaymentSourceType = 'account' | 'credit_card' | 'none'
export type AccountType = 'débito' | 'efectivo' | 'ahorro' | 'billetera_digital' | 'otra'
export type RecurringFrequency = 'semanal' | 'quincenal' | 'mensual' | 'anual'
export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red' | 'critical'

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
  month: string
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
  account_id?: string | null
  credit_card_id?: string | null
  recurring_expense_id?: string | null
  payment_source_type?: PaymentSourceType
  created_at: string
  category?: Category
  account?: Account
  credit_card?: CreditCard
}

export interface CreditCard {
  id: string
  user_id: string
  name: string
  bank: string
  currency: Currency
  credit_limit?: number | null
  current_balance: number
  billing_close_day: number
  payment_due_day: number
  is_active: boolean
  color: string
  note?: string | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  bank?: string | null
  currency: Currency
  current_balance: number
  is_active: boolean
  note?: string | null
  created_at: string
  updated_at: string
}

export interface RecurringExpense {
  id: string
  user_id: string
  name: string
  category_id: string
  amount: number
  currency: Currency
  frequency: RecurringFrequency
  charge_day: number
  payment_method: PaymentMethod
  account_id?: string | null
  credit_card_id?: string | null
  start_date: string
  end_date?: string | null
  is_active: boolean
  note?: string | null
  created_at: string
  updated_at: string
  category?: Category
  account?: Account
  credit_card?: CreditCard
}

export interface StatementImport {
  id: string
  user_id: string
  raw_text: string
  transactions_count: number
  imported_at: string
}

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
  creditCardSpentMonth: number
  accountsBalance: number
  recurringEstimatedMonth: number
  savingsEstimated: number
  recurringPercentOfIncome: number
}
