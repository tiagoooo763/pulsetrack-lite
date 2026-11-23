-- ============================================================================
-- Dashfy — Índices Compostos de Performance (100% Não-Destrutivo)
-- Projeto Supabase: xtdumjninvilhirpplkv
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_transactions_user_gateway_created ON public.transactions (user_id, gateway, created_at DESC)';
  END IF;
  IF to_regclass('public.tiktok_campaigns') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tiktok_campaigns_user_dash_date ON public.tiktok_campaigns (user_id, dashboard_id, stat_date DESC)';
  END IF;
  IF to_regclass('public.manual_expenses') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_manual_expenses_user_dash_date ON public.manual_expenses (user_id, dashboard_id, expense_date DESC)';
  END IF;
  IF to_regclass('public.custom_fees') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_custom_fees_user_dash_date ON public.custom_fees (user_id, dashboard_id, fee_date DESC)';
  END IF;
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON public.user_settings (user_id, key)';
  END IF;
  IF to_regclass('public.sale_notifications') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_sale_notifications_user_created ON public.sale_notifications (user_id, created_at DESC)';
  END IF;
END
$$;
