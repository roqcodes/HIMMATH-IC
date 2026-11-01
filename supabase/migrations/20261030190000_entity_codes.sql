ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS code VARCHAR(32);
ALTER TABLE public.ic_suppliers ADD COLUMN IF NOT EXISTS code VARCHAR(32);
ALTER TABLE public.ic_warehouses ADD COLUMN IF NOT EXISTS code VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_branch_code
  ON public.customers (branch_id, lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_suppliers_scope_code
  ON public.ic_suppliers (COALESCE(branch_id, ''), lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_warehouses_scope_code
  ON public.ic_warehouses (COALESCE(branch_id, ''), lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';
