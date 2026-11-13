-- Metal split INR journals use `{dealUuid}#xxxx` (and previously a longer suffix).
ALTER TABLE public.ic_fund_vouchers
  ALTER COLUMN reference_id TYPE VARCHAR(80);

ALTER TABLE public.inr_fund_vouchers
  ALTER COLUMN reference_id TYPE VARCHAR(80);
