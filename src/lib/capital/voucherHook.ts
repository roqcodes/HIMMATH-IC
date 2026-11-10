import 'server-only';

import type { QueryResult } from 'pg';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { allocateProfitEventInTx, shouldAllocateCapitalForReference } from '@/lib/capital/allocation';
import { toIsoDateString, toIsoTimestamp } from '@/lib/toIsoDateString';
import type { CapitalAllocationKind } from '@/lib/capital/constants';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

function signedPlImpact(
  debitType: string,
  creditType: string,
  amount: number,
): number | null {
  const amt = roundLedgerAmount(amount);
  if (debitType === 'profit' && creditType !== 'profit') return -amt;
  if (creditType === 'profit' && debitType !== 'profit') return amt;
  if (debitType === 'expense' || debitType === 'd_expense') return -amt;
  if (creditType === 'expense' || creditType === 'd_expense') return amt;
  if (debitType === 'income' && creditType === 'profit') return amt;
  if (debitType === 'profit' && creditType === 'income') return -amt;
  return null;
}

export async function tryAllocateCapitalFromAedVoucher(
  client: DbClient,
  branchId: string,
  voucherId: string,
  options?: { useCurrentCapitalShares?: boolean },
): Promise<void> {
  const res = await client.query(
    `SELECT v.id, v.voucher_date, v.created_at, v.amount, v.reference_type,
            da.account_type AS debit_type, ca.account_type AS credit_type
     FROM ic_fund_vouchers v
     JOIN ic_fund_accounts da ON da.id = v.debit_account_id
     JOIN ic_fund_accounts ca ON ca.id = v.credit_account_id
     WHERE v.id = $1 AND v.branch_id = $2 AND v.status = 'active'`,
    [voucherId, branchId],
  );
  const row = res.rows[0];
  if (!row) return;
  if (!shouldAllocateCapitalForReference(String(row.reference_type ?? ''))) return;

  const impact = signedPlImpact(String(row.debit_type), String(row.credit_type), Number(row.amount));
  if (impact === null) return;

  const ref = String(row.reference_type ?? '');
  const kind: CapitalAllocationKind = ref === 'ic_sale_profit' ? 'profit' : 'expense';

  await allocateProfitEventInTx(client, {
    branchId,
    sourceVoucherId: voucherId,
    sourceBook: 'AED',
    voucherDate: toIsoDateString(row.voucher_date),
    voucherAt: toIsoTimestamp(row.created_at),
    useCurrentCapitalShares: options?.useCurrentCapitalShares,
    eventAmount: impact,
    kind,
  });
}

export async function tryAllocateCapitalFromInrVoucher(
  client: DbClient,
  branchId: string,
  voucherId: string,
  options?: { useCurrentCapitalShares?: boolean },
): Promise<void> {
  const res = await client.query(
    `SELECT v.id, v.voucher_date, v.created_at, v.amount, v.reference_type,
            da.account_type AS debit_type, ca.account_type AS credit_type
     FROM inr_fund_vouchers v
     JOIN inr_fund_accounts da ON da.id = v.debit_account_id
     JOIN inr_fund_accounts ca ON ca.id = v.credit_account_id
     WHERE v.id = $1 AND v.branch_id = $2 AND v.status = 'active'`,
    [voucherId, branchId],
  );
  const row = res.rows[0];
  if (!row) return;
  if (!shouldAllocateCapitalForReference(String(row.reference_type ?? ''))) return;

  const impact = signedPlImpact(String(row.debit_type), String(row.credit_type), Number(row.amount));
  if (impact === null) return;

  const kind: CapitalAllocationKind =
    String(row.reference_type) === 'metal_sale_profit' ? 'profit' : 'expense';

  await allocateProfitEventInTx(client, {
    branchId,
    sourceVoucherId: voucherId,
    sourceBook: 'INR',
    voucherDate: toIsoDateString(row.voucher_date),
    voucherAt: toIsoTimestamp(row.created_at),
    useCurrentCapitalShares: options?.useCurrentCapitalShares,
    eventAmount: impact,
    kind,
  });
}
