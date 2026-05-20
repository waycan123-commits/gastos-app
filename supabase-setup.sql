-- ============================================================
-- GASTOS APP — SQL completo para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. TABLA: profiles
-- Almacena el perfil financiero del usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(5) NOT NULL DEFAULT 'PEN',
  financial_day_start SMALLINT NOT NULL DEFAULT 1 CHECK (financial_day_start BETWEEN 1 AND 28),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- 2. TABLA: categories
-- Categorías de gastos por usuario
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) DEFAULT '📦',
  color VARCHAR(20) DEFAULT '#6b7280',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. TABLA: expenses
-- Registro de gastos del usuario
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(5) NOT NULL DEFAULT 'PEN',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30) NOT NULL DEFAULT 'efectivo'
    CHECK (payment_method IN ('efectivo','débito','crédito','transferencia','otro')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. TABLA: category_budgets
-- Presupuesto mensual opcional por categoría
CREATE TABLE IF NOT EXISTS public.category_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL, -- formato: YYYY-MM
  budget_amount NUMERIC(12, 2) NOT NULL CHECK (budget_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, category_id, month)
);

-- 5. TABLA: statement_imports
-- Log de importaciones desde estados de cuenta
CREATE TABLE IF NOT EXISTS public.statement_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text TEXT,
  transactions_count INTEGER DEFAULT 0,
  imported_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================================
-- ÍNDICES para mejorar rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON public.category_budgets(user_id, month);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada usuario solo puede ver y modificar sus propios datos
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles: insert own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles: delete own" ON public.profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para categories
CREATE POLICY "categories: select own" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories: insert own" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: update own" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories: delete own" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para expenses
CREATE POLICY "expenses: select own" ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses: insert own" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses: update own" ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "expenses: delete own" ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para category_budgets
CREATE POLICY "budgets: select own" ON public.category_budgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets: insert own" ON public.category_budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets: update own" ON public.category_budgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budgets: delete own" ON public.category_budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para statement_imports
CREATE POLICY "imports: select own" ON public.statement_imports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "imports: insert own" ON public.statement_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "imports: delete own" ON public.statement_imports
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- FIN DEL SQL
-- ============================================================
