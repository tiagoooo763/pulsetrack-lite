-- ============================================================================
-- Dashfy — Expansão da Biblioteca de Sons de Dinheiro e Vendas (Não-Destrutivo)
-- Projeto Supabase: xtdumjninvilhirpplkv
-- ============================================================================

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  IF to_regclass('public.user_sound_preferences') IS NOT NULL THEN
    -- Remove qualquer CHECK constraint antiga na coluna selected_sound
    FOR constraint_name IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'user_sound_preferences'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%selected_sound%'
    LOOP
      EXECUTE format('ALTER TABLE public.user_sound_preferences DROP CONSTRAINT IF EXISTS %I', constraint_name);
    END LOOP;

    -- Recria a CHECK constraint incluindo todos os novos sons de dinheiro/vendas
    ALTER TABLE public.user_sound_preferences
      ADD CONSTRAINT user_sound_preferences_selected_sound_check
      CHECK (
        selected_sound IN (
          'cash_register',
          'kaching_pro',
          'coins',
          'pix_money',
          'gold_drop',
          'bill_count',
          'jackpot_sale',
          'classic_bell',
          'soft_notification',
          'custom',
          'silent'
        )
      );
  END IF;
END
$$;
