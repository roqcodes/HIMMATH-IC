-- Sequential wallet transaction numbers per branch (audit footprint for each cash movement).

CREATE TABLE IF NOT EXISTS ic_wallet_transaction_counters (
  branch_id VARCHAR(50) PRIMARY KEY REFERENCES branches(id) ON DELETE CASCADE,
  last_no INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE ic_wallet_transactions
  ADD COLUMN IF NOT EXISTS transaction_no INTEGER;

WITH numbered AS (
  SELECT id,
         branch_id,
         ROW_NUMBER() OVER (PARTITION BY branch_id ORDER BY created_at ASC, id ASC) AS rn
  FROM ic_wallet_transactions
  WHERE transaction_no IS NULL
)
UPDATE ic_wallet_transactions wt
SET transaction_no = numbered.rn
FROM numbered
WHERE wt.id = numbered.id;

INSERT INTO ic_wallet_transaction_counters (branch_id, last_no)
SELECT branch_id, MAX(transaction_no)
FROM ic_wallet_transactions
WHERE transaction_no IS NOT NULL
GROUP BY branch_id
ON CONFLICT (branch_id) DO UPDATE
SET last_no = GREATEST(ic_wallet_transaction_counters.last_no, EXCLUDED.last_no);

ALTER TABLE ic_wallet_transactions
  ALTER COLUMN transaction_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_wallet_transactions_branch_no
  ON ic_wallet_transactions (branch_id, transaction_no);
