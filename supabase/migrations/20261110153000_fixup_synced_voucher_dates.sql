-- Align auto-synced voucher dates to branch business day of created_at (not UTC).

UPDATE public.ic_fund_vouchers v
SET voucher_date = (timezone(b.timezone, v.created_at))::date
FROM public.branches b
WHERE v.branch_id = b.id  
  AND v.reference_type IS NOT NULL  
  AND v.voucher_date IS DISTINCT FROM (timezone(b.timezone, v.created_at))::date;

UPDATE public.inr_fund_vouchers v
SET voucher_date = (timezone(b.timezone, v.created_at))::date
FROM public.branches b
WHERE v.branch_id = b.id
  AND v.reference_type IS NOT NULL
  AND v.voucher_date IS DISTINCT FROM (timezone(b.timezone, v.created_at))::date;
