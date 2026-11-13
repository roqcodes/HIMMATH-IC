-- Managers have no supplier/party/agent roles; customers still need at least one.

ALTER TABLE public.ic_counterparties DROP CONSTRAINT IF EXISTS ic_counterparties_roles_check;

ALTER TABLE public.ic_counterparties
  ADD CONSTRAINT ic_counterparties_roles_check
  CHECK (
    roles <@ ARRAY['supplier', 'party', 'agent']::TEXT[]
    AND (
      (kind = 'manager' AND cardinality(roles) = 0)
      OR (COALESCE(kind, 'customer') <> 'manager' AND cardinality(roles) >= 1)
    )
  );

UPDATE public.ic_counterparties
SET roles = ARRAY[]::TEXT[]
WHERE kind = 'manager' AND cardinality(roles) > 0;
