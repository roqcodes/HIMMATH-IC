-- Per-sale FX settlement rows for Type 2 profit (collection agent = ic_fund_accounts.account_type collection_agent).

CREATE TABLE IF NOT EXISTS public.ic_sale_fx_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.ic_sales(id) ON DELETE RESTRICT,
  collection_account_id VARCHAR(50) NOT NULL REFERENCES public.ic_fund_accounts(id) ON DELETE RESTRICT,
  currency VARCHAR(10) NOT NULL,
  paid_foreign NUMERIC(15, 4) NOT NULL CHECK (paid_foreign > 0),
  settlement_rate NUMERIC(28, 14) NOT NULL CHECK (settlement_rate > 0),
  sale_conversion_rate NUMERIC(28, 14) NOT NULL CHECK (sale_conversion_rate > 0),
  settled_aed NUMERIC(15, 4) NOT NULL,
  booked_aed NUMERIC(15, 4) NOT NULL,
  type2_profit_aed NUMERIC(15, 4) NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  entered_by VARCHAR(255),
  entered_by_name VARCHAR(255),
  receipt_voucher_id VARCHAR(50) REFERENCES public.ic_fund_vouchers(id) ON DELETE SET NULL,
  profit_voucher_id VARCHAR(50) REFERENCES public.ic_fund_vouchers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ic_sale_fx_settlements_sale
  ON public.ic_sale_fx_settlements (sale_id, settled_at DESC);

CREATE INDEX IF NOT EXISTS idx_ic_sale_fx_settlements_account
  ON public.ic_sale_fx_settlements (collection_account_id, settled_at DESC);

ALTER TABLE public.ic_sale_fx_settlements ENABLE ROW LEVEL SECURITY;
