-- Plain-language IC ledger names (stock / sales / cost of sold / profit).

UPDATE public.ic_fund_accounts
SET name = 'IC Stock'
WHERE source_id = 'ic_inventory'
  AND name IS DISTINCT FROM 'IC Stock';

UPDATE public.ic_fund_accounts
SET name = 'IC Sales'
WHERE source_id = 'ic_transfer_sales'
  AND name IS DISTINCT FROM 'IC Sales';

UPDATE public.ic_fund_accounts
SET name = 'Cost of IC Sold'
WHERE source_id = 'ic_purchase_cost'
  AND name IS DISTINCT FROM 'Cost of IC Sold';

UPDATE public.ic_fund_accounts
SET name = 'IC Profit'
WHERE source_id = 'ic_sales_profit'
  AND name IS DISTINCT FROM 'IC Profit';
