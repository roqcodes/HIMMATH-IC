-- NUMERIC(18,14) allows only 4 digits before the decimal (max ~9999.9999…).
-- Foreign sale totals (e.g. SAR 11424) overflow; align with ic_sales.converted_amount.

ALTER TABLE ic_wallet_transactions
  ALTER COLUMN amount TYPE NUMERIC(15, 4);

ALTER TABLE ic_wallet_sale_allocations
  ALTER COLUMN allocated_foreign TYPE NUMERIC(15, 4),
  ALTER COLUMN sale_conversion_rate TYPE NUMERIC(15, 6),
  ALTER COLUMN settled_foreign TYPE NUMERIC(15, 4);
