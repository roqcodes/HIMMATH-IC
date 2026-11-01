-- Counterparty-only: retire customers + ic_suppliers tables.
-- Idempotent: skips backfill steps when legacy tables/columns are already gone.

ALTER TABLE public.ic_counterparties
  ADD COLUMN IF NOT EXISTS balance NUMERIC(15, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF to_regclass('public.customers') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'legacy_customer_id'
     ) THEN
    UPDATE public.ic_counterparties cp
    SET balance = c.balance
    FROM public.customers c
    WHERE cp.legacy_customer_id = c.id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ic_rate_group_counterparties (
    group_id VARCHAR(50) NOT NULL REFERENCES public.ic_rate_groups(id) ON DELETE CASCADE,
    counterparty_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, counterparty_id)
);

DO $$
BEGIN
  IF to_regclass('public.ic_rate_group_customers') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'legacy_customer_id'
     ) THEN
    INSERT INTO public.ic_rate_group_counterparties (group_id, counterparty_id)
    SELECT rgc.group_id, cp.id
    FROM public.ic_rate_group_customers rgc
    JOIN public.ic_counterparties cp ON cp.legacy_customer_id = rgc.customer_id
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS public.ic_rate_group_customers;

DO $$
BEGIN
  IF to_regclass('public.ic_sub_customers') IS NOT NULL THEN
    ALTER TABLE public.ic_sub_customers
      ADD COLUMN IF NOT EXISTS parent_counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE CASCADE;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ic_sub_customers' AND column_name = 'parent_customer_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'legacy_customer_id'
    ) THEN
      UPDATE public.ic_sub_customers sc
      SET parent_counterparty_id = cp.id
      FROM public.ic_counterparties cp
      WHERE sc.parent_counterparty_id IS NULL
        AND cp.legacy_customer_id = sc.parent_customer_id;
    END IF;

    ALTER TABLE public.ic_sub_customers DROP CONSTRAINT IF EXISTS ic_sub_customers_parent_customer_id_fkey;
    ALTER TABLE public.ic_sub_customers DROP COLUMN IF EXISTS parent_customer_id;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'customer_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'legacy_customer_id'
  ) THEN
    UPDATE public.profiles p
    SET counterparty_id = cp.id
    FROM public.ic_counterparties cp
    WHERE p.counterparty_id IS NULL
      AND p.customer_id IS NOT NULL
      AND cp.legacy_customer_id = p.customer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'auth_user_id'
  ) THEN
    UPDATE public.profiles p
    SET counterparty_id = cp.id
    FROM public.ic_counterparties cp
    WHERE p.counterparty_id IS NULL
      AND cp.auth_user_id = p.id;
  END IF;
END $$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_customer_id_fkey;
ALTER TABLE public.ic_fund_accounts DROP CONSTRAINT IF EXISTS ic_fund_accounts_customer_id_fkey;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS customer_id;
ALTER TABLE public.ic_fund_accounts DROP COLUMN IF EXISTS customer_id;

DO $$
BEGIN
  IF to_regclass('public.customers') IS NOT NULL THEN
    ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_counterparty_id_fkey;
    ALTER TABLE public.customers DROP COLUMN IF EXISTS counterparty_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ic_sales' AND column_name = 'order_customer_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'legacy_customer_id'
  ) THEN
    UPDATE public.ic_sales s
    SET counterparty_id = cp.id
    FROM public.ic_counterparties cp
    WHERE s.counterparty_id IS NULL
      AND s.order_customer_id IS NOT NULL
      AND cp.legacy_customer_id = s.order_customer_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ic_purchases' AND column_name = 'supplier_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ic_counterparties' AND column_name = 'legacy_supplier_id'
  ) THEN
    UPDATE public.ic_purchases p
    SET counterparty_id = cp.id
    FROM public.ic_counterparties cp
    WHERE p.counterparty_id IS NULL
      AND p.supplier_id IS NOT NULL
      AND cp.legacy_supplier_id = p.supplier_id;
  END IF;
END $$;

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_supplier_id_fkey;
ALTER TABLE public.ic_purchases DROP COLUMN IF EXISTS supplier_id;

DROP POLICY IF EXISTS asic_ic_sales_access ON public.ic_sales;
CREATE POLICY asic_ic_sales_access ON public.ic_sales FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR warehouse_id IN (SELECT w.id FROM public.ic_warehouses w WHERE w.branch_id = public.current_profile_branch())
);

ALTER TABLE public.ic_sales DROP COLUMN IF EXISTS order_customer_id;

ALTER TABLE public.ic_counterparties DROP COLUMN IF EXISTS legacy_customer_id;
ALTER TABLE public.ic_counterparties DROP COLUMN IF EXISTS legacy_supplier_id;

DO $$
BEGIN
  IF to_regclass('public.customers') IS NOT NULL THEN
    DROP POLICY IF EXISTS asic_customers_access ON public.customers;
  END IF;
END $$;

DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.ic_suppliers CASCADE;

ALTER TABLE public.ic_counterparties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asic_counterparties_access ON public.ic_counterparties;
CREATE POLICY asic_counterparties_access ON public.ic_counterparties FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);
