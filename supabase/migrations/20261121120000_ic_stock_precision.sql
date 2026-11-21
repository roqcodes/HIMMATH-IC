ALTER TABLE public.ic_warehouses
  ALTER COLUMN current_stock TYPE NUMERIC(20, 8),
  ALTER COLUMN opening_stock TYPE NUMERIC(20, 8);
