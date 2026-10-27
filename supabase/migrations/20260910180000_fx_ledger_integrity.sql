-- FX/wallet integrity: one pending remittance per agent, full-rate allocations, hot-path indexes.

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fx_settlement_requests_one_pending
  ON public.ic_fx_settlement_requests (collection_account_id)
  WHERE status = 'pending';

ALTER TABLE public.ic_wallet_sale_allocations
  ALTER COLUMN sale_conversion_rate TYPE NUMERIC(28, 14);

CREATE INDEX IF NOT EXISTS idx_ic_sales_customer_completed_fx
  ON public.ic_sales (order_customer_id, created_at)
  WHERE order_status = 'completed' AND COALESCE(converted_amount, 0) > 0;

CREATE INDEX IF NOT EXISTS idx_ic_sale_fx_settlements_wallet_alloc
  ON public.ic_sale_fx_settlements (wallet_allocation_id)
  WHERE wallet_allocation_id IS NOT NULL;
