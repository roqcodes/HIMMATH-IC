-- HQ admin IC Funds ledger (idempotent)
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
