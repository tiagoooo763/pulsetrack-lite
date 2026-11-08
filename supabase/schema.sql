-- ==============================================================================
-- PulseTrack Lite - Schema PostgreSQL Oficial para o Supabase
-- ==============================================================================

-- 1. Transações de Vendas (Recebimento de Pagamentos da OmegaPay)
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    client_identifier TEXT,
    order_id TEXT,
    product_id TEXT,
    product_name TEXT NOT NULL DEFAULT 'Produto OmegaPay',
    offer_code TEXT,
    payment_method TEXT NOT NULL DEFAULT 'PIX',
    currency TEXT NOT NULL DEFAULT 'BRL',
    gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL,
    last_event TEXT NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_paid_at ON public.transactions(paid_at DESC);

-- 2. Transferências e Saques da OmegaPay
CREATE TABLE IF NOT EXISTS public.transfers (
    id TEXT PRIMARY KEY,
    client_identifier TEXT,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    received_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    fee_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BRL',
    status TEXT NOT NULL,
    last_event TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON public.transfers(created_at DESC);

-- 3. Registro Auditável e Idempotência de Webhooks da OmegaPay
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id TEXT PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    status_after TEXT,
    sanitized_payload TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_dedupe ON public.webhook_events(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_webhook_received_at ON public.webhook_events(received_at DESC);

-- 4. Despesas Manuais (Meta Ads, TikTok Ads, Google Ads, Ferramentas, Outros)
CREATE TABLE IF NOT EXISTS public.manual_expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    expense_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.manual_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.manual_expenses(category);

-- 5. Saldo Oficial Informado pela OmegaPay (Disponível, Pendente, Retido)
CREATE TABLE IF NOT EXISTS public.balance_snapshots (
    id INTEGER PRIMARY KEY DEFAULT 1,
    available NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    pending NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    fund_lock NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Configurações Dinâmicas e Credenciais no Servidor
CREATE TABLE IF NOT EXISTS public.server_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserção das credenciais padrão solicitadas
INSERT INTO public.server_settings (key, value, updated_at)
VALUES 
    ('DASHBOARD_USER', 'mendoncat831@gmail.com', NOW()),
    ('DASHBOARD_PASSWORD', '@Tiago2507', NOW())
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;
