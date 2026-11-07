-- Metal AED clearing: rename "Metal sale reverse" to purchase-oriented id/name (idempotent).
UPDATE public.ic_fund_accounts
SET source_id = 'metal_purchase_aed_clearing',
    name = 'Metal purchase AED'
WHERE source_type = 'ic_counterparty'
  AND (
    source_id = 'metal_sale_reverse'
    OR source_id = 'metal_aed_clearing'
  )
  AND (
    source_id IS DISTINCT FROM 'metal_purchase_aed_clearing'
    OR name IS DISTINCT FROM 'Metal purchase AED'
  );
