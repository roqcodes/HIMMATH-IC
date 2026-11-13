ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS split_inr_paid NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS split_aed_paid NUMERIC(15, 4);

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS split_inr_paid NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS split_aed_paid NUMERIC(15, 4);

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_metal_payment_method_check;
ALTER TABLE public.ic_purchases
  ADD CONSTRAINT ic_purchases_metal_payment_method_check
  CHECK (
    metal_payment_method IS NULL
    OR metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
  );

ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_metal_payment_method_check;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_metal_payment_method_check
  CHECK (
    metal_payment_method IS NULL
    OR metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
  );

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
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'SPLIT' AND aed_agent_id IS NOT NULL
          AND split_inr_paid IS NOT NULL AND split_inr_paid > 0
          AND split_aed_paid IS NOT NULL AND split_aed_paid > 0)
      )
    )
  ) NOT VALID;
