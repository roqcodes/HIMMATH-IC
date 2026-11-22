-- Remove journals whose purchase, sale, or branch deposit source was deleted.
-- Run once against Supabase Postgres after reviewing the affected row counts.
BEGIN;

CREATE TEMP TABLE _orphaned_deal_journals ON COMMIT DROP AS
SELECT 'ic_fund_vouchers'::text AS table_name, v.id, 'AED'::text AS book
FROM ic_fund_vouchers v
WHERE (
  (v.reference_type IN ('ic_purchase', 'metal_purchase_aed')
    AND NOT EXISTS (SELECT 1 FROM ic_purchases p WHERE p.id::text = v.reference_id))
  OR (v.reference_type = 'ic_sale'
    AND NOT EXISTS (SELECT 1 FROM ic_sales s WHERE s.id::text = v.reference_id))
  OR (v.reference_type = 'ic_branch_deposit'
    AND NOT EXISTS (SELECT 1 FROM ic_branch_deposits d WHERE d.id::text = v.reference_id))
  OR (v.reference_type IN ('metal_sale_aed', 'metal_sale_ic_stock', 'metal_fx_profit', 'ic_sale_cogs', 'ic_sale_profit')
    AND NOT EXISTS (
      SELECT 1 FROM ic_sales s
      WHERE s.id::text = CASE WHEN position('#' IN v.reference_id) > 0
        THEN split_part(v.reference_id, '#', 1) ELSE v.reference_id END
    ))
)
UNION ALL
SELECT 'inr_fund_vouchers'::text AS table_name, v.id, 'INR'::text AS book
FROM inr_fund_vouchers v
WHERE (
  (v.reference_type IN ('ic_purchase_inr', 'metal_purchase', 'lab_test_purchase')
    AND NOT EXISTS (SELECT 1 FROM ic_purchases p WHERE p.id::text = v.reference_id))
  OR (v.reference_type IN ('ic_sale_inr', 'metal_sale_profit', 'metal_sale_receipt', 'metal_sale_cogs', 'lab_test_sale')
    AND NOT EXISTS (
      SELECT 1 FROM ic_sales s
      WHERE s.id::text = CASE WHEN position('#' IN v.reference_id) > 0
        THEN split_part(v.reference_id, '#', 1) ELSE v.reference_id END
    ))
);

UPDATE ic_capital_allocations a
SET status = 'void'
WHERE a.status = 'active'
  AND EXISTS (
    SELECT 1 FROM _orphaned_deal_journals o
    WHERE o.id = a.source_voucher_id AND o.book = a.source_book
  );

DELETE FROM ic_fund_vouchers v
USING _orphaned_deal_journals o
WHERE o.table_name = 'ic_fund_vouchers' AND v.id = o.id;

DELETE FROM inr_fund_vouchers v
USING _orphaned_deal_journals o
WHERE o.table_name = 'inr_fund_vouchers' AND v.id = o.id;

COMMIT;
