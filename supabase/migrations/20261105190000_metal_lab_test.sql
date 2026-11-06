-- Lab test fee (INR) on metal purchases and sales — optional per deal.

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS lab_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_charge_inr_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_total_inr NUMERIC(15, 4);

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS lab_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_charge_inr_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_total_inr NUMERIC(15, 4);
