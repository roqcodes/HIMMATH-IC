-- Normalize invalid split columns on non-split metal deals before tightening CHECK.
UPDATE public.ic_purchases
SET split_inr_paid = NULL, split_aed_paid = NULL
WHERE settlement_mode = 'metal'
  AND COALESCE(metal_payment_method, 'CASH') NOT IN ('SPLIT')
  AND (split_inr_paid IS NOT NULL OR split_aed_paid IS NOT NULL);

UPDATE public.ic_sales
SET split_inr_paid = NULL, split_aed_paid = NULL
WHERE settlement_mode = 'metal'
  AND COALESCE(metal_payment_method, 'CASH') NOT IN ('SPLIT')
  AND (split_inr_paid IS NOT NULL OR split_aed_paid IS NOT NULL);

ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_metal_payment_shape;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_metal_payment_shape
  CHECK (
    (settlement_mode = 'cash' AND metal_payment_method IS NULL AND aed_agent_id IS NULL)
    OR (
      settlement_mode = 'metal'
      AND metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
      AND (
        (metal_payment_method IN ('CASH', 'INR') AND aed_agent_id IS NULL
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL AND aed_amount IS NOT NULL AND aed_amount > 0
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'SPLIT' AND aed_agent_id IS NOT NULL AND aed_amount IS NOT NULL AND aed_amount > 0
          AND split_inr_paid IS NOT NULL AND split_inr_paid > 0
          AND split_aed_paid IS NOT NULL AND split_aed_paid > 0)
      )
    )
  ) NOT VALID;

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_metal_payment_shape;
ALTER TABLE public.ic_purchases
  ADD CONSTRAINT ic_purchases_metal_payment_shape
  CHECK (
    (settlement_mode = 'cash' AND metal_payment_method IS NULL AND aed_agent_id IS NULL)
    OR (
      settlement_mode = 'metal'
      AND metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
      AND (
        (metal_payment_method IN ('CASH', 'INR') AND aed_agent_id IS NULL AND aed_total IS NULL
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL AND aed_total IS NOT NULL AND aed_total > 0
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'SPLIT' AND aed_agent_id IS NOT NULL AND aed_total IS NOT NULL AND aed_total > 0
          AND split_inr_paid IS NOT NULL AND split_inr_paid > 0
          AND split_aed_paid IS NOT NULL AND split_aed_paid > 0)
      )
    )
  ) NOT VALID;

ALTER TABLE public.ic_purchases VALIDATE CONSTRAINT ic_purchases_metal_payment_shape;
ALTER TABLE public.ic_sales VALIDATE CONSTRAINT ic_sales_metal_payment_shape;
