-- Himmath IC greenfield schema + RLS for a NEW Supabase project.
-- Run this entire file in the SQL editor (once). Do not run RLS first.
-- Creates only IC Transfer / IC Funds / customers / warehouse / audit tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Branches ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.branches (
    id VARCHAR(50) PRIMARY KEY,
    slug VARCHAR(255) UNIQUE,
    name VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    trn VARCHAR(50),
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(255),
    location VARCHAR(255) NOT NULL DEFAULT '',
    manager_name VARCHAR(255) NOT NULL DEFAULT 'Unassigned',
    cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    gold_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    opening_gold_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    daily_pl DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Dubai',
    hidden_pages TEXT[] NOT NULL DEFAULT '{}',
    enabled_currencies TEXT[] NOT NULL DEFAULT '{AED}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    features JSONB NOT NULL DEFAULT '{"warehousePortal":true,"customerPortal":true}'::jsonb,
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ── Customers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'AED',
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON public.customers(branch_id);
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);

CREATE TABLE IF NOT EXISTS public.user_page_permissions (
    user_id VARCHAR(128) NOT NULL,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    page_id VARCHAR(50) NOT NULL,
    access_level VARCHAR(10) NOT NULL DEFAULT 'none' CHECK (access_level IN ('none', 'read', 'write')),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    PRIMARY KEY (user_id, branch_id, page_id)
);
CREATE INDEX IF NOT EXISTS idx_user_page_permissions_branch ON public.user_page_permissions(branch_id);

CREATE TABLE IF NOT EXISTS public.ic_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ic_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    commission NUMERIC(10, 2),
    region_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    email VARCHAR(255),
    address TEXT,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_suppliers_region ON public.ic_suppliers(region_id);
CREATE INDEX IF NOT EXISTS idx_ic_suppliers_branch ON public.ic_suppliers(branch_id);

CREATE TABLE IF NOT EXISTS public.ic_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    commission NUMERIC(10, 2),
    region_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    email VARCHAR(255),
    address TEXT,
    current_stock NUMERIC(15, 4) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    send_delivery_proof_to_customer BOOLEAN NOT NULL DEFAULT true,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_warehouses_region ON public.ic_warehouses(region_id);
CREATE INDEX IF NOT EXISTS idx_ic_warehouses_branch ON public.ic_warehouses(branch_id);

CREATE TABLE IF NOT EXISTS public.ic_rate_groups (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    sale_rate NUMERIC(28, 14) NOT NULL DEFAULT 0,
    conversion_rate NUMERIC(28, 14) NOT NULL DEFAULT 1,
    created_by_branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE SET NULL,
    pricing_config JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_rate_groups_created_by_branch ON public.ic_rate_groups(created_by_branch_id);

CREATE TABLE IF NOT EXISTS public.ic_rate_group_customers (
    group_id VARCHAR(50) REFERENCES public.ic_rate_groups(id) ON DELETE CASCADE,
    customer_id VARCHAR(50) REFERENCES public.customers(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.ic_rate_group_branches (
    group_id VARCHAR(50) REFERENCES public.ic_rate_groups(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.ic_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES public.ic_suppliers(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    unit_rate NUMERIC(15, 4) NOT NULL,
    units NUMERIC(15, 4) NOT NULL,
    payment_method VARCHAR(50),
    notes TEXT,
    converted_total NUMERIC(15, 4),
    aed_total NUMERIC(15, 4),
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_supplier ON public.ic_purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse ON public.ic_purchases(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_created ON public.ic_purchases(created_at);

CREATE TABLE IF NOT EXISTS public.ic_warehouse_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ic_delivery_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE CASCADE,
    account_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    region_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    group_id UUID REFERENCES public.ic_warehouse_groups(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_delivery_agents_warehouse ON public.ic_delivery_agents(warehouse_id);

CREATE TABLE IF NOT EXISTS public.ic_sub_customers (
    id VARCHAR(50) PRIMARY KEY,
    parent_customer_id VARCHAR(50) NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_sub_customers_parent ON public.ic_sub_customers(parent_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_sub_customers_parent_name ON public.ic_sub_customers(parent_customer_id, LOWER(name));

CREATE TABLE IF NOT EXISTS public.ic_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    order_customer_name VARCHAR(255),
    order_customer_id VARCHAR(255),
    sub_customer_id VARCHAR(50) REFERENCES public.ic_sub_customers(id) ON DELETE SET NULL,
    sub_customer_name VARCHAR(255),
    entered_by VARCHAR(255),
    entered_by_name VARCHAR(255),
    entered_by_user_id VARCHAR(255),
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    delivery_agent_id UUID REFERENCES public.ic_delivery_agents(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50),
    units NUMERIC(15, 4) NOT NULL,
    unit_rate NUMERIC(15, 4) NOT NULL,
    admin_unit_rate NUMERIC(15, 6),
    admin_conversion_rate NUMERIC(15, 6),
    converted_amount NUMERIC(15, 4),
    aed_amount NUMERIC(15, 4),
    bank TEXT,
    address TEXT,
    location TEXT,
    district TEXT,
    image_url TEXT,
    conversion_rate NUMERIC(15, 6) DEFAULT 1.0,
    currency VARCHAR(10) DEFAULT 'AED',
    service_charge NUMERIC(15, 4) DEFAULT 0.00,
    collected_units NUMERIC(15, 4) DEFAULT 0.00,
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('High', 'Normal', 'Low')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (order_status IN (
        'pending_branch_review', 'branch_rejected',
        'pending', 'accepted', 'admin_rejected', 'wh_rejected',
        'wh_processing', 'da_rejected', 'delivery_pending_admin',
        'cancellation_pending', 'cancelled', 'completed'
    )),
    rejection_remarks TEXT,
    status_updated_at TIMESTAMPTZ,
    status_updated_by VARCHAR(255),
    delivery_image_url TEXT,
    derived_from_sale_id UUID REFERENCES public.ic_sales(id) ON DELETE SET NULL,
    fulfillment_handler VARCHAR(20) NOT NULL DEFAULT 'hq_admin' CHECK (fulfillment_handler IN ('hq_admin', 'branch')),
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(80),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_sales_idempotency ON public.ic_sales (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_sales_user ON public.ic_sales(entered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse ON public.ic_sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_created ON public.ic_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_sales_order_status ON public.ic_sales(order_status);
CREATE INDEX IF NOT EXISTS idx_ic_sales_order_customer ON public.ic_sales(order_customer_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_delivery_agent ON public.ic_sales(delivery_agent_id);

CREATE TABLE IF NOT EXISTS public.ic_warehouse_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    units NUMERIC(15, 4) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_warehouse_tx_warehouse ON public.ic_warehouse_transactions(warehouse_id);

CREATE TABLE IF NOT EXISTS public.ic_transfer_settings (
    id VARCHAR(20) PRIMARY KEY DEFAULT 'global',
    sales_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_rate_reset_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);
INSERT INTO public.ic_transfer_settings (id, sales_enabled, auto_rate_reset_enabled)
VALUES ('global', true, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ic_fund_accounts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'd_expense')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    opening_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    customer_id VARCHAR(50) REFERENCES public.customers(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    source_type VARCHAR(30),
    source_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_name
    ON public.ic_fund_accounts (branch_id, LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_type
    ON public.ic_fund_accounts (branch_id, account_type, status);
CREATE INDEX IF NOT EXISTS idx_ic_fund_accounts_customer_id ON public.ic_fund_accounts(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_source
    ON public.ic_fund_accounts (branch_id, source_type, source_id)
    WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ic_fund_voucher_counters (
    branch_id VARCHAR(50) PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    last_no INTEGER NOT NULL DEFAULT 0
);

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

CREATE TABLE IF NOT EXISTS public.ic_fund_vouchers (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    voucher_no INTEGER NOT NULL,
    voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('payment', 'receipt', 'journal', 'contra')),
    voucher_date DATE NOT NULL,
    debit_account_id VARCHAR(50) NOT NULL REFERENCES public.ic_fund_accounts(id) ON DELETE RESTRICT,
    credit_account_id VARCHAR(50) NOT NULL REFERENCES public.ic_fund_accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    notes TEXT NOT NULL DEFAULT '',
    created_by VARCHAR(255),
    created_by_name VARCHAR(255),
    created_by_user_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
    voided_at TIMESTAMPTZ,
    voided_by_name VARCHAR(255),
    reference_type VARCHAR(30),
    reference_id VARCHAR(50),
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(80),
    CONSTRAINT ic_fund_voucher_distinct_accounts CHECK (debit_account_id <> credit_account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_no ON public.ic_fund_vouchers (branch_id, voucher_no);
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_date ON public.ic_fund_vouchers (branch_id, voucher_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_idempotency
    ON public.ic_fund_vouchers (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id VARCHAR(128),
    actor_email VARCHAR(255),
    actor_role VARCHAR(64),
    action VARCHAR(40) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(80),
    branch_id VARCHAR(50),
    before_json JSONB,
    after_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_branch ON public.audit_log (branch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    name TEXT,
    email TEXT,
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE SET NULL,
    customer_id VARCHAR(50) REFERENCES public.customers(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    delivery_agent_id UUID REFERENCES public.ic_delivery_agents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON public.profiles (branch_id);

-- ── RLS (after tables exist) ─────────────────────────────────────────
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_rate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_rate_group_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_rate_group_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_warehouse_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_delivery_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_sub_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_transfer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_voucher_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS asic_hq_all ON public.branches;
CREATE POLICY asic_hq_all ON public.branches FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS asic_member_read_branch ON public.branches;
CREATE POLICY asic_member_read_branch ON public.branches FOR SELECT USING (
  id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_profiles_self ON public.profiles;
CREATE POLICY asic_profiles_self ON public.profiles FOR SELECT USING (
  id = auth.uid() OR public.current_profile_role() IN ('admin', 'auditor')
);

DROP POLICY IF EXISTS asic_customers_access ON public.customers;
CREATE POLICY asic_customers_access ON public.customers FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
  OR auth_user_id = auth.uid()
);

DROP POLICY IF EXISTS asic_ic_sales_access ON public.ic_sales;
CREATE POLICY asic_ic_sales_access ON public.ic_sales FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR order_customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  OR warehouse_id IN (SELECT w.id FROM public.ic_warehouses w WHERE w.branch_id = public.current_profile_branch())
);

DROP POLICY IF EXISTS asic_vouchers_branch ON public.ic_fund_vouchers;
CREATE POLICY asic_vouchers_branch ON public.ic_fund_vouchers FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_accounts_branch ON public.ic_fund_accounts;
CREATE POLICY asic_accounts_branch ON public.ic_fund_accounts FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_audit_read ON public.audit_log;
CREATE POLICY asic_audit_read ON public.audit_log FOR SELECT USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR (public.current_profile_role() = 'branch_manager' AND branch_id = public.current_profile_branch())
);

DROP POLICY IF EXISTS asic_audit_insert ON public.audit_log;
CREATE POLICY asic_audit_insert ON public.audit_log FOR INSERT WITH CHECK (true);

-- Server uses the database role (bypasses RLS). Authenticated clients use policies above.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
