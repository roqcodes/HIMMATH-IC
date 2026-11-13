-- UAE operating branches (DXB, etc.) — not India warehouses or HQ portal tenants.

CREATE TABLE IF NOT EXISTS public.ic_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
    cash_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_branches_scope_code
  ON public.ic_branches (lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';

CREATE TABLE IF NOT EXISTS public.ic_branch_managers (
    branch_id UUID NOT NULL REFERENCES public.ic_branches(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE CASCADE,
    PRIMARY KEY (branch_id, manager_id)
);
CREATE INDEX IF NOT EXISTS idx_ic_branch_managers_manager ON public.ic_branch_managers (manager_id);

ALTER TABLE public.ic_branch_deposits
  ADD COLUMN IF NOT EXISTS ic_branch_id UUID REFERENCES public.ic_branches(id) ON DELETE RESTRICT;

-- Migrate branch desks from ic_warehouses (same UUID keeps URLs working).
INSERT INTO public.ic_branches (id, name, code, phone, email, address, timezone, cash_balance, created_at)
SELECT w.id,
       w.name,
       w.code,
       w.phone,
       w.email,
       w.address,
       COALESCE(NULLIF(btrim(br.timezone), ''), 'Asia/Dubai'),
       COALESCE(br.cash_balance, 0),
       w.created_at
FROM public.ic_warehouses w
LEFT JOIN public.branches br ON br.id = w.branch_id
WHERE w.desk_kind = 'branch'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ic_branch_managers (branch_id, manager_id)
SELECT wm.warehouse_id, wm.manager_id
FROM public.ic_warehouse_managers wm
INNER JOIN public.ic_warehouses w ON w.id = wm.warehouse_id AND w.desk_kind = 'branch'
ON CONFLICT DO NOTHING;

UPDATE public.ic_branch_deposits d
SET ic_branch_id = d.warehouse_id
WHERE d.ic_branch_id IS NULL AND d.warehouse_id IS NOT NULL;

UPDATE public.ic_branch_deposits d
SET ic_branch_id = w.id
FROM public.ic_warehouses w
WHERE d.ic_branch_id IS NULL AND w.desk_kind = 'branch' AND d.branch_id = w.branch_id
  AND EXISTS (SELECT 1 FROM public.ic_branches b WHERE b.id = w.id);

-- HQ locker accounts named after the branch (not "Branch cash — HQ").
INSERT INTO public.ic_fund_accounts (id, branch_id, name, account_type, opening_balance, notes, source_type, source_id)
SELECT
  'ICFA-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  'branch_hq',
  b.name,
  'personal',
  0,
  'UAE branch cash locker (Himmath)',
  'ic_branch',
  b.id::text
FROM public.ic_branches b
WHERE NOT EXISTS (
  SELECT 1 FROM public.ic_fund_accounts a
  WHERE a.branch_id = 'branch_hq' AND a.source_type = 'ic_branch' AND a.source_id = b.id::text
);

-- Repoint deposit journals onto the ic_branch till account (legacy branch_cash_* / branch_cash_wh_*).
UPDATE public.ic_fund_vouchers v
SET debit_account_id = a.id
FROM public.ic_branch_deposits d
JOIN public.ic_fund_accounts a
  ON a.branch_id = 'branch_hq'
 AND a.source_type = 'ic_branch'
 AND a.source_id = d.ic_branch_id::text
WHERE v.reference_type = 'ic_branch_deposit'
  AND v.reference_id = d.id::text
  AND v.status IS DISTINCT FROM 'void'
  AND d.ic_branch_id IS NOT NULL
  AND v.debit_account_id IS DISTINCT FROM a.id;

UPDATE public.ic_fund_accounts fa
SET name = b.name,
    source_type = 'ic_branch',
    source_id = b.id::text
FROM public.ic_branches b
WHERE fa.branch_id = 'branch_hq'
  AND fa.source_type = 'ic_system'
  AND fa.source_id IN ('branch_cash_branch_hq', 'branch_cash_wh_' || b.id::text, 'branch_cash_' || b.id::text)
  AND NOT EXISTS (
    SELECT 1 FROM public.ic_fund_accounts x
    WHERE x.branch_id = 'branch_hq' AND x.source_type = 'ic_branch' AND x.source_id = b.id::text AND x.id <> fa.id
  );

ALTER TABLE public.ic_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asic_ic_branches_access ON public.ic_branches;
CREATE POLICY asic_ic_branches_access ON public.ic_branches FOR ALL USING (true);

ALTER TABLE public.ic_branch_managers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asic_ic_branch_managers_access ON public.ic_branch_managers;
CREATE POLICY asic_ic_branch_managers_access ON public.ic_branch_managers FOR ALL USING (true);
