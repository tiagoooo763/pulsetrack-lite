-- ============================================================================
-- Dashfy — Tabela de Conexões OAuth TikTok Marketing API (Multi-Usuário + RLS)
-- Projeto Supabase: xtdumjninvilhirpplkv
--
-- IMPORTANTE:
-- - Migração 100% não-destrutiva (não remove nem altera dados existentes).
-- - Armazena tokens criptografados (AES-256-GCM no backend) associados ao user_id.
-- - Suporta múltiplas contas/Business Centers e operações por usuário.
-- - Aplica RLS com princípio do menor privilégio.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tiktok_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
  label TEXT NOT NULL DEFAULT 'TikTok Business',
  access_token_enc TEXT NOT NULL,
  scope_json TEXT NOT NULL DEFAULT '[]',
  advertisers_json TEXT NOT NULL DEFAULT '[]',
  business_centers_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_error TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_connections_user_id
  ON public.tiktok_connections (user_id, created_at DESC);

-- Segurança: revoga acesso público anon e restringe acesso autenticado ao próprio user_id
REVOKE ALL ON TABLE public.tiktok_connections FROM anon;
ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tiktok_connections_select_own" ON public.tiktok_connections;
CREATE POLICY "tiktok_connections_select_own"
  ON public.tiktok_connections FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "tiktok_connections_insert_own" ON public.tiktok_connections;
CREATE POLICY "tiktok_connections_insert_own"
  ON public.tiktok_connections FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "tiktok_connections_update_own" ON public.tiktok_connections;
CREATE POLICY "tiktok_connections_update_own"
  ON public.tiktok_connections FOR UPDATE TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT)
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "tiktok_connections_delete_own" ON public.tiktok_connections;
CREATE POLICY "tiktok_connections_delete_own"
  ON public.tiktok_connections FOR DELETE TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);
