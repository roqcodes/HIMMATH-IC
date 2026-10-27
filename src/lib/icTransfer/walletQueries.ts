/** Shared wallet SQL — approved allocations only count toward sale remaining. */

export const OPEN_CUSTOMER_SALES_SQL = `
  SELECT s.*,
         COALESCE(wallet_paid.total_paid, 0) AS foreign_collected
  FROM ic_sales s
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(wsa.allocated_foreign), 0) AS total_paid
    FROM ic_wallet_sale_allocations wsa
    JOIN ic_wallet_transactions wt ON wt.id = wsa.wallet_transaction_id
    WHERE wsa.sale_id = s.id AND wt.status = 'approved'
  ) wallet_paid ON TRUE
  WHERE s.order_status = 'completed'
    AND s.order_customer_id = $1
    AND UPPER(COALESCE(s.currency, 'AED')) NOT IN ('AED', 'CURRENCY')
    AND COALESCE(s.conversion_rate, 0) > 0
    AND COALESCE(s.converted_amount, 0) > 0
`;
