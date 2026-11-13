  -- Managers vs customers, acting manager on deals, branch AED deposits, branch desks

  ALTER TABLE public.ic_counterparties
    ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'customer'
      CHECK (kind IN ('manager', 'customer'));

  ALTER TABLE public.ic_counterparties
    ADD COLUMN IF NOT EXISTS home_manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_ic_counterparties_kind ON public.ic_counterparties (kind);
  CREATE INDEX IF NOT EXISTS idx_ic_counterparties_home_manager
    ON public.ic_counterparties (home_manager_id)
    WHERE home_manager_id IS NOT NULL;

  UPDATE public.ic_counterparties SET kind = 'customer' WHERE kind IS NULL OR kind NOT IN ('manager', 'customer');

  ALTER TABLE public.ic_purchases
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

  ALTER TABLE public.ic_sales
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

  CREATE INDEX IF NOT EXISTS idx_ic_purchases_manager ON public.ic_purchases (manager_id);
  CREATE INDEX IF NOT EXISTS idx_ic_sales_manager ON public.ic_sales (manager_id);

  ALTER TABLE public.ic_warehouses
    ADD COLUMN IF NOT EXISTS desk_kind VARCHAR(20) NOT NULL DEFAULT 'warehouse'
      CHECK (desk_kind IN ('warehouse', 'branch'));

  CREATE TABLE IF NOT EXISTS public.ic_branch_deposits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
      manager_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE RESTRICT,
      customer_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE RESTRICT,
      amount_aed NUMERIC(15, 4) NOT NULL CHECK (amount_aed > 0),
      deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      notes TEXT,
      entered_by_user_id VARCHAR(255),
      entered_by_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_ic_branch_deposits_branch ON public.ic_branch_deposits (branch_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ic_branch_deposits_customer ON public.ic_branch_deposits (customer_id, created_at DESC);

  ALTER TABLE public.ic_branch_deposits ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS asic_ic_branch_deposits_access ON public.ic_branch_deposits;
  CREATE POLICY asic_ic_branch_deposits_access ON public.ic_branch_deposits FOR ALL USING (true);
