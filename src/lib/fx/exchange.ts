import 'server-only';

import type { QueryResult } from 'pg';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import {
  accountBalanceSql,
  accountMovementJoinSql,
  inrAccountBalanceSql,
  inrAccountMovementJoinSql,
} from '@/lib/icFunds/accountBalance';
import { ensureSystemAccount, postVoucherInTx } from '@/lib/icFunds/icTransferFundSync';
import { ensureInrCashTill, ensureInrSystemAccount, postInrVoucherInTx } from '@/lib/ledgers/inr/inrFundSync';
import {
  computeCurrencyExchangeAmounts,
  CURRENCY_EXCHANGE_REF,
  type FxDirection,
} from '@/lib/fx/amounts';

export { computeCurrencyExchangeAmounts, CURRENCY_EXCHANGE_REF, type FxDirection };

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

async function postedBankBalance(
  client: DbClient,
  branchId: string,
  book: 'AED' | 'INR',
  bankAccountId: string,
): Promise<number> {
  if (book === 'AED') {
    const res = await client.query(
      `SELECT ${accountBalanceSql()} AS balance
       FROM ic_fund_accounts a
       ${accountMovementJoinSql({ branchParam: '$1', accountParam: '$2' })}
       WHERE a.id = $2 AND a.branch_id = $1`,
      [branchId, bankAccountId],
    );
    return Number(res.rows[0]?.balance) || 0;
  }
  const res = await client.query(
    `SELECT ${inrAccountBalanceSql()} AS balance
     FROM inr_fund_accounts a
     ${inrAccountMovementJoinSql({ branchParam: '$1', accountParam: '$2' })}
     WHERE a.id = $2 AND a.branch_id = $1`,
    [branchId, bankAccountId],
  );
  return Number(res.rows[0]?.balance) || 0;
}

async function requireBank(
  client: DbClient,
  branchId: string,
  book: 'AED' | 'INR',
  accountId: string,
): Promise<void> {
  const table = book === 'AED' ? 'ic_fund_accounts' : 'inr_fund_accounts';
  const res = await client.query(
    `SELECT id, account_type, status FROM ${table} WHERE id = $1 AND branch_id = $2`,
    [accountId, branchId],
  );
  if (res.rows.length === 0) throw new Error(`${book} bank account not found`);
  if (String(res.rows[0].account_type) !== 'bank') throw new Error(`Select a ${book} cash / bank account`);
  if (res.rows[0].status !== 'active') throw new Error(`${book} bank account is inactive`);
}

export async function postCurrencyExchangeInTx(
  client: DbClient,
  params: {
    branchId: string;
    direction: FxDirection;
    sourceAmount: number;
    inrPerAed: number;
    aedBankAccountId: string;
    inrBankAccountId: string;
    voucherDate: string;
    notes?: string;
    createdByName?: string | null;
  },
): Promise<{ exchangeId: string; aedVoucherId: string; inrVoucherId: string; aed: number; inr: number }> {
  const amounts = computeCurrencyExchangeAmounts(params.direction, params.sourceAmount, params.inrPerAed);
  if (amounts.aed <= 0 || amounts.inr <= 0) throw new Error('Amount and rate must be greater than zero');

  await requireBank(client, params.branchId, 'AED', params.aedBankAccountId);
  await requireBank(client, params.branchId, 'INR', params.inrBankAccountId);
  await ensureInrCashTill(client, params.branchId);

  const sourceBook: 'AED' | 'INR' = params.direction === 'aed_to_inr' ? 'AED' : 'INR';
  const sourceId = sourceBook === 'AED' ? params.aedBankAccountId : params.inrBankAccountId;
  const sourceAmt = sourceBook === 'AED' ? amounts.aed : amounts.inr;
  const cash = await postedBankBalance(client, params.branchId, sourceBook, sourceId);
  if (sourceAmt > cash + 0.0001) {
    throw new Error(
      `Insufficient ${sourceBook} cash in the selected account (${sourceBook === 'INR' ? '₹' : 'د.إ'} ${cash.toFixed(2)} available)`,
    );
  }

  const aedClearing = await ensureSystemAccount(
    client,
    params.branchId,
    'Currency exchange',
    'personal',
    'fx_conversion',
  );
  const inrClearing = await ensureInrSystemAccount(
    client,
    params.branchId,
    'Currency exchange',
    'personal',
    'fx_conversion',
  );

  const exchangeId = `FXC-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const arrow = params.direction === 'aed_to_inr' ? 'AED→INR' : 'INR→AED';
  const rateNote = `${arrow} · ${roundLedgerAmount(params.inrPerAed)} INR/AED`;
  const notes = [rateNote, params.notes?.trim()].filter(Boolean).join(' · ');

  let aedDebit: string;
  let aedCredit: string;
  let inrDebit: string;
  let inrCredit: string;
  if (params.direction === 'aed_to_inr') {
    aedDebit = aedClearing;
    aedCredit = params.aedBankAccountId;
    inrDebit = params.inrBankAccountId;
    inrCredit = inrClearing;
  } else {
    aedDebit = params.aedBankAccountId;
    aedCredit = aedClearing;
    inrDebit = inrClearing;
    inrCredit = params.inrBankAccountId;
  }

  const aedVoucherId = await postVoucherInTx(client, {
    branchId: params.branchId,
    voucherType: 'journal',
    voucherDate: params.voucherDate,
    debitAccountId: aedDebit,
    creditAccountId: aedCredit,
    amount: amounts.aed,
    notes,
    referenceType: CURRENCY_EXCHANGE_REF,
    referenceId: exchangeId,
  });
  const inrVoucherId = await postInrVoucherInTx(client, {
    branchId: params.branchId,
    voucherType: 'journal',
    voucherDate: params.voucherDate,
    debitAccountId: inrDebit,
    creditAccountId: inrCredit,
    amount: amounts.inr,
    notes,
    referenceType: CURRENCY_EXCHANGE_REF,
    referenceId: exchangeId,
    createdByName: params.createdByName ?? null,
  });
  if (!aedVoucherId || !inrVoucherId) throw new Error('Failed to post currency exchange');

  return { exchangeId, aedVoucherId, inrVoucherId, aed: amounts.aed, inr: amounts.inr };
}
