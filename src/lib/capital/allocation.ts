import 'server-only';

import type { QueryResult } from 'pg';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { CAPITAL_SKIP_ALLOCATION_REFERENCE_TYPES } from '@/lib/capital/constants';
import { ensureHouseInvestor } from '@/lib/capital/ensure';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import type { CapitalAllocationKind } from '@/lib/capital/constants';
import { toIsoDateString, toIsoTimestamp } from '@/lib/toIsoDateString';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

type ShareRow = { investorId: string; aedEq: number; shareBps: number };

export type CapitalShareSnapshot = {
  /** Calendar date of the profit voucher (stored on allocation rows). */
  voucherDate: string;
  /** Instant used to decide which capital lots count (voucher `created_at`). */
  asOfAt: string;
};

const LOT_MOVEMENTS_SQL = `movement_type IN ('opening', 'deposit', 'withdraw')`;

/**
 * Lots with lot_date before the voucher day count fully.
 * Same calendar day: only lots with created_at <= profit voucher posted time.
 */
async function capitalSharesAsOf(
  client: DbClient,
  branchId: string,
  asOfDate: string,
  asOfAt: string,
): Promise<{ rows: ShareRow[]; totalAedEq: number; houseId: string }> {
  const houseId = await ensureHouseInvestor(client, branchId);
  const day = toIsoDateString(asOfDate);
  const instant = toIsoTimestamp(asOfAt);

  const res = await client.query(
    `SELECT investor_id, COALESCE(SUM(aed_eq), 0) AS aed_eq
     FROM ic_capital_lots
     WHERE branch_id = $1 AND status = 'active'
       AND ${LOT_MOVEMENTS_SQL}
       AND (
         lot_date < $2::date
         OR (lot_date = $2::date AND created_at <= $3::timestamptz)
       )
     GROUP BY investor_id`,
    [branchId, day, instant],
  );
  const raw = res.rows
    .map(r => ({
      investorId: String(r.investor_id),
      aedEq: roundLedgerAmount(Number(r.aed_eq) || 0),
    }))
    .filter(r => Math.abs(r.aedEq) > 0.0000001);

  const totalAedEq = roundLedgerAmount(raw.reduce((s, r) => s + r.aedEq, 0));
  if (totalAedEq <= 0) {
    return { rows: [{ investorId: houseId, aedEq: 0, shareBps: 10000 }], totalAedEq: 0, houseId };
  }

  const rows: ShareRow[] = raw.map(r => ({
    investorId: r.investorId,
    aedEq: r.aedEq,
    shareBps: Math.round((r.aedEq / totalAedEq) * 10000),
  }));

  const bpsSum = rows.reduce((s, r) => s + r.shareBps, 0);
  if (bpsSum !== 10000 && rows.length > 0) {
    const last = rows[rows.length - 1];
    last.shareBps += 10000 - bpsSum;
  }

  return { rows, totalAedEq, houseId };
}

/** Present-day ownership — all active capital lots (rebalance / fix mis-splits). */
async function capitalSharesAllActive(
  client: DbClient,
  branchId: string,
): Promise<{ rows: ShareRow[]; totalAedEq: number; houseId: string }> {
  const houseId = await ensureHouseInvestor(client, branchId);
  const res = await client.query(
    `SELECT investor_id, COALESCE(SUM(aed_eq), 0) AS aed_eq
     FROM ic_capital_lots
     WHERE branch_id = $1 AND status = 'active'
       AND ${LOT_MOVEMENTS_SQL}
     GROUP BY investor_id`,
    [branchId],
  );
  const raw = res.rows
    .map(r => ({
      investorId: String(r.investor_id),
      aedEq: roundLedgerAmount(Number(r.aed_eq) || 0),
    }))
    .filter(r => Math.abs(r.aedEq) > 0.0000001);

  const totalAedEq = roundLedgerAmount(raw.reduce((s, r) => s + r.aedEq, 0));
  if (totalAedEq <= 0) {
    return { rows: [{ investorId: houseId, aedEq: 0, shareBps: 10000 }], totalAedEq: 0, houseId };
  }

  const rows: ShareRow[] = raw.map(r => ({
    investorId: r.investorId,
    aedEq: r.aedEq,
    shareBps: Math.round((r.aedEq / totalAedEq) * 10000),
  }));
  const bpsSum = rows.reduce((s, r) => s + r.shareBps, 0);
  if (bpsSum !== 10000 && rows.length > 0) {
    rows[rows.length - 1].shareBps += 10000 - bpsSum;
  }
  return { rows, totalAedEq, houseId };
}

/** Snapshot at profit posting time, or earliest capital lot after that instant (same-day ordering). */
async function resolveCapitalShareSnapshot(
  client: DbClient,
  branchId: string,
  voucherDate: string,
  voucherAt?: string,
): Promise<CapitalShareSnapshot> {
  const day = toIsoDateString(voucherDate);
  const at = voucherAt ? toIsoTimestamp(voucherAt) : `${day}T23:59:59.999Z`;

  const initial = await capitalSharesAsOf(client, branchId, day, at);
  if (initial.totalAedEq > 0.0001) {
    return { voucherDate: day, asOfAt: at };
  }

  const laterRes = await client.query(
    `SELECT lot_date, created_at
     FROM ic_capital_lots
     WHERE branch_id = $1 AND status = 'active'
       AND ${LOT_MOVEMENTS_SQL}
       AND (
         lot_date > $2::date
         OR (lot_date = $2::date AND created_at > $3::timestamptz)
       )
     ORDER BY lot_date ASC, created_at ASC
     LIMIT 1`,
    [branchId, day, at],
  );
  const later = laterRes.rows[0] as { lot_date?: unknown; created_at?: unknown } | undefined;
  if (later) {
    const laterDay = toIsoDateString(later.lot_date);
    const laterAt = toIsoTimestamp(later.created_at);
    const snap = await capitalSharesAsOf(client, branchId, laterDay, laterAt);
    if (snap.totalAedEq > 0.0001) {
      return { voucherDate: day, asOfAt: laterAt };
    }
  }

  return { voucherDate: day, asOfAt: at };
}

export function shouldAllocateCapitalForReference(referenceType: string | null | undefined): boolean {
  if (!referenceType) return true;
  return !CAPITAL_SKIP_ALLOCATION_REFERENCE_TYPES.has(referenceType);
}

export async function voidCapitalAllocationsForVoucher(
  client: DbClient,
  sourceVoucherId: string,
  sourceBook: 'AED' | 'INR',
): Promise<void> {
  await client.query(
    `UPDATE ic_capital_allocations
     SET status = 'void'
     WHERE source_voucher_id = $1 AND source_book = $2 AND status = 'active'`,
    [sourceVoucherId, sourceBook],
  );
}

export async function allocateProfitEventInTx(
  client: DbClient,
  params: {
    branchId: string;
    sourceVoucherId: string;
    sourceBook: 'AED' | 'INR';
    voucherDate: string;
    /** Profit journal posted at (voucher `created_at`). Same-day lots after this are excluded. */
    voucherAt?: string;
    /** Rebasing mis-split slices: use ownership as of now, not voucher instant. */
    useCurrentCapitalShares?: boolean;
    eventAmount: number;
    kind: CapitalAllocationKind;
  },
): Promise<void> {
  const eventAmount = roundLedgerAmount(params.eventAmount);
  if (Math.abs(eventAmount) < 0.0000001) return;

  const capitalBranchId = HQ_IC_FUNDS_BRANCH_ID;

  if (params.useCurrentCapitalShares) {
    await voidCapitalAllocationsForVoucher(client, params.sourceVoucherId, params.sourceBook);
  } else {
    const existing = await client.query(
      `SELECT 1 FROM ic_capital_allocations
       WHERE source_voucher_id = $1 AND source_book = $2 AND status = 'active'
         AND kind IN ('profit', 'expense', 'management')
       LIMIT 1`,
      [params.sourceVoucherId, params.sourceBook],
    );
    if (existing.rows.length > 0) return;
  }

  const settingsRes = await client.query(
    `SELECT management_share_bps, management_investor_id
     FROM ic_capital_settings WHERE id = 'hq' LIMIT 1`,
  );
  const settings = settingsRes.rows[0] as {
    management_share_bps?: number;
    management_investor_id?: string | null;
  } | undefined;
  const managementBps = Number(settings?.management_share_bps) || 0;

  const { rows: shares, totalAedEq, houseId } = params.useCurrentCapitalShares
    ? await capitalSharesAllActive(client, capitalBranchId)
    : await (async () => {
        const snapshot = await resolveCapitalShareSnapshot(
          client,
          capitalBranchId,
          params.voucherDate,
          params.voucherAt,
        );
        return capitalSharesAsOf(client, capitalBranchId, snapshot.voucherDate, snapshot.asOfAt);
      })();

  /** When unset, management share goes to HQ (house investor). */
  const mgmtReceiver = settings?.management_investor_id?.trim() || houseId;

  const mgmtAmount = roundLedgerAmount((eventAmount * managementBps) / 10000);
  const remainder = roundLedgerAmount(eventAmount - mgmtAmount);

  const insert = async (
    investorId: string,
    kind: CapitalAllocationKind,
    allocated: number,
    shareBps: number,
  ) => {
    if (Math.abs(allocated) < 0.0000001) return;
    const id = `ICCA-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
    await client.query(
      `INSERT INTO ic_capital_allocations (
         id, branch_id, source_voucher_id, source_book, source_voucher_date,
         investor_id, kind, event_amount, allocated_amount, book,
         management_bps_snapshot, capital_share_bps_snapshot
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        params.branchId,
        params.sourceVoucherId,
        params.sourceBook,
        toIsoDateString(params.voucherDate),
        investorId,
        kind,
        eventAmount,
        allocated,
        params.sourceBook,
        managementBps,
        shareBps,
      ],
    );
  };

  if (totalAedEq <= 0) {
    await insert(mgmtReceiver, 'management', mgmtAmount, 0);
    await insert(houseId, params.kind, remainder, 10000);
    return;
  }

  await insert(mgmtReceiver, 'management', mgmtAmount, 0);

  for (const row of shares) {
    const slice = roundLedgerAmount((remainder * row.shareBps) / 10000);
    await insert(row.investorId, params.kind, slice, row.shareBps);
  }

  const allocatedSum = roundLedgerAmount(
    mgmtAmount + shares.reduce((s, r) => s + roundLedgerAmount((remainder * r.shareBps) / 10000), 0),
  );
  const drift = roundLedgerAmount(eventAmount - allocatedSum);
  if (Math.abs(drift) > 0.0001) {
    await insert(shares[0]?.investorId ?? houseId, params.kind, drift, shares[0]?.shareBps ?? 0);
  }
}
