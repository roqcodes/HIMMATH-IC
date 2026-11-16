-- UAE branch lockers are cash/bank accounts (AED only), not party personal ledgers.

UPDATE public.ic_fund_accounts
SET account_type = 'bank'
WHERE source_type = 'ic_branch'
  AND account_type IS DISTINCT FROM 'bank';
