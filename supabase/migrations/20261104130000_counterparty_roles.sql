-- Counterparty roles: supplier (purchases), party (sales), agent (AED collection).

ALTER TABLE public.ic_counterparties
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY['supplier', 'party']::TEXT[];

UPDATE public.ic_counterparties
SET roles = ARRAY['supplier', 'party']::TEXT[]
WHERE roles IS NULL OR cardinality(roles) = 0;

ALTER TABLE public.ic_counterparties DROP CONSTRAINT IF EXISTS ic_counterparties_roles_check;
ALTER TABLE public.ic_counterparties
  ADD CONSTRAINT ic_counterparties_roles_check
  CHECK (
    cardinality(roles) >= 1
    AND roles <@ ARRAY['supplier', 'party', 'agent']::TEXT[]                                                    
  );

CREATE INDEX IF NOT EXISTS idx_ic_counterparties_roles
  ON public.ic_counterparties USING GIN (roles);

ALTER TABLE public.ic_aed_agents
  ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_aed_agents_counterparty
  ON public.ic_aed_agents (counterparty_id)
  WHERE counterparty_id IS NOT NULL;
