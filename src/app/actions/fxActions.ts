'use server';

import { query, withTransaction } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireICFundsAccess } from '@/lib/icFunds/requireAccess';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import {
  accountBalanceSql,
  accountMovementJoinSql,
  inrAccountBalanceSql,
  inrAccountMovementJoinSql,
} from '@/lib/icFunds/accountBalance';
import { CURRENCY_EXCHANGE_REF } from '@/lib/fx/amounts';
import { postCurrencyExchangeInTx } from '@/lib/fx/exchange';
import { currencyExchangeSchema } from '@/lib/validations/fx';
import { listCapitalBankAccountsBothAction } from '@/app/actions/capitalActions';

type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

export type FxExchangeRow = {
  id: string;
  voucherDate: string;
  direction: 'aed_to_inr' | 'inr_to_aed';
  aedAmount: number;
  inrAmount: number;
  notes: string;
  aedVoucherId: string;
  inrVoucherId: string;
};

async function requireFxWrite() {
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'write');
  if (!access.ok) return { success: false as const, error: access.error };
  return access;
}

async function requireFxRead(): Promise<ActionErr | undefined> {
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return { success: false, error: access.error };
}

export async function getFxPageDataAction(): Promise<
  ActionResult<{
    banks: { aed: Array<{ id: string; name: string; balance: number }>; inr: Array<{ id: string; name: string; balance: number }> };
    cashAed: number;
    cashInr: number;
    defaultInrPerAed: number;
    exchanges: FxExchangeRow[];
  }>
> {
  const readDenied = await requireFxRead();
  if (readDenied) return readDenied;

  try {
    const banks = await listCapitalBankAccountsBothAction();
    if (!banks.success) return banks;

    const [rateRes, aedCash, inrCash, aedRows, inrRows] = await Promise.all([
      query(`SELECT opening_inr_per_aed FROM ic_capital_settings WHERE id = 'hq' LIMIT 1`),
      query(
        `SELECT COALESCE(SUM(${accountBalanceSql()}), 0) AS total
         FROM ic_fund_accounts a
         ${accountMovementJoinSql({ branchParam: '$1' })}
         WHERE a.branch_id = $1 AND a.account_type = 'bank' AND a.status = 'active'`,
        [HQ_IC_FUNDS_BRANCH_ID],
      ),
      query(
        `SELECT COALESCE(SUM(${inrAccountBalanceSql()}), 0) AS total
         FROM inr_fund_accounts a
         ${inrAccountMovementJoinSql({ branchParam: '$1' })}
         WHERE a.branch_id = $1 AND a.account_type = 'bank' AND a.status = 'active'`,
        [HQ_IC_FUNDS_BRANCH_ID],
      ),
      query<{
        id: string;
        voucher_date: string;
        amount: string;
        notes: string;
        reference_id: string;
        credit_type: string;
      }>(
        `SELECT v.id::text AS id, v.voucher_date::text AS voucher_date, v.amount::text AS amount,
                COALESCE(v.notes, '') AS notes, v.reference_id::text AS reference_id,
                ca.account_type AS credit_type
         FROM ic_fund_vouchers v
         JOIN ic_fund_accounts ca ON ca.id = v.credit_account_id
         WHERE v.branch_id = $1 AND v.status = 'active' AND v.reference_type = $2
         ORDER BY v.voucher_date DESC, v.created_at DESC
         LIMIT 80`,
        [HQ_IC_FUNDS_BRANCH_ID, CURRENCY_EXCHANGE_REF],
      ),
      query<{ reference_id: string; id: string; amount: string }>(
        `SELECT reference_id::text AS reference_id, id::text AS id, amount::text AS amount
         FROM inr_fund_vouchers
         WHERE branch_id = $1 AND status = 'active' AND reference_type = $2`,
        [HQ_IC_FUNDS_BRANCH_ID, CURRENCY_EXCHANGE_REF],
      ),
    ]);

    const inrByRef = new Map(inrRows.rows.map(r => [String(r.reference_id), r]));
    const exchanges: FxExchangeRow[] = [];
    for (const row of aedRows.rows) {
      const inr = inrByRef.get(String(row.reference_id));
      if (!inr) continue;
      exchanges.push({
        id: String(row.reference_id),
        voucherDate: String(row.voucher_date).slice(0, 10),
        direction: String(row.credit_type) === 'bank' ? 'aed_to_inr' : 'inr_to_aed',
        aedAmount: Number(row.amount) || 0,
        inrAmount: Number(inr.amount) || 0,
        notes: String(row.notes || ''),
        aedVoucherId: String(row.id),
        inrVoucherId: String(inr.id),
      });
    }

    return {
      success: true,
      data: {
        banks: banks.data,
        cashAed: Number(aedCash.rows[0]?.total) || 0,
        cashInr: Number(inrCash.rows[0]?.total) || 0,
        defaultInrPerAed: Number(rateRes.rows[0]?.opening_inr_per_aed) || 0,
        exchanges,
      },
    };
  } catch (err) {
    logger.error({ err }, 'getFxPageDataAction failed');
    return { success: false, error: 'Failed to load FX page.' };
  }
}

export async function postCurrencyExchangeAction(input: unknown): Promise<
  ActionResult<{ exchangeId: string; aed: number; inr: number }>
> {
  const parsed = currencyExchangeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const access = await requireFxWrite();
  if ('success' in access) return access;

  try {
    const posted = await withTransaction(async client =>
      postCurrencyExchangeInTx(client, {
        branchId: HQ_IC_FUNDS_BRANCH_ID,
        direction: parsed.data.direction,
        sourceAmount: parsed.data.sourceAmount,
        inrPerAed: parsed.data.inrPerAed,
        aedBankAccountId: parsed.data.aedBankAccountId,
        inrBankAccountId: parsed.data.inrBankAccountId,
        voucherDate: parsed.data.voucherDate,
        notes: parsed.data.notes,
        createdByName: access.user?.name ?? null,
      }),
    );
    await writeAuditLog({
      actor: access.user,
      action: 'create',
      entityType: 'currency_exchange',
      entityId: posted.exchangeId,
      after: {
        direction: parsed.data.direction,
        aed: posted.aed,
        inr: posted.inr,
        inrPerAed: parsed.data.inrPerAed,
      },
    });
    revalidatePath('/admin/fx');
    revalidatePath('/admin/capital');
    revalidatePath('/admin/journal');
    return { success: true, data: { exchangeId: posted.exchangeId, aed: posted.aed, inr: posted.inr } };
  } catch (err) {
    logger.error({ err }, 'postCurrencyExchangeAction failed');
    return { success: false, error: err instanceof Error ? err.message : 'Failed to post exchange' };
  }
}
