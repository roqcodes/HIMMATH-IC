-- Plain-language INR metal ledger names (stock / sales / cost of sold / profit).

UPDATE public.inr_fund_accounts
SET name = 'Metal Stock'
WHERE source_id = 'metal_inventory'
  AND name IS DISTINCT FROM 'Metal Stock';

UPDATE public.inr_fund_accounts
SET name = 'Metal Sales'
WHERE source_id = 'metal_sales'
  AND name IS DISTINCT FROM 'Metal Sales';

UPDATE public.inr_fund_accounts
SET name = 'Cost of Metal Sold'
WHERE source_id = 'metal_cost'
  AND name IS DISTINCT FROM 'Cost of Metal Sold';

UPDATE public.inr_fund_accounts
SET name = 'Metal Profit'
WHERE source_id = 'metal_profit'
  AND name IS DISTINCT FROM 'Metal Profit';

UPDATE public.ic_fund_accounts
SET name = 'Metal Stock'
WHERE source_id = 'metal_inventory'
  AND name IS DISTINCT FROM 'Metal Stock';
