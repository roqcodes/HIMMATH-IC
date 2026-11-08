-- Production hardening: money precision, voucher idempotency indexes, report query indexes

ALTER TABLE public.ic_fund_accounts
  ALTER COLUMN opening_balance TYPE NUMERIC(15, 4)
  USING ROUND(opening_balance::numeric, 4);

ALTER TABLE public.ic_warehouses
  ALTER COLUMN opening_aed TYPE NUMERIC(15, 4)
  USING ROUND(opening_aed::numeric, 4);

ALTER TABLE public.ic_counterparties
  ALTER COLUMN opening_aed TYPE NUMERIC(15, 4)
  USING ROUND(opening_aed::numeric, 4);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_active_ref
  ON public.ic_fund_vouchers (branch_id, reference_type, reference_id)
  WHERE status IN ('active', 'pending')
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inr_fund_vouchers_active_ref
  ON public.inr_fund_vouchers (branch_id, reference_type, reference_id)
  WHERE status = 'active'
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_branch_status_debit
  ON public.inr_fund_vouchers (branch_id, status, debit_account_id);

CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_branch_status_credit
  ON public.inr_fund_vouchers (branch_id, status, credit_account_id);

CREATE INDEX IF NOT EXISTS idx_ic_capital_alloc_branch_investor
  ON public.ic_capital_allocations (branch_id, investor_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ic_purchases_wh_metal_created
  ON public.ic_purchases (warehouse_id, created_at DESC)
  WHERE settlement_mode = 'metal';
