-- Manual payments/receipts are many per counterparty; reference_id must stay NULL
-- so idx_ic_fund_vouchers_active_ref only enforces deal-linked postings (1:1).

UPDATE public.ic_fund_vouchers
SET reference_type = NULL,
    reference_id = NULL
WHERE reference_type IN ('ic_fund_payment', 'ic_fund_receipt', 'ic_fund_journal');

UPDATE public.inr_fund_vouchers
SET reference_type = NULL,
    reference_id = NULL
WHERE reference_type IN ('ic_fund_payment', 'ic_fund_receipt', 'ic_fund_journal');
