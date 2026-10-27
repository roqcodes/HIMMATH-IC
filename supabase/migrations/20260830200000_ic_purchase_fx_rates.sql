-- Per-purchase FX snapshots (not inferred from warehouse / a single rate group).
CREATE TABLE IF NOT EXISTS public.ic_purchase_fx_rates (
  purchase_id UUID NOT NULL REFERENCES public.ic_purchases(id) ON DELETE CASCADE,
  currency VARCHAR(10) NOT NULL,
  conversion_rate NUMERIC(28, 14) NOT NULL CHECK (conversion_rate > 0),
  PRIMARY KEY (purchase_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_ic_purchase_fx_rates_currency
  ON public.ic_purchase_fx_rates (currency);

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(28, 14);

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10);
