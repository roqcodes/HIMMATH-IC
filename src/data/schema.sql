-- Himmath IC full greenfield bootstrap for a NEW Supabase project (single run).
-- Supabase Dashboard → SQL → New query → paste this entire file → Run.
-- Includes: tables, indexes, seed HQ branch, RLS helper functions, policies, grants.
-- No database triggers. Auth users / profiles are created by the app, not this script.

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
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    features JSONB NOT NULL DEFAULT '{"warehousePortal":true,"customerPortal":false}'::jsonb,
    last_activity TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS public.ic_counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    commission NUMERIC(10, 2),
    region_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    country VARCHAR(100),
    subdivision VARCHAR(255),
    locality VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    kind VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (kind IN ('manager', 'customer', 'agent')),
    home_manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opening_aed NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opening_inr NUMERIC(28, 2) NOT NULL DEFAULT 0,
    roles TEXT[] NOT NULL DEFAULT ARRAY['supplier', 'party']::TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ic_counterparties_roles_check CHECK (
      roles <@ ARRAY['supplier', 'party', 'agent']::TEXT[]
      AND (
        (kind IN ('manager', 'agent') AND cardinality(roles) = 0)
        OR (kind = 'customer' AND cardinality(roles) >= 1)
      )
    )
);
CREATE INDEX IF NOT EXISTS idx_ic_counterparties_kind ON public.ic_counterparties (kind);
CREATE INDEX IF NOT EXISTS idx_ic_counterparties_home_manager
  ON public.ic_counterparties (home_manager_id) WHERE home_manager_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_counterparties_scope_code
  ON public.ic_counterparties (COALESCE(branch_id, ''), lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';
CREATE INDEX IF NOT EXISTS idx_ic_counterparties_branch ON public.ic_counterparties (branch_id);

CREATE TABLE IF NOT EXISTS public.ic_warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(32),
    phone VARCHAR(50),
    commission NUMERIC(10, 2),
    region_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    email VARCHAR(255),
    address TEXT,
    india_state VARCHAR(100),
    india_city VARCHAR(100),
    current_stock NUMERIC(15, 4) NOT NULL DEFAULT 0,
    current_metal_g NUMERIC(15, 4) NOT NULL DEFAULT 0,
    opening_stock NUMERIC(15, 4) NOT NULL DEFAULT 0,
    opening_metal_g NUMERIC(15, 4) NOT NULL DEFAULT 0,
    opening_aed NUMERIC(15, 2) NOT NULL DEFAULT 0,
    opening_inr NUMERIC(28, 2) NOT NULL DEFAULT 0,
    send_delivery_proof_to_customer BOOLEAN NOT NULL DEFAULT true,
    desk_kind VARCHAR(20) NOT NULL DEFAULT 'warehouse' CHECK (desk_kind IN ('warehouse', 'branch')),
    branch_id VARCHAR(50) REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_warehouses_region ON public.ic_warehouses(region_id);
CREATE INDEX IF NOT EXISTS idx_ic_warehouses_branch ON public.ic_warehouses(branch_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_warehouses_scope_code
  ON public.ic_warehouses (COALESCE(branch_id, ''), lower(btrim(code)))

CREATE TABLE IF NOT EXISTS public.ic_warehouse_managers (
    warehouse_id UUID NOT NULL REFERENCES public.ic_warehouses(id) ON DELETE CASCADE,
    manager_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE CASCADE,
    PRIMARY KEY (warehouse_id, manager_id)
);
CREATE INDEX IF NOT EXISTS idx_ic_warehouse_managers_manager
  ON public.ic_warehouse_managers (manager_id);

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

CREATE TABLE IF NOT EXISTS public.ic_rate_groups (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    sale_rate NUMERIC(28, 14) NOT NULL DEFAULT 0,
    pricing_config JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ic_rate_group_counterparties (
    group_id VARCHAR(50) NOT NULL REFERENCES public.ic_rate_groups(id) ON DELETE CASCADE,
    counterparty_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, counterparty_id)
);

CREATE TABLE IF NOT EXISTS public.ic_rate_group_branches (
    group_id VARCHAR(50) NOT NULL REFERENCES public.ic_rate_groups(id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_ic_rate_group_branches_branch ON public.ic_rate_group_branches (branch_id);

CREATE TABLE IF NOT EXISTS public.ic_branch_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    ic_branch_id UUID REFERENCES public.ic_branches(id) ON DELETE RESTRICT,
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    manager_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES public.ic_counterparties(id) ON DELETE RESTRICT,
    settlement_mode VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (settlement_mode IN ('cash', 'metal')),
    amount_aed NUMERIC(15, 2) NOT NULL CHECK (amount_aed > 0),
    metal_weight_g NUMERIC(15, 4),
    metal_rate_aed_per_g NUMERIC(15, 4),
    deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    entered_by_user_id VARCHAR(255),
    entered_by_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_branch_deposits_branch ON public.ic_branch_deposits (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_branch_deposits_ic_branch ON public.ic_branch_deposits (ic_branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_branch_deposits_customer ON public.ic_branch_deposits (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ic_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    location_id UUID REFERENCES public.ic_regions(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    unit_rate NUMERIC(15, 4) NOT NULL,
    units NUMERIC(15, 4) NOT NULL,
    payment_method VARCHAR(50),
    notes TEXT,
    aed_total NUMERIC(15, 2),
    payment_status VARCHAR(20) DEFAULT 'paid',
    settlement_mode VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (settlement_mode IN ('cash', 'metal')),
    metal_weight_g NUMERIC(15, 4),
    metal_rate_inr_per_g NUMERIC(15, 4),
    metal_rate_aed_per_g NUMERIC(15, 4),
    inr_total NUMERIC(15, 2),
    split_inr_paid NUMERIC(15, 2),
    split_aed_paid NUMERIC(15, 2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_counterparty ON public.ic_purchases(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse ON public.ic_purchases(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_created ON public.ic_purchases(created_at);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse_created
  ON public.ic_purchases (warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_purchases_settlement_created
  ON public.ic_purchases (settlement_mode, created_at DESC);

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

CREATE TABLE IF NOT EXISTS public.ic_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL,
    order_customer_name VARCHAR(255),
    counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    entered_by VARCHAR(255),
    entered_by_name VARCHAR(255),
    entered_by_user_id VARCHAR(255),
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    delivery_agent_id UUID REFERENCES public.ic_delivery_agents(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50),
    units NUMERIC(15, 4) NOT NULL,
    unit_rate NUMERIC(15, 4) NOT NULL,
    aed_amount NUMERIC(15, 2),
    bank TEXT,
    address TEXT,
    image_url TEXT,
    service_charge NUMERIC(15, 2) DEFAULT 0.00,
    collected_units NUMERIC(15, 4) DEFAULT 0.00,
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('High', 'Normal', 'Low')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
    order_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (order_status IN (
        'pending', 'accepted', 'admin_rejected', 'wh_rejected',
        'wh_processing', 'da_rejected', 'delivery_pending_admin',
        'cancellation_pending', 'cancelled', 'completed'
    )),
    rejection_remarks TEXT,
    status_updated_at TIMESTAMPTZ,
    status_updated_by VARCHAR(255),
    delivery_image_url TEXT,
    derived_from_sale_id UUID REFERENCES public.ic_sales(id) ON DELETE SET NULL,
    fulfillment_handler VARCHAR(20) NOT NULL DEFAULT 'hq_admin' CHECK (fulfillment_handler IN ('hq_admin')),
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(80),
    settlement_mode VARCHAR(20) NOT NULL DEFAULT 'cash' CHECK (settlement_mode IN ('cash', 'metal')),
    metal_weight_g NUMERIC(15, 4),
    metal_rate_inr_per_g NUMERIC(15, 4),
    metal_rate_aed_per_g NUMERIC(15, 4),
    inr_total NUMERIC(15, 2),
    metal_purchase_id UUID REFERENCES public.ic_purchases(id) ON DELETE RESTRICT,
    metal_payment_method VARCHAR(10) CHECK (metal_payment_method IS NULL OR metal_payment_method IN ('INR', 'AED', 'CASH', 'SPLIT')),
    split_inr_paid NUMERIC(15, 2),
    split_aed_paid NUMERIC(15, 2),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_sales_idempotency ON public.ic_sales (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_sales_user ON public.ic_sales(entered_by_user_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse ON public.ic_sales(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_created ON public.ic_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_sales_settlement_created
  ON public.ic_sales (settlement_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_sales_metal_purchase
  ON public.ic_sales (metal_purchase_id)
  WHERE metal_purchase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_purchases_warehouse_metal
  ON public.ic_purchases (warehouse_id, created_at DESC)
  WHERE settlement_mode = 'metal';
CREATE INDEX IF NOT EXISTS idx_ic_sales_order_status ON public.ic_sales(order_status);
CREATE INDEX IF NOT EXISTS idx_ic_sales_counterparty ON public.ic_sales(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_delivery_agent ON public.ic_sales(delivery_agent_id);
CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse_status_created
  ON public.ic_sales (warehouse_id, order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_sales_warehouse_completed_at
  ON public.ic_sales (warehouse_id, order_status, status_updated_at)
  WHERE order_status = 'completed';

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
CREATE INDEX IF NOT EXISTS idx_ic_warehouse_tx_reference
  ON public.ic_warehouse_transactions (reference_type, reference_id);

CREATE TABLE IF NOT EXISTS public.ic_transfer_settings (
    id VARCHAR(20) PRIMARY KEY DEFAULT 'global',
    sales_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_rate_reset_enabled BOOLEAN NOT NULL DEFAULT false,
    warehouse_fulfillment_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);
INSERT INTO public.ic_transfer_settings (id, sales_enabled, auto_rate_reset_enabled, warehouse_fulfillment_enabled)
VALUES ('global', true, false, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ic_fund_accounts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'd_expense', 'capital')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    phone VARCHAR(50),
    source_type VARCHAR(30),
    source_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_name
    ON public.ic_fund_accounts (branch_id, LOWER(TRIM(name)));
CREATE INDEX IF NOT EXISTS idx_ic_fund_accounts_branch_type
    ON public.ic_fund_accounts (branch_id, account_type, status);
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
    amount DECIMAL(28, 2) NOT NULL CHECK (amount > 0),
    notes TEXT NOT NULL DEFAULT '',
    created_by VARCHAR(255),
    created_by_name VARCHAR(255),
    created_by_user_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'void')),
    voided_at TIMESTAMPTZ,
    voided_by_name VARCHAR(255),
    reference_type VARCHAR(30),
    reference_id VARCHAR(80),
    version INTEGER NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(80),
    manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL,
    CONSTRAINT ic_fund_voucher_distinct_accounts CHECK (debit_account_id <> credit_account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_no ON public.ic_fund_vouchers (branch_id, voucher_no);
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_date ON public.ic_fund_vouchers (branch_id, voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_created
  ON public.ic_fund_vouchers (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_user_created
  ON public.ic_fund_vouchers (branch_id, created_by_user_id, created_at DESC)
  WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_status_debit
  ON public.ic_fund_vouchers (branch_id, status, debit_account_id);
CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_branch_status_credit
  ON public.ic_fund_vouchers (branch_id, status, credit_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_idempotency
    ON public.ic_fund_vouchers (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_fund_vouchers_active_ref
  ON public.ic_fund_vouchers (branch_id, reference_type, reference_id)
  WHERE status IN ('active', 'pending')
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;

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
    warehouse_id UUID REFERENCES public.ic_warehouses(id) ON DELETE SET NULL,
    delivery_agent_id UUID REFERENCES public.ic_delivery_agents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_branch ON public.profiles (branch_id);

CREATE TABLE IF NOT EXISTS public.asic_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128),
    created_by_email VARCHAR(255),
    destination VARCHAR(20) NOT NULL CHECK (destination IN ('local', 'db')),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('full', 'custom')),
    date_filter VARCHAR(40) NOT NULL DEFAULT 'all-time',
    start_date DATE,
    end_date DATE,
    tables TEXT[] NOT NULL DEFAULT '{}',
    row_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_size_bytes INTEGER NOT NULL DEFAULT 0,
    filename VARCHAR(255) NOT NULL,
    payload JSONB,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_asic_backups_created ON public.asic_backups (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ic_aed_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS metal_payment_method VARCHAR(10),
  ADD COLUMN IF NOT EXISTS aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_inr_paid NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS split_aed_paid NUMERIC(15, 2);

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS split_inr_paid NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS split_aed_paid NUMERIC(15, 2);

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL;

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS lab_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_charge_inr_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_total_inr NUMERIC(15, 2);

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS lab_weight_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_charge_inr_per_g NUMERIC(15, 4),
  ADD COLUMN IF NOT EXISTS lab_total_inr NUMERIC(15, 2);

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_metal_payment_method_check;
ALTER TABLE public.ic_purchases
  ADD CONSTRAINT ic_purchases_metal_payment_method_check
  CHECK (
    metal_payment_method IS NULL
    OR metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
  );

ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_metal_payment_method_check;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_metal_payment_method_check
  CHECK (
    metal_payment_method IS NULL
    OR metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
  );

ALTER TABLE public.ic_purchases DROP CONSTRAINT IF EXISTS ic_purchases_metal_payment_shape;
ALTER TABLE public.ic_purchases
  ADD CONSTRAINT ic_purchases_metal_payment_shape
  CHECK (
    (settlement_mode = 'cash' AND metal_payment_method IS NULL AND aed_agent_id IS NULL)
    OR (
      settlement_mode = 'metal'
      AND metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
      AND (
        (metal_payment_method IN ('CASH', 'INR') AND aed_agent_id IS NULL AND aed_total IS NULL
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL AND aed_total IS NOT NULL AND aed_total > 0
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'SPLIT' AND aed_agent_id IS NOT NULL AND aed_total IS NOT NULL AND aed_total > 0
          AND split_inr_paid IS NOT NULL AND split_inr_paid > 0
          AND split_aed_paid IS NOT NULL AND split_aed_paid > 0)
      )
    )
  );

ALTER TABLE public.ic_sales DROP CONSTRAINT IF EXISTS ic_sales_metal_payment_shape;
ALTER TABLE public.ic_sales
  ADD CONSTRAINT ic_sales_metal_payment_shape
  CHECK (
    (settlement_mode = 'cash' AND metal_payment_method IS NULL AND aed_agent_id IS NULL)
    OR (
      settlement_mode = 'metal'
      AND metal_payment_method IN ('CASH', 'AED', 'INR', 'SPLIT')
      AND (
        (metal_payment_method IN ('CASH', 'INR') AND aed_agent_id IS NULL
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'AED' AND aed_agent_id IS NOT NULL AND aed_amount IS NOT NULL AND aed_amount > 0
          AND split_inr_paid IS NULL AND split_aed_paid IS NULL)
        OR (metal_payment_method = 'SPLIT' AND aed_agent_id IS NOT NULL AND aed_amount IS NOT NULL AND aed_amount > 0
          AND split_inr_paid IS NOT NULL AND split_inr_paid > 0
          AND split_aed_paid IS NOT NULL AND split_aed_paid > 0)
      )
    )
  );

CREATE TABLE IF NOT EXISTS public.inr_fund_accounts (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'inventory', 'd_expense', 'capital')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    opening_balance DECIMAL(28, 2) NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(30),
    source_id VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.inr_fund_voucher_counters (
    branch_id VARCHAR(50) PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    last_no INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.inr_fund_vouchers (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    voucher_no INTEGER NOT NULL,
    voucher_type VARCHAR(20) NOT NULL CHECK (voucher_type IN ('payment', 'receipt', 'journal', 'contra')),
    voucher_date DATE NOT NULL,
    debit_account_id VARCHAR(50) NOT NULL REFERENCES public.inr_fund_accounts(id) ON DELETE RESTRICT,
    credit_account_id VARCHAR(50) NOT NULL REFERENCES public.inr_fund_accounts(id) ON DELETE RESTRICT,
    amount DECIMAL(28, 2) NOT NULL CHECK (amount > 0),
    notes TEXT NOT NULL DEFAULT '',
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
    voided_at TIMESTAMPTZ,
    reference_type VARCHAR(30),
    reference_id VARCHAR(80),
    manager_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL,
    aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL,
    CONSTRAINT inr_fund_voucher_distinct_accounts CHECK (debit_account_id <> credit_account_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inr_fund_vouchers_active_ref
  ON public.inr_fund_vouchers (branch_id, reference_type, reference_id)
  WHERE status = 'active'
    AND reference_type IS NOT NULL
    AND reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_branch_status_debit
  ON public.inr_fund_vouchers (branch_id, status, debit_account_id);
CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_branch_status_credit
  ON public.inr_fund_vouchers (branch_id, status, credit_account_id);

CREATE TABLE IF NOT EXISTS public.ic_capital_settings (
    id VARCHAR(20) PRIMARY KEY DEFAULT 'hq',
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE DEFAULT 'branch_hq',
    opening_aed DECIMAL(28, 2) NOT NULL DEFAULT 0,
    opening_inr DECIMAL(28, 2) NOT NULL DEFAULT 0,
    opening_inr_per_aed DECIMAL(28, 14) NOT NULL DEFAULT 0,
    management_share_bps INTEGER NOT NULL DEFAULT 0 CHECK (management_share_bps >= 0 AND management_share_bps <= 10000),
    management_investor_id VARCHAR(50),
    opening_locked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO public.ic_capital_settings (id, branch_id)
VALUES ('hq', 'branch_hq')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ic_capital_investors (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE DEFAULT 'branch_hq',
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_house BOOLEAN NOT NULL DEFAULT false,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_capital_investors_house
  ON public.ic_capital_investors (branch_id)
  WHERE is_house = true;

CREATE TABLE IF NOT EXISTS public.ic_capital_lots (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    investor_id VARCHAR(50) NOT NULL REFERENCES public.ic_capital_investors(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('opening', 'deposit', 'withdraw', 'payout')),
    book VARCHAR(3) NOT NULL CHECK (book IN ('AED', 'INR')),
    lot_date DATE NOT NULL,
    amount_native DECIMAL(28, 2) NOT NULL,
    inr_per_aed DECIMAL(28, 14) NOT NULL DEFAULT 1 CHECK (inr_per_aed > 0),
    aed_eq DECIMAL(28, 2) NOT NULL,
    bank_account_id VARCHAR(50),
    voucher_id VARCHAR(50) NOT NULL,
    voucher_book VARCHAR(3) NOT NULL CHECK (voucher_book IN ('AED', 'INR')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void'))
);
CREATE INDEX IF NOT EXISTS idx_ic_capital_lots_branch_date
  ON public.ic_capital_lots (branch_id, lot_date, created_at);

CREATE TABLE IF NOT EXISTS public.ic_capital_allocations (
    id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    source_voucher_id VARCHAR(50) NOT NULL,
    source_book VARCHAR(3) NOT NULL CHECK (source_book IN ('AED', 'INR')),
    source_voucher_date DATE NOT NULL,
    investor_id VARCHAR(50) NOT NULL REFERENCES public.ic_capital_investors(id) ON DELETE RESTRICT,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('profit', 'expense', 'management', 'payout')),
    event_amount DECIMAL(28, 2) NOT NULL,
    allocated_amount DECIMAL(28, 2) NOT NULL,
    book VARCHAR(3) NOT NULL CHECK (book IN ('AED', 'INR')),
    management_bps_snapshot INTEGER NOT NULL DEFAULT 0,
    capital_share_bps_snapshot INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_capital_alloc_voucher_investor
  ON public.ic_capital_allocations (source_voucher_id, source_book, investor_id, kind)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ic_capital_alloc_branch_investor
  ON public.ic_capital_allocations (branch_id, investor_id)
  WHERE status = 'active';

-- ── RLS (after tables exist) ─────────────────────────────────────────
ALTER TABLE public.ic_aed_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inr_fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inr_fund_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_warehouse_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_branch_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_rate_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_rate_group_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_rate_group_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_warehouse_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_delivery_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_transfer_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_fund_voucher_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asic_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ic_capital_allocations ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS asic_counterparties_access ON public.ic_counterparties;
CREATE POLICY asic_counterparties_access ON public.ic_counterparties FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_ic_warehouse_managers_access ON public.ic_warehouse_managers;
CREATE POLICY asic_ic_warehouse_managers_access ON public.ic_warehouse_managers FOR ALL USING (true);

DROP POLICY IF EXISTS asic_ic_branches_access ON public.ic_branches;
CREATE POLICY asic_ic_branches_access ON public.ic_branches FOR ALL USING (true);

DROP POLICY IF EXISTS asic_ic_branch_managers_access ON public.ic_branch_managers;
CREATE POLICY asic_ic_branch_managers_access ON public.ic_branch_managers FOR ALL USING (true);

DROP POLICY IF EXISTS asic_ic_branch_deposits_access ON public.ic_branch_deposits;
CREATE POLICY asic_ic_branch_deposits_access ON public.ic_branch_deposits FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_ic_sales_access ON public.ic_sales;
CREATE POLICY asic_ic_sales_access ON public.ic_sales FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
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
);

DROP POLICY IF EXISTS asic_audit_insert ON public.audit_log;
CREATE POLICY asic_audit_insert ON public.audit_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS asic_backups_hq ON public.asic_backups;
CREATE POLICY asic_backups_hq ON public.asic_backups FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS asic_capital_settings ON public.ic_capital_settings;
CREATE POLICY asic_capital_settings ON public.ic_capital_settings FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS asic_capital_investors ON public.ic_capital_investors;
CREATE POLICY asic_capital_investors ON public.ic_capital_investors FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS asic_capital_lots ON public.ic_capital_lots;
CREATE POLICY asic_capital_lots ON public.ic_capital_lots FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS asic_capital_allocations ON public.ic_capital_allocations;
CREATE POLICY asic_capital_allocations ON public.ic_capital_allocations FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
) WITH CHECK (public.current_profile_role() IN ('admin', 'auditor'));

DROP POLICY IF EXISTS asic_warehouses_branch ON public.ic_warehouses;
CREATE POLICY asic_warehouses_branch ON public.ic_warehouses FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR branch_id = public.current_profile_branch()
);

DROP POLICY IF EXISTS asic_delivery_agents_branch ON public.ic_delivery_agents;
CREATE POLICY asic_delivery_agents_branch ON public.ic_delivery_agents FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR warehouse_id IN (
    SELECT w.id FROM public.ic_warehouses w
    WHERE w.branch_id = public.current_profile_branch()
  )
);

DROP POLICY IF EXISTS asic_user_page_permissions ON public.user_page_permissions;
CREATE POLICY asic_user_page_permissions ON public.user_page_permissions FOR ALL USING (
  public.current_profile_role() IN ('admin', 'auditor')
  OR user_id = auth.uid()::text
);

-- Server uses the database role (bypasses RLS). Authenticated clients use policies above.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
