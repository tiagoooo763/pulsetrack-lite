-- ============================================================================
-- Dashfy — Infraestrutura de Integração Multi-Tenant: ElevyPay (e Gateways)
-- Projeto Supabase: xtdumjninvilhirpplkv
-- Migração 100% não-destrutiva e idempotente.
-- ============================================================================

-- 1. Tabela de integrações de gateway isoladas por usuário (com credenciais criptografadas AES-256-GCM)
CREATE TABLE IF NOT EXISTS public.gateway_integrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gateway TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISCONNECTED'
    CHECK (status IN ('DISCONNECTED', 'CONNECTED', 'ERROR')),
  auth_mode TEXT NOT NULL DEFAULT 'DASHFY_TOKEN'
    CHECK (auth_mode IN ('DASHFY_TOKEN', 'GATEWAY_TOKEN', 'HMAC_SHA256')),
  webhook_url_slug TEXT NOT NULL,
  webhook_secret_enc TEXT,
  external_token_enc TEXT,
  last_event_at TIMESTAMPTZ,
  last_event_type TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, gateway),
  UNIQUE (webhook_url_slug)
);

-- 2. Histórico auditável de alterações de status das transações (inclui proteção fora de ordem)
CREATE TABLE IF NOT EXISTS public.transaction_status_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  gateway TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'webhook',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices de desempenho e roteamento rápido de webhooks
CREATE INDEX IF NOT EXISTS idx_gateway_integrations_user_gw
  ON public.gateway_integrations (user_id, gateway);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gateway_integrations_slug
  ON public.gateway_integrations (webhook_url_slug);

CREATE INDEX IF NOT EXISTS idx_tx_status_history_user_tx
  ON public.transaction_status_history (user_id, transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_gw_status
  ON public.transactions (user_id, gateway, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_user_gw_received
  ON public.webhook_events (user_id, gateway, received_at DESC);

-- 4. Row Level Security (RLS) — isolamento estrito por usuário autenticado
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'gateway_integrations',
    'transaction_status_history'
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
