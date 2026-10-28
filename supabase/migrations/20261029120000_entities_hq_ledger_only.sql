-- Entities: single HQ ledger for all IC Fund accounts (no branch-scoped entity ledgers).
-- Idempotent — safe to re-run after inr_aed_hq_refactor.

INSERT INTO public.branches (
    id, slug, name, location, manager_name, status, timezone, hidden_pages, features
) VALUES (
    'branch_hq', 'hq', 'HQ', 'Head office', 'HQ Admin', 'active', 'Asia/Dubai', '{}',
    '{"warehousePortal":false,"customerPortal":false,"isHqLedger":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.customers
SET branch_id = 'branch_hq'
WHERE branch_id IS NOT NULL AND branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_fund_accounts
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_fund_vouchers
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';

UPDATE public.ic_fund_voucher_counters
SET branch_id = 'branch_hq'
WHERE branch_id IS DISTINCT FROM 'branch_hq';
