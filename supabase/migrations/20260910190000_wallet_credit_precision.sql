-- Full-precision wallet/ledger amounts; unapplied overpay credit (sale_id NULL).

ALTER TABLE public.ic_fund_vouchers
  ALTER COLUMN amount TYPE NUMERIC(28, 14);

ALTER TABLE public.ic_wallet_transactions
  ALTER COLUMN amount TYPE NUMERIC(28, 14);

ALTER TABLE public.ic_wallet_sale_allocations
  ALTER COLUMN allocated_foreign TYPE NUMERIC(28, 14),
  ALTER COLUMN settled_foreign TYPE NUMERIC(28, 14),
  ALTER COLUMN sale_id DROP NOT NULL,
  ALTER COLUMN sale_conversion_rate DROP NOT NULL;

ALTER TABLE public.ic_wallet_sale_allocations
  DROP CONSTRAINT IF EXISTS ic_wallet_sale_allocations_sale_conversion_rate_check;

ALTER TABLE public.ic_wallet_sale_allocations
  ADD CONSTRAINT ic_wallet_sale_allocations_sale_conversion_rate_check
  CHECK (sale_conversion_rate IS NULL OR sale_conversion_rate > 0);

CREATE INDEX IF NOT EXISTS idx_ic_wallet_sale_allocations_unapplied
  ON public.ic_wallet_sale_allocations (customer_id, collection_account_id)
  WHERE sale_id IS NULL;
