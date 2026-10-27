-- FX settlement batch: payment from collection agent to a receivable account
ALTER TABLE public.ic_sale_fx_settlements
  ADD COLUMN IF NOT EXISTS to_account_id VARCHAR(50) REFERENCES public.ic_fund_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_voucher_id VARCHAR(50) REFERENCES public.ic_fund_vouchers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ic_sale_fx_settlements_payment_voucher
  ON public.ic_sale_fx_settlements (payment_voucher_id)
  WHERE payment_voucher_id IS NOT NULL;
