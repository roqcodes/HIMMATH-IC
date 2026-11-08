-- INR cash book: payments/receipts plus a bank till, same settlement flow as AED.

ALTER TABLE public.inr_fund_accounts DROP CONSTRAINT IF EXISTS inr_fund_accounts_account_type_check;
ALTER TABLE public.inr_fund_accounts
  ADD CONSTRAINT inr_fund_accounts_account_type_check
  CHECK (account_type IN ('bank', 'personal', 'income', 'profit', 'expense', 'inventory', 'd_expense'));

ALTER TABLE public.inr_fund_vouchers DROP CONSTRAINT IF EXISTS inr_fund_vouchers_voucher_type_check;
ALTER TABLE public.inr_fund_vouchers
  ADD CONSTRAINT inr_fund_vouchers_voucher_type_check
  CHECK (voucher_type IN ('payment', 'receipt', 'journal', 'contra'));

INSERT INTO public.inr_fund_accounts (
  id, branch_id, name, account_type, opening_balance, notes, source_type, source_id
)
SELECT
  'INFA-CASH-INR',
  'branch_hq',
  'Cash INR',
  'bank',
  0,
  'INR till for payments and receipts',
  'ic_system',
  'inr_cash'
WHERE NOT EXISTS (
  SELECT 1 FROM public.inr_fund_accounts
  WHERE branch_id = 'branch_hq' AND source_type = 'ic_system' AND source_id = 'inr_cash'
);

INSERT INTO public.inr_fund_voucher_counters (branch_id, last_no)
VALUES ('branch_hq', 0)
ON CONFLICT (branch_id) DO NOTHING;
