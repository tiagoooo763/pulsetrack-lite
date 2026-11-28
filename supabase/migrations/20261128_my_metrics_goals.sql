-- ============================================================================
-- Dashfy — Minhas Métricas: Metas, Visualizações, Modelos e Alertas Inteligentes
-- Projeto Supabase: xtdumjninvilhirpplkv
-- Migração 100% não-destrutiva e idempotente.
-- ============================================================================

-- 1. Configurações de métricas, metas, visualizações e alertas por usuário/operação/campanha
-- campaign_key = '__DEFAULT__' representa a meta padrão do usuário/operação
CREATE TABLE IF NOT EXISTS public.campaign_metric_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
  ad_account TEXT NOT NULL DEFAULT '',
  campaign_key TEXT NOT NULL,
  campaign_name TEXT NOT NULL DEFAULT 'Padrão da Operação',
  view_name TEXT NOT NULL DEFAULT 'Padrão',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  objective TEXT NOT NULL DEFAULT 'conversion'
    CHECK (objective IN ('conversion', 'traffic', 'awareness', 'financial', 'creatives')),
  period_preset TEXT NOT NULL DEFAULT '30d',
  selected_metrics_json TEXT NOT NULL DEFAULT '[]',
  goals_json TEXT NOT NULL DEFAULT '{}',
  alert_settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dashboard_id, campaign_key, view_name)
);

-- 2. Modelos personalizados salvos pelo usuário (além dos 5 modelos prontos da Dashfy)
CREATE TABLE IF NOT EXISTS public.metric_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  objective TEXT NOT NULL DEFAULT 'conversion'
    CHECK (objective IN ('conversion', 'traffic', 'awareness', 'financial', 'creatives')),
  selected_metrics_json TEXT NOT NULL DEFAULT '[]',
  goals_json TEXT NOT NULL DEFAULT '{}',
  alert_settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Registro de alertas inteligentes disparados (com controle de cooldown e prevenção de duplicidade)
CREATE TABLE IF NOT EXISTS public.metric_alert_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
  campaign_key TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Índices de desempenho
CREATE INDEX IF NOT EXISTS idx_campaign_metric_configs_user_dash
  ON public.campaign_metric_configs (user_id, dashboard_id, campaign_key);

CREATE INDEX IF NOT EXISTS idx_metric_templates_user
  ON public.metric_templates (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_metric_alert_logs_user_dedupe
  ON public.metric_alert_logs (user_id, dedupe_key, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_metric_alert_logs_user_dash
  ON public.metric_alert_logs (user_id, dashboard_id, triggered_at DESC);

-- 5. Row Level Security (RLS) — isolamento estrito por usuário autenticado
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'campaign_metric_configs',
    'metric_templates',
    'metric_alert_logs'
  ]
  LOOP
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
  END LOOP;
END
$$;
