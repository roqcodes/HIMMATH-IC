-- Stamp existing IC Funds payments/receipts with the party account source
-- so counterparty journals and activity can find them without a table lock.

UPDATE ic_fund_vouchers v
SET
  reference_type = CASE v.voucher_type
    WHEN 'payment' THEN 'ic_fund_payment'
    WHEN 'receipt' THEN 'ic_fund_receipt'
    ELSE 'ic_fund_journal'
  END,
  reference_id = CASE v.voucher_type
    WHEN 'receipt' THEN ca.source_id
    WHEN 'payment' THEN da.source_id
    ELSE COALESCE(da.source_id, ca.source_id)
  END
FROM ic_fund_accounts da, ic_fund_accounts ca
WHERE da.id = v.debit_account_id
  AND ca.id = v.credit_account_id
  AND v.reference_type IS NULL
  AND v.voucher_type IN ('payment', 'receipt', 'journal')
  AND (
    (v.voucher_type = 'payment' AND da.source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer'))
    OR (v.voucher_type = 'receipt' AND ca.source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer'))
    OR (
      v.voucher_type = 'journal'
      AND (
        da.source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer')
        OR ca.source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer')
      )
    )
  );
