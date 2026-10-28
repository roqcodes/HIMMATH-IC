-- Ledger is AED-only; drop per-account currency tag.
ALTER TABLE public.ic_fund_accounts DROP COLUMN IF EXISTS currency;
