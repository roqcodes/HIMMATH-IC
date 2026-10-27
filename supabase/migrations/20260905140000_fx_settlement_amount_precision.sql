-- Store FX settlement AED amounts at full rate precision (14 dp), not 4 dp rounded.

ALTER TABLE public.ic_sale_fx_settlements
  ALTER COLUMN settled_aed TYPE NUMERIC(28, 14),
  ALTER COLUMN booked_aed TYPE NUMERIC(28, 14),
  ALTER COLUMN type2_profit_aed TYPE NUMERIC(28, 14);
