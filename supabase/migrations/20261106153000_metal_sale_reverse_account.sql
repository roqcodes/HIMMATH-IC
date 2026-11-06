-- Rename metal AED clearing linked account (ic_counterparty) to "Metal sale reverse".

UPDATE public.ic_fund_accounts
SET source_id = 'metal_sale_reverse',
    name = 'Metal sale reverse'
WHERE source_type = 'ic_counterparty'
  AND source_id = 'metal_aed_clearing'
  AND (source_id IS DISTINCT FROM 'metal_sale_reverse' OR name IS DISTINCT FROM 'Metal sale reverse');
