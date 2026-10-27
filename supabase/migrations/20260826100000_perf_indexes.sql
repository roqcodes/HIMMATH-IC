-- Performance indexes for IC Transfer sales, IC Funds vouchers, and warehouse transactions.

CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse_status_created
  ON public.ic_sales (warehouse_id, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse_completed_at
  ON public.ic_sales (warehouse_id, order_status, status_updated_at)
  WHERE order_status = 'completed';

CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_status_debit
  ON public.ic_fund_vouchers (branch_id, status, debit_account_id);

CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_status_credit
  ON public.ic_fund_vouchers (branch_id, status, credit_account_id);

CREATE INDEX IF NOT EXISTS idx_ic_warehouse_tx_reference
  ON public.ic_warehouse_transactions (reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse_created
  ON public.ic_purchases (warehouse_id, created_at DESC);
