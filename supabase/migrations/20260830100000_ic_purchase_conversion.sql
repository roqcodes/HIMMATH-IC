-- Persist purchase FX so type 2 profit can replay remaining-stock conversion WAC.
ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(28, 14);

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10);

UPDATE public.ic_purchases
SET conversion_rate = converted_total / NULLIF(aed_total, 0)
WHERE conversion_rate IS NULL
  AND converted_total IS NOT NULL
  AND aed_total IS NOT NULL
  AND aed_total <> 0;
