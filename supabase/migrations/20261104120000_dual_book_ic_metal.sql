-- Dual-book IC (AED) vs metal (INR + optional AED agents). Idempotent.

CREATE TABLE IF NOT EXISTS public.ic_aed_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_aed_agents_status ON public.ic_aed_agents (status);

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS metal_payment_method VARCHAR(10),
  ADD COLUMN IF NOT EXISTS aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL;

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL;

UPDATE public.ic_purchases
SET settlement_mode = 'cash'
WHERE settlement_mode IS NULL OR settlement_mode NOT IN ('cash', 'metal');

UPDATE public.ic_sales
SET settlement_mode = 'cash'
WHERE settlement_mode IS NULL OR settlement_mode NOT IN ('cash', 'metal');

UPDATE public.ic_sales
SET metal_payment_method = 'CASH'
WHERE metal_payment_method = 'INR';

UPDATE public.ic_sales
SET metal_payment_method = 'AED'
WHERE settlement_mode = 'metal'
  AND (metal_payment_method IS NULL OR metal_payment_method NOT IN ('CASH', 'AED'));

UPDATE public.ic_purchases
SET metal_payment_method = 'AED'
WHERE settlement_mode = 'metal'
  AND (metal_payment_method IS NULL OR metal_payment_method NOT IN ('CASH', 'AED'));

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_metal_payment_method_check;
ALTER TABLE public.ic_purchases
  ADD CONSTRAINT ic_purchases_metal_payment_method_check
  CHECK (
    metal_payment_method IS NULL
    OR metal_payment_method IN ('CASH', 'AED')
  );

ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_metal_payment_method_check;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_metal_payment_method_check
  CHECK (
    metal_payment_method IS NULL
    OR metal_payment_method IN ('CASH', 'AED')
  );

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_metal_payment_shape;
ALTER TABLE public.ic_purchases
  ADD CONSTRAINT ic_purchases_metal_payment_shape
  CHECK (
    (settlement_mode = 'cash' AND metal_payment_method IS NULL AND aed_agent_id IS NULL)
    OR (
      settlement_mode = 'metal'
      AND metal_payment_method IN ('CASH', 'AED')
      AND (
        (metal_payment_method = 'CASH' AND aed_agent_id IS NULL AND aed_total IS NULL)
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL AND aed_total IS NOT NULL AND aed_total > 0)
      )
    )
  ) NOT VALID;

ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_metal_payment_shape;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_metal_payment_shape
  CHECK (
    (settlement_mode = 'cash' AND metal_payment_method IS NULL AND aed_agent_id IS NULL)
    OR (
      settlement_mode = 'metal'
      AND metal_payment_method IN ('CASH', 'AED')
      AND (
        (metal_payment_method = 'CASH' AND aed_agent_id IS NULL)
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL)
      )
    )
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_ic_purchases_metal_payment
  ON public.ic_purchases (settlement_mode, metal_payment_method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_sales_metal_payment
  ON public.ic_sales (settlement_mode, metal_payment_method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_aed_agent
  ON public.ic_purchases (aed_agent_id) WHERE aed_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_sales_aed_agent
  ON public.ic_sales (aed_agent_id) WHERE aed_agent_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inr_fund_accounts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('personal', 'income', 'profit', 'expense', 'inventory')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    opening_balance DECIMAL(28, 14) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(30),
    source_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inr_fund_accounts_branch_name
  ON public.inr_fund_accounts (branch_id, LOWER(TRIM(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_inr_fund_accounts_branch_source
  ON public.inr_fund_accounts (branch_id, source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inr_fund_voucher_counters (
    branch_id VARCHAR(50) PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    last_no INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.inr_fund_voucher_counters (branch_id, last_no)
SELECT id, 0 FROM public.branches
ON CONFLICT (branch_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inr_fund_vouchers (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    voucher_no INTEGER NOT NULL,
    voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('journal')),
    voucher_date DATE NOT NULL,
    debit_account_id VARCHAR(50) NOT NULL REFERENCES public.inr_fund_accounts(id) ON DELETE RESTRICT,
    credit_account_id VARCHAR(50) NOT NULL REFERENCES public.inr_fund_accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(28, 14) NOT NULL CHECK (amount > 0),
    notes TEXT NOT NULL DEFAULT '',
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
    voided_at TIMESTAMPTZ,
    reference_type VARCHAR(30),
    reference_id VARCHAR(50),
    CONSTRAINT inr_fund_voucher_distinct_accounts CHECK (debit_account_id <> credit_account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inr_fund_vouchers_branch_no
  ON public.inr_fund_vouchers (branch_id, voucher_no);
CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_ref
  ON public.inr_fund_vouchers (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_branch_date
  ON public.inr_fund_vouchers (branch_id, voucher_date DESC);

ALTER TABLE public.ic_fund_accounts DROP CONSTRAINT IF EXISTS ic_fund_accounts_source_type_check;
-- source_type is varchar without check; allow aed_agent via application

ALTER TABLE public.ic_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_aed_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inr_fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inr_fund_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asic_aed_agents_hq ON public.ic_aed_agents;
CREATE POLICY asic_aed_agents_hq ON public.ic_aed_agents FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS asic_inr_accounts_branch ON public.inr_fund_accounts;
CREATE POLICY asic_inr_accounts_branch ON public.inr_fund_accounts FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_inr_vouchers_branch ON public.inr_fund_vouchers;
CREATE POLICY asic_inr_vouchers_branch ON public.inr_fund_vouchers FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);
