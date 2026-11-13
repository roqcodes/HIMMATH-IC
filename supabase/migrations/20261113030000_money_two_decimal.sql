-- Standardize stored AED/INR amounts to 2 decimal places (commercial rounding).
-- Rates, units, and grams stay at higher precision.

-- ic_counterparties
ALTER TABLE public.ic_counterparties
  ALTER COLUMN opening_aed TYPE NUMERIC(15, 2) USING ROUND(opening_aed::numeric, 2),
  ALTER COLUMN opening_inr TYPE NUMERIC(28, 2) USING ROUND(opening_inr::numeric, 2);

-- ic_warehouses
ALTER TABLE public.ic_warehouses
  ALTER COLUMN opening_aed TYPE NUMERIC(15, 2) USING ROUND(opening_aed::numeric, 2),
  ALTER COLUMN opening_inr TYPE NUMERIC(28, 2) USING ROUND(opening_inr::numeric, 2);

-- ic_branch_deposits
ALTER TABLE public.ic_branch_deposits
  ALTER COLUMN amount_aed TYPE NUMERIC(15, 2) USING ROUND(amount_aed::numeric, 2);

-- ic_purchases
ALTER TABLE public.ic_purchases
  ALTER COLUMN aed_total TYPE NUMERIC(15, 2) USING ROUND(aed_total::numeric, 2),
  ALTER COLUMN inr_total TYPE NUMERIC(15, 2) USING ROUND(inr_total::numeric, 2),
  ALTER COLUMN split_inr_paid TYPE NUMERIC(15, 2) USING ROUND(split_inr_paid::numeric, 2),
  ALTER COLUMN split_aed_paid TYPE NUMERIC(15, 2) USING ROUND(split_aed_paid::numeric, 2),
  ALTER COLUMN lab_total_inr TYPE NUMERIC(15, 2) USING ROUND(lab_total_inr::numeric, 2);

-- ic_sales
ALTER TABLE public.ic_sales
  ALTER COLUMN aed_amount TYPE NUMERIC(15, 2) USING ROUND(aed_amount::numeric, 2),
  ALTER COLUMN inr_total TYPE NUMERIC(15, 2) USING ROUND(inr_total::numeric, 2),
  ALTER COLUMN service_charge TYPE NUMERIC(15, 2) USING ROUND(service_charge::numeric, 2),
  ALTER COLUMN split_inr_paid TYPE NUMERIC(15, 2) USING ROUND(split_inr_paid::numeric, 2),
  ALTER COLUMN split_aed_paid TYPE NUMERIC(15, 2) USING ROUND(split_aed_paid::numeric, 2),
  ALTER COLUMN lab_total_inr TYPE NUMERIC(15, 2) USING ROUND(lab_total_inr::numeric, 2);

-- ic_fund_accounts
ALTER TABLE public.ic_fund_accounts
  ALTER COLUMN opening_balance TYPE NUMERIC(15, 2) USING ROUND(opening_balance::numeric, 2);

-- ic_fund_vouchers
ALTER TABLE public.ic_fund_vouchers
  ALTER COLUMN amount TYPE DECIMAL(28, 2) USING ROUND(amount::numeric, 2);

-- inr_fund_accounts
ALTER TABLE public.inr_fund_accounts
  ALTER COLUMN opening_balance TYPE DECIMAL(28, 2) USING ROUND(opening_balance::numeric, 2);

-- inr_fund_vouchers
ALTER TABLE public.inr_fund_vouchers
  ALTER COLUMN amount TYPE DECIMAL(28, 2) USING ROUND(amount::numeric, 2);

-- ic_capital_settings (opening_inr_per_aed remains FX rate precision)
ALTER TABLE public.ic_capital_settings
  ALTER COLUMN opening_aed TYPE DECIMAL(28, 2) USING ROUND(opening_aed::numeric, 2),
  ALTER COLUMN opening_inr TYPE DECIMAL(28, 2) USING ROUND(opening_inr::numeric, 2);

-- ic_capital_lots (inr_per_aed stays rate precision)
ALTER TABLE public.ic_capital_lots
  ALTER COLUMN amount_native TYPE DECIMAL(28, 2) USING ROUND(amount_native::numeric, 2),
  ALTER COLUMN aed_eq TYPE DECIMAL(28, 2) USING ROUND(aed_eq::numeric, 2);

-- ic_capital_allocations
ALTER TABLE public.ic_capital_allocations
  ALTER COLUMN event_amount TYPE DECIMAL(28, 2) USING ROUND(event_amount::numeric, 2),
  ALTER COLUMN allocated_amount TYPE DECIMAL(28, 2) USING ROUND(allocated_amount::numeric, 2);
