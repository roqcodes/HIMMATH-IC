-- List queries: branch + created_at ordering (journal voucher lists)
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_created
  ON public.ic_fund_vouchers (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_user_created
  ON public.ic_fund_vouchers (branch_id, created_by_user_id, created_at DESC)
  WHERE created_by_user_id IS NOT NULL;
