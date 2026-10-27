-- Assign collection agent on sale; group batch settlements.

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS collection_account_id VARCHAR(50)
    REFERENCES public.ic_fund_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ic_sales_collection_account
  ON public.ic_sales (collection_account_id)
  WHERE collection_account_id IS NOT NULL;

ALTER TABLE public.ic_sale_fx_settlements
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_ic_sale_fx_settlements_batch
  ON public.ic_sale_fx_settlements (batch_id)
  WHERE batch_id IS NOT NULL;
