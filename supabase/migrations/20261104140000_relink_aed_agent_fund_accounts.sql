-- Point historic aed_agent:{uuid} IC fund accounts (and vouchers) at the agent counterparty.

UPDATE ic_fund_vouchers v
SET debit_account_id = cp.id
FROM ic_fund_accounts shadow
JOIN ic_aed_agents ag
  ON shadow.source_type = 'ic_counterparty'
 AND shadow.source_id = ('aed_agent:' || ag.id::text)
JOIN ic_fund_accounts cp
  ON cp.branch_id = shadow.branch_id
 AND cp.source_type = 'ic_counterparty'
 AND cp.source_id = ag.counterparty_id::text
 AND cp.id <> shadow.id
WHERE v.debit_account_id = shadow.id
  AND ag.counterparty_id IS NOT NULL;

UPDATE ic_fund_vouchers v
SET credit_account_id = cp.id
FROM ic_fund_accounts shadow
JOIN ic_aed_agents ag
  ON shadow.source_type = 'ic_counterparty'
 AND shadow.source_id = ('aed_agent:' || ag.id::text)
JOIN ic_fund_accounts cp
  ON cp.branch_id = shadow.branch_id
 AND cp.source_type = 'ic_counterparty'
 AND cp.source_id = ag.counterparty_id::text
 AND cp.id <> shadow.id
WHERE v.credit_account_id = shadow.id
  AND ag.counterparty_id IS NOT NULL;

UPDATE ic_fund_accounts a
SET source_id = ag.counterparty_id::text,
    name = COALESCE(NULLIF(btrim(ag.name), ''), a.name)
FROM ic_aed_agents ag
WHERE a.source_type = 'ic_counterparty'
  AND a.source_id = ('aed_agent:' || ag.id::text)
  AND ag.counterparty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ic_fund_accounts x
    WHERE x.branch_id = a.branch_id
      AND x.source_type = 'ic_counterparty'
      AND x.source_id = ag.counterparty_id::text
      AND x.id <> a.id
  );

UPDATE ic_fund_accounts cp
SET opening_balance = COALESCE(cp.opening_balance, 0) + COALESCE(shadow.opening_balance, 0)
FROM ic_fund_accounts shadow
JOIN ic_aed_agents ag
  ON shadow.source_type = 'ic_counterparty'
 AND shadow.source_id = ('aed_agent:' || ag.id::text)
WHERE cp.branch_id = shadow.branch_id
  AND cp.source_type = 'ic_counterparty'
  AND cp.source_id = ag.counterparty_id::text
  AND cp.id <> shadow.id
  AND ag.counterparty_id IS NOT NULL
  AND COALESCE(shadow.opening_balance, 0) <> 0;

UPDATE ic_fund_accounts a
SET source_id = 'amrg:' || ag.id::text,
    opening_balance = 0,
    status = 'inactive'
FROM ic_aed_agents ag
WHERE a.source_type = 'ic_counterparty'
  AND a.source_id = ('aed_agent:' || ag.id::text)
  AND ag.counterparty_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ic_fund_accounts x
    WHERE x.branch_id = a.branch_id
      AND x.source_type = 'ic_counterparty'
      AND x.source_id = ag.counterparty_id::text
      AND x.id <> a.id
  )
  AND EXISTS (
    SELECT 1 FROM ic_fund_vouchers v
    WHERE v.debit_account_id = a.id OR v.credit_account_id = a.id
  );

DELETE FROM ic_fund_accounts a
USING ic_aed_agents ag
WHERE a.source_type = 'ic_counterparty'
  AND a.source_id = ('aed_agent:' || ag.id::text)
  AND ag.counterparty_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM ic_fund_accounts x
    WHERE x.branch_id = a.branch_id
      AND x.source_type = 'ic_counterparty'
      AND x.source_id = ag.counterparty_id::text
      AND x.id <> a.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM ic_fund_vouchers v
    WHERE v.debit_account_id = a.id OR v.credit_account_id = a.id
  );
