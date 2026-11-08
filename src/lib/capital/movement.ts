import 'server-only';

import type { QueryResult } from 'pg';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { postVoucherInTx } from '@/lib/icFunds/icTransferFundSync';
import { ensureInrCashTill, postInrVoucherInTx } from '@/lib/ledgers/inr/inrFundSync';
import {
  CAPITAL_REF_DEPOSIT,
  CAPITAL_REF_PAYOUT,
  CAPITAL_REF_WITHDRAW,
  type CapitalMovementType,
} from '@/lib/capital/constants';
import { resolveCapitalInvestorAccountId } from '@/lib/capital/ensure';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

function refForMovement(type: CapitalMovementType): string {
  switch (type) {
    case 'deposit':
      return CAPITAL_REF_DEPOSIT;
    case 'withdraw':
      return CAPITAL_REF_WITHDRAW;
    case 'payout':
      return CAPITAL_REF_PAYOUT;
    default:
      return CAPITAL_REF_DEPOSIT;
  }
}

export function computeAedEquivalent(
  book: 'AED' | 'INR',
  amountNative: number,
  inrPerAed: number,
): number {
  const n = roundLedgerAmount(amountNative);
  if (book === 'AED') return n;
  if (!Number.isFinite(inrPerAed) || inrPerAed <= 0) return 0;
  return roundLedgerAmount(n / inrPerAed);
}

async function remainingNativeCapital(
  client: DbClient,
  branchId: string,
  investorId: string,
  book: 'AED' | 'INR',
): Promise<{ native: number; aedEq: number }> {
  const res = await client.query(
    `SELECT
       COALESCE(SUM(amount_native), 0) AS native,
       COALESCE(SUM(aed_eq), 0) AS aed_eq
     FROM ic_capital_lots
     WHERE branch_id = $1 AND investor_id = $2 AND book = $3 AND status = 'active'
       AND movement_type IN ('opening', 'deposit', 'withdraw')`,
    [branchId, investorId, book],
  );
  const row = res.rows[0] as { native?: string; aed_eq?: string } | undefined;
  return {
    native: Number(row?.native) || 0,
    aedEq: Number(row?.aed_eq) || 0,
  };
}

export async function postCapitalMovementInTx(
  client: DbClient,
  params: {
    branchId: string;
    investorId: string;
    movementType: CapitalMovementType;
    book: 'AED' | 'INR';
    lotDate: string;
    amountNative: number;
    inrPerAed: number;
    bankAccountId: string;
    notes?: string;
    createdByName?: string | null;
  },
): Promise<{ lotId: string; voucherId: string }> {
  const movement = params.movementType;
  if (movement === 'opening') throw new Error('Use opening capital flow for opening lots');

  let amountNative = roundLedgerAmount(Math.abs(params.amountNative));
  if (amountNative <= 0) throw new Error('Amount must be greater than zero');

  const inrPerAed = params.book === 'INR' ? roundLedgerAmount(params.inrPerAed) : 1;
  if (params.book === 'INR' && inrPerAed <= 0) throw new Error('INR per AED rate is required');

  let signedNative = amountNative;
  let aedEq = computeAedEquivalent(params.book, amountNative, inrPerAed);

  if (movement === 'withdraw' || movement === 'payout') {
    const remaining = await remainingNativeCapital(client, params.branchId, params.investorId, params.book);
    if (movement === 'withdraw') {
      if (amountNative > remaining.native + 0.0001) {
        throw new Error('Withdrawal exceeds remaining capital in this book');
      }
      const ratio = remaining.native > 0 ? amountNative / remaining.native : 0;
      aedEq = roundLedgerAmount(remaining.aedEq * ratio);
      signedNative = -amountNative;
      aedEq = -aedEq;
    } else {
      // Payout: cash only; lots unchanged (% unchanged). Still need sufficient capital account balance on ledger.
      signedNative = 0;
      aedEq = 0;
    }
  }

  const capitalAccountId = await resolveCapitalInvestorAccountId(
    client,
    params.branchId,
    params.investorId,
    params.book,
  );

  const table = params.book === 'AED' ? 'ic_fund_accounts' : 'inr_fund_accounts';
  const bank = await client.query(
    `SELECT id, account_type, status FROM ${table} WHERE id = $1 AND branch_id = $2`,
    [params.bankAccountId, params.branchId],
  );
  if (bank.rows.length === 0) throw new Error('Bank account not found');
  if (String(bank.rows[0].account_type) !== 'bank') throw new Error('Select a bank / cash account');
  if (bank.rows[0].status !== 'active') throw new Error('Bank account is inactive');

  const lotId = `ICCL-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  const refType = refForMovement(movement);
  const notes = params.notes?.trim() ?? '';

  let debitId: string;
  let creditId: string;
  if (movement === 'deposit') {
    debitId = params.bankAccountId;
    creditId = capitalAccountId;
  } else {
    debitId = capitalAccountId;
    creditId = params.bankAccountId;
  }

  let voucherId: string | null;
  if (params.book === 'AED') {
    voucherId = await postVoucherInTx(client, {
      branchId: params.branchId,
      voucherType: 'journal',
      voucherDate: params.lotDate,
      debitAccountId: debitId,
      creditAccountId: creditId,
      amount: amountNative,
      notes: notes || `${movement} · ${lotId}`,
      referenceType: refType,
      referenceId: lotId,
    });
  } else {
    await ensureInrCashTill(client, params.branchId);
    voucherId = await postInrVoucherInTx(client, {
      branchId: params.branchId,
      voucherType: 'journal',
      voucherDate: params.lotDate,
      debitAccountId: debitId,
      creditAccountId: creditId,
      amount: amountNative,
      notes: notes || `${movement} · ${lotId}`,
      referenceType: refType,
      referenceId: lotId,
      createdByName: params.createdByName ?? null,
    });
  }
  if (!voucherId) throw new Error('Failed to post capital journal');

  if (movement !== 'payout') {
    await client.query(
      `INSERT INTO ic_capital_lots (
         id, branch_id, investor_id, movement_type, book, lot_date,
         amount_native, inr_per_aed, aed_eq, bank_account_id,
         voucher_id, voucher_book, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        lotId,
        params.branchId,
        params.investorId,
        movement,
        params.book,
        params.lotDate,
        signedNative,
        inrPerAed,
        aedEq,
        params.bankAccountId,
        voucherId,
        params.book,
        notes,
      ],
    );
  } else {
    await client.query(
      `INSERT INTO ic_capital_allocations (
         id, branch_id, source_voucher_id, source_book, source_voucher_date,
         investor_id, kind, event_amount, allocated_amount, book,
         management_bps_snapshot, capital_share_bps_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6,'payout',$7,$8,$9,0,0)`,
      [
        `ICCA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`,
        params.branchId,
        voucherId,
        params.book,
        params.lotDate,
        params.investorId,
        amountNative,
        amountNative,
        params.book,
      ],
    );
  }

  return { lotId, voucherId };
}
