-- Collection agent wallet refactor: customer↔agent M2M, foreign wallet ledger, drop per-sale agent.

ALTER TABLE ic_fund_accounts
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'AED';

UPDATE ic_fund_accounts SET currency = 'AED' WHERE TRIM(currency) = '';

CREATE TABLE IF NOT EXISTS customer_collection_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  collection_account_id VARCHAR(50) NOT NULL REFERENCES ic_fund_accounts(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  created_by_name VARCHAR(255),
  UNIQUE (customer_id, collection_account_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_collection_agents_customer
  ON customer_collection_agents (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_collection_agents_agent
  ON customer_collection_agents (collection_account_id);

CREATE TABLE IF NOT EXISTS ic_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id VARCHAR(50) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  transaction_type VARCHAR(30) NOT NULL CHECK (
    transaction_type IN ('customer_payment', 'agent_transfer')
  ),
  currency VARCHAR(10) NOT NULL,
  amount NUMERIC(18, 14) NOT NULL CHECK (amount > 0),
  customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL,
  from_account_id VARCHAR(50) NOT NULL REFERENCES ic_fund_accounts(id) ON DELETE RESTRICT,
  to_account_id VARCHAR(50) NOT NULL REFERENCES ic_fund_accounts(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected')
  ),
  notes TEXT,
  entered_by VARCHAR(255),
  entered_by_name VARCHAR(255),
  entered_by_user_id VARCHAR(255),
  approved_by VARCHAR(255),
  approved_by_name VARCHAR(255),
  approved_at TIMESTAMPTZ,
  rejected_by VARCHAR(255),
  rejected_by_name VARCHAR(255),
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  transfer_from_transaction_id UUID REFERENCES ic_wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ic_wallet_transactions_distinct_accounts CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_wallet_transactions_branch_status
  ON ic_wallet_transactions (branch_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_wallet_transactions_customer
  ON ic_wallet_transactions (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ic_wallet_transactions_to_account
  ON ic_wallet_transactions (to_account_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ic_wallet_sale_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_transaction_id UUID NOT NULL REFERENCES ic_wallet_transactions(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES ic_sales(id) ON DELETE RESTRICT,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  collection_account_id VARCHAR(50) NOT NULL REFERENCES ic_fund_accounts(id) ON DELETE RESTRICT,
  allocated_foreign NUMERIC(18, 14) NOT NULL CHECK (allocated_foreign > 0),
  sale_conversion_rate NUMERIC(18, 14) NOT NULL CHECK (sale_conversion_rate > 0),
  settled_foreign NUMERIC(18, 14) NOT NULL DEFAULT 0 CHECK (settled_foreign >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ic_wallet_sale_allocations_settled_le_allocated
    CHECK (settled_foreign <= allocated_foreign)
);

CREATE INDEX IF NOT EXISTS idx_ic_wallet_sale_allocations_sale
  ON ic_wallet_sale_allocations (sale_id);

CREATE INDEX IF NOT EXISTS idx_ic_wallet_sale_allocations_agent_open
  ON ic_wallet_sale_allocations (collection_account_id, sale_id)
  WHERE settled_foreign < allocated_foreign;

CREATE INDEX IF NOT EXISTS idx_ic_wallet_sale_allocations_wallet
  ON ic_wallet_sale_allocations (wallet_transaction_id);

ALTER TABLE ic_sale_fx_settlements
  ADD COLUMN IF NOT EXISTS wallet_allocation_id UUID
  REFERENCES ic_wallet_sale_allocations(id) ON DELETE SET NULL;

DROP INDEX IF EXISTS idx_ic_sales_collection_account;
ALTER TABLE ic_sales DROP COLUMN IF EXISTS collection_account_id;
