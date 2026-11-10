-- Metal FX Profit must be equity (profit), not a personal payable on the balance sheet.
UPDATE public.ic_fund_accounts
SET account_type = 'profit',
    source_type = COALESCE(source_type, 'ic_system'),
    source_id = COALESCE(source_id, 'metal_fx_profit')
WHERE branch_id IS NOT NULL
  AND (
    (source_type = 'ic_system' AND source_id = 'metal_fx_profit')
    OR LOWER(TRIM(name)) = 'metal fx profit'
  )
  AND account_type IS DISTINCT FROM 'profit';
