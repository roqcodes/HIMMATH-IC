-- Allow warehouse stock to go negative when deliveries exceed on-hand balance.
ALTER TABLE public.ic_warehouses
  DROP CONSTRAINT IF EXISTS ic_warehouses_current_stock_check;
