-- Opening balances: warehouse (metal g, IC units, AED, INR) and counterparty (AED, INR).

ALTER TABLE public.ic_warehouses
  ADD COLUMN IF NOT EXISTS opening_stock NUMERIC(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_metal_g NUMERIC(15, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_aed NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_inr NUMERIC(28, 14) NOT NULL DEFAULT 0;

ALTER TABLE public.ic_counterparties
  ADD COLUMN IF NOT EXISTS opening_aed NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_inr NUMERIC(28, 14) NOT NULL DEFAULT 0;

UPDATE public.ic_counterparties cp
SET opening_aed = a.opening_balance
FROM public.ic_fund_accounts a
WHERE a.source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer')
  AND a.source_id = cp.id::text
  AND COALESCE(cp.opening_aed, 0) = 0
  AND COALESCE(a.opening_balance, 0) <> 0;

UPDATE public.ic_counterparties cp
SET opening_inr = a.opening_balance
FROM public.inr_fund_accounts a
WHERE a.source_type = 'ic_counterparty'
  AND a.source_id = cp.id::text
  AND COALESCE(cp.opening_inr, 0) = 0
  AND COALESCE(a.opening_balance, 0) <> 0;

UPDATE public.ic_warehouses w
SET opening_aed = a.opening_balance
FROM public.ic_fund_accounts a
WHERE a.source_type = 'ic_warehouse'
  AND a.source_id = w.id::text
  AND COALESCE(w.opening_aed, 0) = 0
  AND COALESCE(a.opening_balance, 0) <> 0;

UPDATE public.ic_warehouses w
SET opening_inr = a.opening_balance
FROM public.inr_fund_accounts a
WHERE a.source_type = 'ic_warehouse'
  AND a.source_id = w.id::text
  AND COALESCE(w.opening_inr, 0) = 0
  AND COALESCE(a.opening_balance, 0) <> 0;
