-- ============================================================================
-- Dashfy — Sons Personalizados para Notificações de Vendas + Storage Privado
-- Projeto Supabase: xtdumjninvilhirpplkv
--
-- IMPORTANTE:
-- - Migração 100% NÃO-DESTRUTIVA (não altera nem apaga tabelas/dados existentes).
-- - Persiste preferências de som por usuário (padrão: cash_register, volume 70).
-- - Armazena fila leve de eventos de vendas confirmadas por checkout (isolada por user_id).
-- - Cria bucket privado `user-notification-sounds` no Supabase Storage com RLS por pasta `<user_id>/...`.
-- ============================================================================

-- 1. Preferências sonoras de notificação de vendas (1:1 por usuário)
CREATE TABLE IF NOT EXISTS public.user_notification_sound_preferences (
  user_id TEXT PRIMARY KEY,
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  selected_sound TEXT NOT NULL DEFAULT 'cash_register'
    CHECK (selected_sound IN ('cash_register', 'coins', 'classic_bell', 'soft_notification', 'custom', 'silent')),
  sound_volume INTEGER NOT NULL DEFAULT 70
    CHECK (sound_volume >= 0 AND sound_volume <= 100),
  custom_sound_path TEXT,
  custom_sound_name TEXT,
  custom_sound_mime TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

REVOKE ALL ON TABLE public.user_notification_sound_preferences FROM anon;
ALTER TABLE public.user_notification_sound_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sound_prefs_select_own" ON public.user_notification_sound_preferences;
CREATE POLICY "sound_prefs_select_own"
  ON public.user_notification_sound_preferences FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "sound_prefs_insert_own" ON public.user_notification_sound_preferences;
CREATE POLICY "sound_prefs_insert_own"
  ON public.user_notification_sound_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "sound_prefs_update_own" ON public.user_notification_sound_preferences;
CREATE POLICY "sound_prefs_update_own"
  ON public.user_notification_sound_preferences FOR UPDATE TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT)
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "sound_prefs_delete_own" ON public.user_notification_sound_preferences;
CREATE POLICY "sound_prefs_delete_own"
  ON public.user_notification_sound_preferences FOR DELETE TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

-- 2. Eventos reais de vendas aprovadas (somente pagamentos confirmados em gateways/checkout)
CREATE TABLE IF NOT EXISTS public.sale_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
  product_name TEXT NOT NULL,
  gross_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  net_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'PIX',
  utm_source TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sale_notifications_user_created
  ON public.sale_notifications (user_id, created_at DESC);

REVOKE ALL ON TABLE public.sale_notifications FROM anon;
ALTER TABLE public.sale_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sale_notifications_select_own" ON public.sale_notifications;
CREATE POLICY "sale_notifications_select_own"
  ON public.sale_notifications FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

DROP POLICY IF EXISTS "sale_notifications_insert_own" ON public.sale_notifications;
CREATE POLICY "sale_notifications_insert_own"
  ON public.sale_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

-- 3. Bucket privado no Supabase Storage para áudios personalizados (máx. 2 MB, MP3/WAV/OGG)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-notification-sounds',
  'user-notification-sounds',
  FALSE,
  2097152,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg'];

-- Políticas RLS no Storage: cada usuário acessa APENAS sua própria pasta `<user_id>/...`
DROP POLICY IF EXISTS "user_sounds_select_own" ON storage.objects;
CREATE POLICY "user_sounds_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-notification-sounds'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "user_sounds_insert_own" ON storage.objects;
CREATE POLICY "user_sounds_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-notification-sounds'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "user_sounds_update_own" ON storage.objects;
CREATE POLICY "user_sounds_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-notification-sounds'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  )
  WITH CHECK (
    bucket_id = 'user-notification-sounds'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "user_sounds_delete_own" ON storage.objects;
CREATE POLICY "user_sounds_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-notification-sounds'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
