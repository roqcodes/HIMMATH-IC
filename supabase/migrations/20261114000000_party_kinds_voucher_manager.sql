-- Party kind: agent; relax home_manager; voucher manager tag on party P&R.
-- Order: relax CHECKs → backfill → restore CHECKs (agent + empty roles).

ALTER TABLE public.ic_counterparties DROP CONSTRAINT IF EXISTS ic_counterparties_kind_check;

ALTER TABLE public.ic_counterparties DROP CONSTRAINT IF EXISTS ic_counterparties_roles_check;
ALTER TABLE public.ic_counterparties DROP CONSTRAINT IF EXISTS ic_counterparties_roles_by_kind;

UPDATE public.ic_counterparties
SET kind = 'agent', roles = ARRAY[]::TEXT[]
WHERE kind = 'customer'
  AND 'agent' = ANY (roles)
  AND NOT ('supplier' = ANY (roles) OR 'party' = ANY (roles));
  
ALTER TABLE public.ic_counterparties
  ADD CONSTRAINT ic_counterparties_kind_check
  CHECK (kind IN ('manager', 'customer', 'agent'));

ALTER TABLE public.ic_counterparties
  ADD CONSTRAINT ic_counterparties_roles_check
  CHECK (
    roles <@ ARRAY['supplier', 'party', 'agent']::TEXT[]
    AND (
      (kind IN ('manager', 'agent') AND cardinality(roles) = 0)
      OR (kind = 'customer' AND cardinality(roles) >= 1)
    )
  ) NOT VALID;

ALTER TABLE public.ic_counterparties VALIDATE CONSTRAINT ic_counterparties_roles_check;

ALTER TABLE public.ic_fund_vouchers
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

ALTER TABLE public.inr_fund_vouchers
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_manager
  ON public.ic_fund_vouchers (manager_id) WHERE manager_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_manager
  ON public.inr_fund_vouchers (manager_id) WHERE manager_id IS NOT NULL;
