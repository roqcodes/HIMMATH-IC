ALTER TABLE public.ic_warehouses
  ALTER COLUMN current_stock TYPE NUMERIC(20, 8),
  ALTER COLUMN opening_stock TYPE NUMERIC(20, 8);

ALTER TABLE public.ic_sales
  ALTER COLUMN units TYPE NUMERIC(20, 8),
  ALTER COLUMN collected_units TYPE NUMERIC(20, 8);

ALTER TABLE public.ic_warehouse_transactions
  ALTER COLUMN units TYPE NUMERIC(20, 8);
