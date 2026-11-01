-- Purchases are recorded as settled immediately (no pending payment state).
UPDATE public.ic_purchases
SET payment_status = 'paid'
WHERE payment_status IS DISTINCT FROM 'paid';

ALTER TABLE public.ic_purchases
  ALTER COLUMN payment_status SET DEFAULT 'paid';
