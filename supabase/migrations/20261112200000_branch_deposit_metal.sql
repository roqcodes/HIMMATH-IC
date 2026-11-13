ALTER TABLE public.ic_branch_deposits
  ADD COLUMN IF NOT EXISTS settlement_mode VARCHAR(20) NOT NULL DEFAULT 'cash'
    CHECK (settlement_mode IN ('cash', 'metal'));

ALTER TABLE public.ic_branch_deposits
  ADD COLUMN IF NOT EXISTS metal_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS metal_rate_aed_per_g NUMERIC(15, 4);
