-- Cash vs Metal settlement on IC purchases and sales
ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS settlement_mode VARCHAR(20) NOT NULL DEFAULT 'cash'
    CHECK (settlement_mode IN ('cash', 'metal')),
  ADD COLUMN IF NOT EXISTS metal_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS metal_rate_inr_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS metal_rate_aed_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS inr_total NUMERIC(15, 4);

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS settlement_mode VARCHAR(20) NOT NULL DEFAULT 'cash'
    CHECK (settlement_mode IN ('cash', 'metal')),
  ADD COLUMN IF NOT EXISTS metal_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS metal_rate_inr_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS metal_rate_aed_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS inr_total NUMERIC(15, 4);

CREATE INDEX IF NOT EXISTS idx_ic_purchases_settlement_created
  ON public.ic_purchases (settlement_mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_sales_settlement_created
  ON public.ic_sales (settlement_mode, created_at DESC);
