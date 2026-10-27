-- Collection agent portal login + FX settlement payment requests
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS collection_account_id VARCHAR(50) REFERENCES public.ic_fund_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_collection_account
  ON public.profiles (collection_account_id)
  WHERE collection_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ic_fx_settlement_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_account_id VARCHAR(50) NOT NULL REFERENCES public.ic_fund_accounts(id) ON DELETE RESTRICT,
    paid_foreign NUMERIC(15, 4) NOT NULL CHECK (paid_foreign > 0),
    currency VARCHAR(10) NOT NULL,
    settlement_rate NUMERIC(28, 14),
    settled_aed NUMERIC(28, 14),
    to_account_id VARCHAR(50) REFERENCES public.ic_fund_accounts(id) ON DELETE SET NULL,
    batch_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    agent_notes TEXT,
    notes TEXT,
    entered_by VARCHAR(255),
    entered_by_name VARCHAR(255),
    reviewed_by VARCHAR(255),
    reviewed_by_name VARCHAR(255),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ic_fx_settlement_requests_status
  ON public.ic_fx_settlement_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_fx_settlement_requests_agent
  ON public.ic_fx_settlement_requests (collection_account_id, created_at DESC);

ALTER TABLE public.ic_fx_settlement_requests ENABLE ROW LEVEL SECURITY;
