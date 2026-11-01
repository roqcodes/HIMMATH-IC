-- Metal inventory is grams (lots), not IC units.
-- Sales link to a purchase lot; payment method chooses INR vs AED P&L.

ALTER TABLE public.ic_warehouses
  ADD COLUMN IF NOT EXISTS current_metal_g NUMERIC(15, 4) NOT NULL DEFAULT 0;

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS metal_purchase_id UUID REFERENCES public.ic_purchases(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS metal_payment_method VARCHAR(10)
    CHECK (metal_payment_method IS NULL OR metal_payment_method IN ('INR', 'AED'));

CREATE INDEX IF NOT EXISTS idx_ic_sales_metal_purchase
  ON public.ic_sales (metal_purchase_id)
  WHERE metal_purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse_metal
  ON public.ic_purchases (warehouse_id, created_at DESC)
  WHERE settlement_mode = 'metal';

-- Move existing metal grams onto warehouse metal stock.
UPDATE public.ic_warehouses w
SET current_metal_g = GREATEST(
  0,
  COALESCE((
    SELECT SUM(p.metal_weight_g)
    FROM public.ic_purchases p
    WHERE p.warehouse_id = w.id
      AND p.settlement_mode = 'metal'
      AND p.metal_weight_g IS NOT NULL
  ), 0)
  - COALESCE((
    SELECT SUM(s.metal_weight_g)
    FROM public.ic_sales s
    WHERE s.warehouse_id = w.id
      AND s.settlement_mode = 'metal'
      AND s.metal_weight_g IS NOT NULL
      AND s.order_status NOT IN (
        'pending',
        'pending_branch_review',
        'branch_rejected',
        'admin_rejected',
        'wh_rejected',
        'da_rejected',
        'cancelled',
        'cancellation_pending'
      )
  ), 0)
);

-- Undo IC-unit stock that was imputed from metal INR totals.
UPDATE public.ic_warehouses w
SET current_stock = current_stock
  - COALESCE((
    SELECT SUM(p.units)
    FROM public.ic_purchases p
    WHERE p.warehouse_id = w.id AND p.settlement_mode = 'metal'
  ), 0)
  + COALESCE((
    SELECT SUM(s.units)
    FROM public.ic_sales s
    WHERE s.warehouse_id = w.id
      AND s.settlement_mode = 'metal'
      AND s.order_status = 'completed'
  ), 0);
