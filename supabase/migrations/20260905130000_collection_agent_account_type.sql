-- Collection agents live as ic_fund_accounts.account_type = 'collection_agent'.
-- Migrate legacy ic_collection_agents (if present) and widen account_type check.

ALTER TABLE public.ic_fund_accounts DROP CONSTRAINT IF EXISTS ic_fund_accounts_account_type_check;
ALTER TABLE public.ic_fund_accounts ADD CONSTRAINT ic_fund_accounts_account_type_check
  CHECK (account_type IN (
    'bank', 'collection_agent', 'personal', 'income', 'profit', 'expense', 'd_expense'
  ));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ic_collection_agents'
  ) THEN
    UPDATE public.ic_fund_accounts fa
    SET account_type = 'collection_agent'
    FROM public.ic_collection_agents ca
    WHERE fa.id = ca.fund_account_id;

    INSERT INTO public.ic_fund_accounts (
      id, branch_id, name, account_type, opening_balance, notes, phone, status
    )
    SELECT
      'ICFA-' || UPPER(SUBSTRING(REPLACE(ca.id::text, '-', ''), 1, 10)),
      COALESCE(ca.branch_id, 'branch_hq'),
      ca.name,
      'collection_agent',
      0,
      COALESCE(ca.notes, ''),
      ca.phone,
      ca.status
    FROM public.ic_collection_agents ca
    WHERE ca.fund_account_id IS NULL
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.ic_collection_agents ca
    SET fund_account_id = fa.id
    FROM public.ic_fund_accounts fa
    WHERE ca.fund_account_id IS NULL
      AND fa.account_type = 'collection_agent'
      AND fa.name = ca.name
      AND fa.branch_id = COALESCE(ca.branch_id, 'branch_hq');

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ic_sale_fx_settlements'
        AND column_name = 'collection_agent_id'
    ) THEN
      UPDATE public.ic_sale_fx_settlements f
      SET collection_account_id = COALESCE(f.collection_account_id, ca.fund_account_id)
      FROM public.ic_collection_agents ca
      WHERE f.collection_agent_id = ca.id
        AND ca.fund_account_id IS NOT NULL;
    END IF;

    DROP TABLE IF EXISTS public.ic_collection_agents CASCADE;
  END IF;
END $$;

ALTER TABLE public.ic_sale_fx_settlements DROP COLUMN IF EXISTS collection_agent_id;

DROP INDEX IF EXISTS public.idx_ic_sale_fx_settlements_agent;

CREATE INDEX IF NOT EXISTS idx_ic_sale_fx_settlements_account
  ON public.ic_sale_fx_settlements (collection_account_id, settled_at DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ic_sale_fx_settlements'
      AND column_name = 'collection_account_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.ic_sale_fx_settlements WHERE collection_account_id IS NULL
  ) THEN
    ALTER TABLE public.ic_sale_fx_settlements
      ALTER COLUMN collection_account_id SET NOT NULL;
  END IF;
END $$;
