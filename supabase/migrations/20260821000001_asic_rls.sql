-- Himmath IC RLS. Run AFTER 20260821000000_asic_schema.sql on a new Supabase project.
-- Enable PITR in the dashboard (Pro). Restore: Dashboard → Database → Backups.

ALTER TABLE public.ic_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_delivery_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_profile_branch()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS branches_admin_write ON public.branches;
CREATE POLICY branches_admin_write ON public.branches
  FOR ALL USING (public.current_profile_role() IN ('admin', 'auditor'))
  WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS branches_member_read ON public.branches;
CREATE POLICY branches_member_read ON public.branches
  FOR SELECT USING (id = public.current_profile_branch());

DROP POLICY IF EXISTS customers_branch_access ON public.customers;
CREATE POLICY customers_branch_access ON public.customers
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR branch_id = public.current_profile_branch()
    OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS ic_sales_access ON public.ic_sales;
CREATE POLICY ic_sales_access ON public.ic_sales
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR order_customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR warehouse_id IN (
      SELECT w.id FROM public.ic_warehouses w
      WHERE w.branch_id = public.current_profile_branch()
    )
  );

DROP POLICY IF EXISTS ic_fund_vouchers_branch ON public.ic_fund_vouchers;
CREATE POLICY ic_fund_vouchers_branch ON public.ic_fund_vouchers
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR branch_id = public.current_profile_branch()
  );

DROP POLICY IF EXISTS ic_fund_accounts_branch ON public.ic_fund_accounts;
CREATE POLICY ic_fund_accounts_branch ON public.ic_fund_accounts
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR branch_id = public.current_profile_branch()
  );

DROP POLICY IF EXISTS audit_log_read ON public.audit_log;
CREATE POLICY audit_log_read ON public.audit_log
  FOR SELECT USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR (public.current_profile_role() = 'branch_manager' AND branch_id = public.current_profile_branch())
  );

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS profiles_self ON public.profiles;
CREATE POLICY profiles_self ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS warehouses_branch ON public.ic_warehouses;
CREATE POLICY warehouses_branch ON public.ic_warehouses
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR branch_id = public.current_profile_branch()
  );

DROP POLICY IF EXISTS delivery_agents_branch ON public.ic_delivery_agents;
CREATE POLICY delivery_agents_branch ON public.ic_delivery_agents
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor')
    OR warehouse_id IN (
      SELECT w.id FROM public.ic_warehouses w
      WHERE w.branch_id = public.current_profile_branch()
    )
  );

DROP POLICY IF EXISTS user_page_permissions_access ON public.user_page_permissions;
CREATE POLICY user_page_permissions_access ON public.user_page_permissions
  FOR ALL USING (
    public.current_profile_role() IN ('admin', 'auditor', 'branch_manager')
    OR user_id = auth.uid()::text
  );
