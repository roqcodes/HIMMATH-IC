-- Remove customer portal login, sub-customers, and legacy party login columns.
-- Policies must be recreated before dropping auth_user_id (policies from 20261101160000 reference it).

DROP TABLE IF EXISTS public.ic_sub_customers CASCADE;

ALTER TABLE public.ic_sales
  DROP COLUMN IF EXISTS sub_customer_id,
  DROP COLUMN IF EXISTS sub_customer_name;

DROP POLICY IF EXISTS asic_ic_sales_access ON public.ic_sales;
CREATE POLICY asic_ic_sales_access ON public.ic_sales FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR warehouse_id IN (
    SELECT w.id FROM public.ic_warehouses w
    WHERE w.branch_id = public.current_profile_branch()
  )
);

DROP POLICY IF EXISTS asic_counterparties_access ON public.ic_counterparties;
CREATE POLICY asic_counterparties_access ON public.ic_counterparties FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

ALTER TABLE public.ic_counterparties DROP COLUMN IF EXISTS auth_user_id;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS counterparty_id;
