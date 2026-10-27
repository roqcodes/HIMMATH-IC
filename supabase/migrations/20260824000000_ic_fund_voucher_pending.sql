-- Idempotent IC Funds schema + pending voucher status for ghost sale journals.

CREATE TABLE IF NOT EXISTS public.ic_fund_accounts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'd_expense')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_name
    ON public.ic_fund_accounts (branch_id, LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_type
    ON public.ic_fund_accounts (branch_id, account_type, status);

ALTER TABLE public.ic_fund_accounts ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) REFERENCES public.customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ic_fund_accounts_customer_id ON public.ic_fund_accounts(customer_id);
ALTER TABLE public.ic_fund_accounts ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE public.ic_fund_accounts ADD COLUMN IF NOT EXISTS source_type VARCHAR(30);
ALTER TABLE public.ic_fund_accounts ADD COLUMN IF NOT EXISTS source_id VARCHAR(50);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_source
    ON public.ic_fund_accounts (branch_id, source_type, source_id)
    WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ic_fund_voucher_counters (
    branch_id VARCHAR(50) PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    last_no INTEGER NOT NULL DEFAULT 0
);

INSERT INTO public.branches (
    id, slug, name, location, manager_name, status, timezone, hidden_pages, features
) VALUES (
    'branch_hq', 'hq', 'HQ', 'Head office', 'HQ Admin', 'active', 'Asia/Dubai', '{}',
    '{"warehousePortal":false,"customerPortal":false,"isHqLedger":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ic_fund_voucher_counters (branch_id, last_no)
VALUES ('branch_hq', 0)
ON CONFLICT (branch_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ic_fund_vouchers (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    voucher_no INTEGER NOT NULL,
    voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('payment', 'receipt', 'journal', 'contra')),
    voucher_date DATE NOT NULL,
    debit_account_id VARCHAR(50) NOT NULL REFERENCES public.ic_fund_accounts(id) ON DELETE RESTRICT,
    credit_account_id VARCHAR(50) NOT NULL REFERENCES public.ic_fund_accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    notes TEXT NOT NULL DEFAULT '',
    created_by VARCHAR(255),
    created_by_name VARCHAR(255),
    created_by_user_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    voided_at TIMESTAMPTZ,
    voided_by_name VARCHAR(255),
    reference_type VARCHAR(30),
    reference_id VARCHAR(50),
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(80),
    CONSTRAINT ic_fund_voucher_distinct_accounts CHECK (debit_account_id <> credit_account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_no
    ON public.ic_fund_vouchers (branch_id, voucher_no);
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_date
    ON public.ic_fund_vouchers (branch_id, voucher_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_idempotency
    ON public.ic_fund_vouchers (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_reference
    ON public.ic_fund_vouchers (branch_id, reference_type, reference_id)
    WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_status_date
    ON public.ic_fund_vouchers (branch_id, status, voucher_date DESC);

ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS voided_by_name VARCHAR(255);
ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS reference_type VARCHAR(30);
ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS reference_id VARCHAR(50);
ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.ic_fund_vouchers ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

ALTER TABLE public.ic_fund_vouchers DROP CONSTRAINT IF EXISTS ic_fund_vouchers_status_check;
ALTER TABLE public.ic_fund_vouchers
    ADD CONSTRAINT ic_fund_vouchers_status_check
    CHECK (status IN ('active', 'pending', 'void'));
