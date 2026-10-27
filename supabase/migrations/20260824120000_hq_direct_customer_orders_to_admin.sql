-- HQ ledger direct customers: skip branch review — move stuck orders to admin queue.
UPDATE ic_sales s
SET
  order_status = 'pending',
  fulfillment_handler = 'hq_admin',
  status_updated_at = CURRENT_TIMESTAMP,
  status_updated_by = 'migration'
FROM customers c
WHERE s.order_customer_id = c.id
  AND c.branch_id = 'branch_hq'
  AND s.order_status = 'pending_branch_review'
  AND s.customer_name IS NOT NULL
  AND s.order_customer_name IS NOT NULL
  AND lower(trim(s.customer_name)) = lower(trim(s.order_customer_name));
