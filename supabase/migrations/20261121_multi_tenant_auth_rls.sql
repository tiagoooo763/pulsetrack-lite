-- ============================================================================
-- Dashfy — Migração Não-Destrutiva Multi-Usuário + Supabase Auth + RLS
-- Projeto Supabase: xtdumjninvilhirpplkv
-- ============================================================================

-- 1. Tabela de Perfis (1:1 com auth.users, criação automática sem duplicatas)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT 'Dashfy Workspace',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT 'Dashfy Workspace';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (LOWER(email))
  WHERE email <> '';

-- Função & Trigger idempotente para criar perfil automaticamente ao cadastrar no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_company_name TEXT;
BEGIN
  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'), ''),
    SPLIT_PART(COALESCE(NEW.email, ''), '@', 1)
  );

  v_company_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'company_name'), ''),
    'Dashfy Workspace'
  );

  INSERT INTO public.profiles (id, email, display_name, company_name, created_at, updated_at)
  VALUES (NEW.id, LOWER(COALESCE(NEW.email, '')), v_display_name, v_company_name, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Configurações e Credenciais Isoladas por Usuário
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, key)
);

-- 3. Saldos Isolados por Usuário e Gateway
CREATE TABLE IF NOT EXISTS public.user_balance_snapshots (
  user_id TEXT NOT NULL,
  gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
  available DOUBLE PRECISION NOT NULL DEFAULT 0,
  pending DOUBLE PRECISION NOT NULL DEFAULT 0,
  fund_lock DOUBLE PRECISION NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, gateway)
);

-- 4. Adição NÃO-DESTRUTIVA de user_id às tabelas existentes
ALTER TABLE IF EXISTS public.transactions
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.transfers
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.manual_expenses
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.tiktok_campaigns
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.custom_fees
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.automation_rules
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.webhook_events
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

ALTER TABLE IF EXISTS public.balance_snapshots
  ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'legacy:mendoncat831@gmail.com';

-- 5. Índices de performance (apenas nas tabelas existentes)
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id, created_at DESC)';
  END IF;
  IF to_regclass('public.transfers') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers (user_id, created_at DESC)';
  END IF;
  IF to_regclass('public.manual_expenses') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_manual_expenses_user_id ON public.manual_expenses (user_id, expense_date DESC)';
  END IF;
  IF to_regclass('public.tiktok_campaigns') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tiktok_campaigns_user_id ON public.tiktok_campaigns (user_id, stat_date DESC)';
  END IF;
  IF to_regclass('public.custom_fees') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_custom_fees_user_id ON public.custom_fees (user_id, fee_date DESC)';
  END IF;
  IF to_regclass('public.automation_rules') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON public.automation_rules (user_id)';
  END IF;
  IF to_regclass('public.webhook_events') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON public.webhook_events (user_id, received_at DESC)';
  END IF;
  CREATE INDEX IF NOT EXISTS idx_user_settings_key ON public.user_settings (key);
END
$$;

-- 6. ROW LEVEL SECURITY (RLS) — PRINCÍPIO DO MENOR PRIVILÉGIO
REVOKE ALL ON TABLE public.profiles FROM anon;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = id::TEXT);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::TEXT = id::TEXT);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid()::TEXT = id::TEXT)
  WITH CHECK (auth.uid()::TEXT = id::TEXT);

DO $$
BEGIN
  IF to_regclass('public.server_settings') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.server_settings FROM anon';
    EXECUTE 'ALTER TABLE public.server_settings ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "server_settings_deny_all" ON public.server_settings';
    EXECUTE 'CREATE POLICY "server_settings_deny_all" ON public.server_settings FOR ALL TO authenticated USING (false) WITH CHECK (false)';
  END IF;
END
$$;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_settings',
    'user_balance_snapshots',
    'transactions',
    'transfers',
    'manual_expenses',
    'tiktok_campaigns',
    'custom_fees',
    'automation_rules',
    'webhook_events',
    'balance_snapshots'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_select_own', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid()::TEXT = user_id::TEXT)',
        tbl || '_select_own', tbl
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_insert_own', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid()::TEXT = user_id::TEXT)',
        tbl || '_insert_own', tbl
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_update_own', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid()::TEXT = user_id::TEXT) WITH CHECK (auth.uid()::TEXT = user_id::TEXT)',
        tbl || '_update_own', tbl
      );

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_delete_own', tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid()::TEXT = user_id::TEXT)',
        tbl || '_delete_own', tbl
      );
    END IF;
  END LOOP;
END
$$;
