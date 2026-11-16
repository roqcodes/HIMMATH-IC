-- Optional UAE collection agent on manual payment/receipt vouchers (reporting).

ALTER TABLE public.ic_fund_vouchers
  ADD COLUMN IF NOT EXISTS aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL;

ALTER TABLE public.inr_fund_vouchers
  ADD COLUMN IF NOT EXISTS aed_agent_id UUID REFERENCES public.ic_aed_agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ic_fund_vouchers_aed_agent
  ON public.ic_fund_vouchers (aed_agent_id) WHERE aed_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inr_fund_vouchers_aed_agent
  ON public.inr_fund_vouchers (aed_agent_id) WHERE aed_agent_id IS NOT NULL; 