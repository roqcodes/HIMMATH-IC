-- Toggle warehouse / delivery-agent order workflow (instant completed sales when false).
ALTER TABLE public.ic_transfer_settings
  ADD COLUMN IF NOT EXISTS warehouse_fulfillment_enabled BOOLEAN NOT NULL DEFAULT false;

UPDATE public.ic_transfer_settings
SET warehouse_fulfillment_enabled = false
WHERE id = 'global' AND warehouse_fulfillment_enabled IS NULL;
