ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS locality VARCHAR(255);

ALTER TABLE public.ic_suppliers
  ADD COLUMN IF NOT EXISTS locality VARCHAR(255);
