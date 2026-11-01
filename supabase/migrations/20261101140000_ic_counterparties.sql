-- Unified trading counterparties (same party on purchase payable + sale receivable).

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
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    legacy_customer_id VARCHAR(50),
    legacy_supplier_id UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_counterparties_legacy_customer
  ON public.ic_counterparties (legacy_customer_id)
  WHERE legacy_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_counterparties_legacy_supplier
  ON public.ic_counterparties (legacy_supplier_id)
  WHERE legacy_supplier_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ic_counterparties_scope_code
  ON public.ic_counterparties (COALESCE(branch_id, ''), lower(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';

CREATE INDEX IF NOT EXISTS idx_ic_counterparties_branch
  ON public.ic_counterparties (branch_id);

-- Customers → counterparties
INSERT INTO public.ic_counterparties (
    branch_id, name, code, phone, email, country, subdivision, locality,
    status, auth_user_id, legacy_customer_id, created_at
)
SELECT
    branch_id, name, code, phone, email, country, subdivision, locality,
    status, auth_user_id, id, created_at
FROM public.customers c
WHERE NOT EXISTS (
    SELECT 1 FROM public.ic_counterparties cp WHERE cp.legacy_customer_id = c.id
);

-- Suppliers with matching code + branch merge onto existing counterparty
UPDATE public.ic_counterparties c
SET
    legacy_supplier_id = s.id,
    commission = COALESCE(s.commission, c.commission),
    address = COALESCE(NULLIF(btrim(c.address), ''), s.address),
    region_id = COALESCE(c.region_id, s.region_id),
    phone = COALESCE(NULLIF(btrim(c.phone), ''), s.phone),
    email = COALESCE(NULLIF(btrim(c.email), ''), s.email)
FROM public.ic_suppliers s
WHERE c.legacy_supplier_id IS NULL
  AND s.code IS NOT NULL AND btrim(s.code) <> ''
  AND c.code IS NOT NULL AND btrim(c.code) <> ''
  AND lower(btrim(c.code)) = lower(btrim(s.code))
  AND COALESCE(c.branch_id, '') = COALESCE(s.branch_id, '');

-- Remaining suppliers → new counterparties
INSERT INTO public.ic_counterparties (
    branch_id, name, code, phone, email, address, commission, region_id,
    country, subdivision, locality, legacy_supplier_id, created_at
)
SELECT
    s.branch_id, s.name, s.code, s.phone, s.email, s.address, s.commission, s.region_id,
    s.country, s.subdivision, s.locality, s.id, s.created_at
FROM public.ic_suppliers s
WHERE NOT EXISTS (
    SELECT 1 FROM public.ic_counterparties cp
    WHERE cp.legacy_supplier_id = s.id
);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

UPDATE public.customers cu
SET counterparty_id = cp.id
FROM public.ic_counterparties cp
WHERE cp.legacy_customer_id = cu.id
  AND cu.counterparty_id IS NULL;

ALTER TABLE public.ic_purchases
  ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

UPDATE public.ic_purchases p
SET counterparty_id = cp.id
FROM public.ic_counterparties cp
WHERE p.counterparty_id IS NULL
  AND cp.legacy_supplier_id = p.supplier_id;

ALTER TABLE public.ic_sales
  ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES public.ic_counterparties(id) ON DELETE SET NULL;

UPDATE public.ic_sales s
SET counterparty_id = cp.id
FROM public.ic_counterparties cp
WHERE s.counterparty_id IS NULL
  AND s.order_customer_id IS NOT NULL
  AND cp.legacy_customer_id = s.order_customer_id;

CREATE INDEX IF NOT EXISTS idx_ic_purchases_counterparty
  ON public.ic_purchases (counterparty_id);

CREATE INDEX IF NOT EXISTS idx_ic_sales_counterparty
  ON public.ic_sales (counterparty_id);

-- Point fund accounts at the unified counterparty (supplier rows win id when merged)
UPDATE public.ic_fund_accounts a
SET
    source_type = 'ic_counterparty',
    source_id = cp.id::text,
    customer_id = COALESCE(a.customer_id, cp.legacy_customer_id)
FROM public.ic_counterparties cp
WHERE a.source_type = 'ic_supplier'
  AND a.source_id = cp.legacy_supplier_id::text;

UPDATE public.ic_fund_accounts a
SET
    source_type = 'ic_counterparty',
    source_id = cp.id::text
FROM public.ic_counterparties cp
WHERE a.source_type = 'ic_customer'
  AND (a.source_id = cp.legacy_customer_id OR a.customer_id = cp.legacy_customer_id);

ALTER TABLE public.ic_counterparties ENABLE ROW LEVEL SECURITY;
