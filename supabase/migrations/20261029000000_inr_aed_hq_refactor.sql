-- INR/AED HQ refactor: collapse to branch_hq, remove FX/wallet/collection agents, simplify currency model.
-- Idempotent where practical. Apply via Supabase SQL editor or CLI.

-- Ensure HQ exists
INSERT INTO public.branches (
    id, slug, name, location, manager_name, status, timezone, hidden_pages, features
) VALUES (
    'branch_hq', 'hq', 'HQ', 'Head office', 'HQ Admin', 'active', 'Asia/Dubai', '{}',
    '{"warehousePortal":false,"customerPortal":false,"isHqLedger":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ic_fund_voucher_counters (branch_id, last_no)
VALUES ('branch_hq', 0)
ON CONFLICT (branch_id) DO NOTHING;

-- Reassign operational data to HQ
UPDATE public.customers
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.profiles
SET branch_id = 'branch_hq'
WHERE branch_id IS NOT NULL AND branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_fund_accounts
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_fund_vouchers
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.audit_log
SET branch_id = 'branch_hq'
WHERE branch_id IS NOT NULL AND branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.user_page_permissions
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_warehouses
SET branch_id = NULL
WHERE branch_id IS NOT NULL AND branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_suppliers
SET branch_id = NULL
WHERE branch_id IS NOT NULL AND branch_id IS DISTINCT FROM 'branch_hq';

-- Soft-delete non-HQ branches (keep FK history on HQ reassigned rows)
UPDATE public.branches
SET is_active = false, deleted_at = COALESCE(deleted_at, NOW()), status = 'inactive'
WHERE id IS DISTINCT FROM 'branch_hq' AND deleted_at IS NULL;

-- Order workflow: no branch review
UPDATE public.ic_sales
SET order_status = 'pending',
    fulfillment_handler = 'hq_admin'
WHERE order_status IN ('pending_branch_review', 'branch_rejected')
   OR fulfillment_handler = 'branch';

-- Deactivate collection-agent fund accounts (ledger history preserved)
UPDATE public.ic_fund_accounts
SET status = 'inactive'
WHERE account_type = 'collection_agent';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ic_fund_accounts'
      AND column_name = 'currency'
  ) THEN
    UPDATE public.ic_fund_accounts
    SET currency = 'AED'
    WHERE currency IS DISTINCT FROM 'AED';
  END IF;
END $$;

UPDATE public.profiles
SET collection_account_id = NULL
WHERE collection_account_id IS NOT NULL;

-- Drop FX / wallet / agent tables (order: dependents first)
DROP TABLE IF EXISTS public.ic_sale_fx_settlements CASCADE;
DROP TABLE IF EXISTS public.ic_fx_settlement_requests CASCADE;
DROP TABLE IF EXISTS public.ic_wallet_sale_allocations CASCADE;
DROP TABLE IF EXISTS public.ic_wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.ic_wallet_transaction_counters CASCADE;
DROP TABLE IF EXISTS public.customer_collection_agents CASCADE;
DROP TABLE IF EXISTS public.ic_purchase_fx_rates CASCADE;
DROP TABLE IF EXISTS public.ic_rate_group_branches CASCADE;

-- Rate groups: drop FX columns
ALTER TABLE public.ic_rate_groups DROP COLUMN IF EXISTS currency;
ALTER TABLE public.ic_rate_groups DROP COLUMN IF EXISTS conversion_rate;
ALTER TABLE public.ic_rate_groups DROP COLUMN IF EXISTS created_by_branch_id;

-- Sales: drop FX / branch conversion columns
DROP INDEX IF EXISTS public.idx_ic_sales_customer_completed_fx;
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS currency;
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS conversion_rate;
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS converted_amount;
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS admin_conversion_rate;
ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS admin_unit_rate;

-- Purchases: drop FX columns
ALTER TABLE public.ic_purchases DROP COLUMN IF EXISTS currency;
ALTER TABLE public.ic_purchases DROP COLUMN IF EXISTS conversion_rate;
ALTER TABLE public.ic_purchases DROP COLUMN IF EXISTS converted_total;

-- Customers / branches
ALTER TABLE public.customers DROP COLUMN IF EXISTS currency;
ALTER TABLE public.branches DROP COLUMN IF EXISTS enabled_currencies;

-- Restrict fund account types (remove collection_agent)
ALTER TABLE public.ic_fund_accounts DROP CONSTRAINT IF EXISTS ic_fund_accounts_account_type_check;
ALTER TABLE public.ic_fund_accounts
  ADD CONSTRAINT ic_fund_accounts_account_type_check
  CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'd_expense'));

-- Sales fulfillment_handler: HQ only
ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_fulfillment_handler_check;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_fulfillment_handler_check
  CHECK (fulfillment_handler IN ('hq_admin'));

UPDATE public.ic_sales SET fulfillment_handler = 'hq_admin' WHERE fulfillment_handler IS DISTINCT FROM 'hq_admin';

-- Optional: tighten order_status enum via new check (Postgres CHECK on column)
-- Branch-only statuses should already be migrated above.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS collection_account_id;
