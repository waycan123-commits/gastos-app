-- ============================================================
-- GASTOS APP - Income sources migration
-- Safe to run multiple times in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(5) NOT NULL DEFAULT 'PEN',
  frequency VARCHAR(20) NOT NULL DEFAULT 'mensual'
    CHECK (frequency IN ('mensual','quincenal','semanal','único','unico')),
  day_of_month SMALLINT NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 31),
  destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS name VARCHAR(160);
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS currency VARCHAR(5) DEFAULT 'PEN';
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS frequency VARCHAR(20) DEFAULT 'mensual';
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS day_of_month SMALLINT DEFAULT 1;
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.income_sources
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_income_sources_user_active
  ON public.income_sources(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_income_sources_user_day
  ON public.income_sources(user_id, day_of_month);

ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_sources: select own" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources: insert own" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources: update own" ON public.income_sources;
DROP POLICY IF EXISTS "income_sources: delete own" ON public.income_sources;

CREATE POLICY "income_sources: select own" ON public.income_sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "income_sources: insert own" ON public.income_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "income_sources: update own" ON public.income_sources
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "income_sources: delete own" ON public.income_sources
  FOR DELETE USING (auth.uid() = user_id);

-- Optional normalization for earlier drafts that used "unico".
UPDATE public.income_sources
SET frequency = 'único'
WHERE frequency = 'unico';
