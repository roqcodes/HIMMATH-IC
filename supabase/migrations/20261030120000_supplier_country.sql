
ALTER TABLE public.ic_suppliers
  ADD COLUMN IF NOT EXISTS country VARCHAR(100);
