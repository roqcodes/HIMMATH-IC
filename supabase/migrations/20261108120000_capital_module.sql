-- Capital module: investors, lots, allocations; capital account type on both books.

ALTER TABLE public.ic_fund_accounts DROP CONSTRAINT IF EXISTS ic_fund_accounts_account_type_check;
ALTER TABLE public.ic_fund_accounts
  ADD CONSTRAINT ic_fund_accounts_account_type_check
  CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'd_expense', 'capital'));

ALTER TABLE public.inr_fund_accounts DROP CONSTRAINT IF EXISTS inr_fund_accounts_account_type_check;
ALTER TABLE public.inr_fund_accounts
  ADD CONSTRAINT inr_fund_accounts_account_type_check
  CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'inventory', 'd_expense', 'capital'));

CREATE TABLE IF NOT EXISTS public.ic_capital_settings (
    id VARCHAR(20) PRIMARY KEY DEFAULT 'hq',
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE DEFAULT 'branch_hq',
    opening_aed DECIMAL(28, 14) NOT NULL DEFAULT 0,
    opening_inr DECIMAL(28, 14) NOT NULL DEFAULT 0,
    opening_inr_per_aed DECIMAL(28, 14) NOT NULL DEFAULT 0,
    management_share_bps INTEGER NOT NULL DEFAULT 0 CHECK (management_share_bps >= 0 AND management_share_bps <= 10000),
    management_investor_id VARCHAR(50),
    opening_locked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.ic_capital_settings (id, branch_id)
VALUES ('hq', 'branch_hq')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ic_capital_investors (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE DEFAULT 'branch_hq',
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_house BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_capital_investors_house
  ON public.ic_capital_investors (branch_id)
  WHERE is_house = true;

CREATE TABLE IF NOT EXISTS public.ic_capital_lots (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    investor_id VARCHAR(50) NOT NULL REFERENCES public.ic_capital_investors(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('opening', 'deposit', 'withdraw', 'payout')),
    book VARCHAR(3) NOT NULL CHECK (book IN ('AED', 'INR')),
    lot_date DATE NOT NULL,
    amount_native DECIMAL(28, 14) NOT NULL,
    inr_per_aed DECIMAL(28, 14) NOT NULL DEFAULT 1 CHECK (inr_per_aed > 0),
    aed_eq DECIMAL(28, 14) NOT NULL,
    bank_account_id VARCHAR(50),
    voucher_id VARCHAR(50) NOT NULL,
    voucher_book VARCHAR(3) NOT NULL CHECK (voucher_book IN ('AED', 'INR')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void'))
);

CREATE INDEX IF NOT EXISTS idx_ic_capital_lots_branch_date
  ON public.ic_capital_lots (branch_id, lot_date, created_at);
CREATE INDEX IF NOT EXISTS idx_ic_capital_lots_investor
  ON public.ic_capital_lots (investor_id, status);

CREATE TABLE IF NOT EXISTS public.ic_capital_allocations (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    source_voucher_id VARCHAR(50) NOT NULL,
    source_book VARCHAR(3) NOT NULL CHECK (source_book IN ('AED', 'INR')),
    source_voucher_date DATE NOT NULL,
    investor_id VARCHAR(50) NOT NULL REFERENCES public.ic_capital_investors(id) ON DELETE RESTRICT,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('profit', 'expense', 'management', 'payout')),
    event_amount DECIMAL(28, 14) NOT NULL,
    allocated_amount DECIMAL(28, 14) NOT NULL,
    book VARCHAR(3) NOT NULL CHECK (book IN ('AED', 'INR')),
    management_bps_snapshot INTEGER NOT NULL DEFAULT 0,
    capital_share_bps_snapshot INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_capital_alloc_voucher_investor
  ON public.ic_capital_allocations (source_voucher_id, source_book, investor_id, kind)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ic_capital_alloc_voucher
  ON public.ic_capital_allocations (source_voucher_id, source_book);

ALTER TABLE public.ic_capital_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asic_capital_settings ON public.ic_capital_settings;
CREATE POLICY asic_capital_settings ON public.ic_capital_settings FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS asic_capital_investors ON public.ic_capital_investors;
CREATE POLICY asic_capital_investors ON public.ic_capital_investors FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS asic_capital_lots ON public.ic_capital_lots;
CREATE POLICY asic_capital_lots ON public.ic_capital_lots FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS asic_capital_allocations ON public.ic_capital_allocations;
CREATE POLICY asic_capital_allocations ON public.ic_capital_allocations FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));
