'use server';

import { after } from 'next/server';
import { query, runQueryBatch, withTransaction } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireICFundsAccess } from '@/lib/icFunds/requireAccess';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { writeAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { roundLedgerAmount, roundLedgerRate } from '@/lib/icFunds/currencyPolicy';
import {
  ensureCapitalInvestorAccounts,
  ensureHouseInvestor,
  postOpeningCapitalJournal,
  ensureCapitalSettingsRow,
} from '@/lib/capital/ensure';
import { postCapitalMovementInTx, computeAedEquivalent } from '@/lib/capital/movement';
import { loadCapitalDashboard, type CapitalDashboard } from '@/lib/capital/position';
import {
  capitalMovementSchema,
  createCapitalInvestorSchema,
  setCapitalOpeningSchema,
  setManagementShareSchema,
} from '@/lib/validations/capital';

type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

type CapitalWriter = Extract<Awaited<ReturnType<typeof requireICFundsAccess>>, { ok: true }>;

function scheduleCapitalRebalance(): void {
  after(() => {
    void import('@/lib/capital/rebalance')
      .then(m => m.rebalanceHqCapitalProfitSplits())
      .catch(err => logger.warn({ err }, 'Deferred capital rebalance failed'));
  });
}

async function requireCapitalWrite(): Promise<ActionErr | CapitalWriter> {
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'write');
  if (!access.ok) return { success: false, error: access.error };
  return access;
}

async function requireCapitalRead(): Promise<ActionErr | undefined> {
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return { success: false, error: access.error };
}

async function firstBankAccountId(book: 'AED' | 'INR', override?: string): Promise<string> {
  if (override) return override;
  const table = book === 'AED' ? 'ic_fund_accounts' : 'inr_fund_accounts';
  const res = await query(
    `SELECT id FROM ${table}
     WHERE branch_id = $1 AND account_type = 'bank' AND status = 'active'
     ORDER BY LOWER(name)
     LIMIT 1`,
    [HQ_IC_FUNDS_BRANCH_ID],
  );
  if (res.rows.length === 0) throw new Error(`No ${book} bank account found. Create one under Entities first.`);
  return String(res.rows[0].id);
}

export async function getCapitalDashboardAction(): Promise<ActionResult<CapitalDashboard & {
  settings: {
    openingAed: number;
    openingInr: number;
    openingInrPerAed: number;
    managementInvestorId: string | null;
  };
}>> {
  const readDenied = await requireCapitalRead();
  if (readDenied) return readDenied;

  try {
    const loaded = await loadCapitalDashboard(HQ_IC_FUNDS_BRANCH_ID);
    const { settings: snap, ...dashboard } = loaded;
    return {
      success: true,
      data: {
        ...dashboard,
        settings: {
          openingAed: snap.openingAed,
          openingInr: snap.openingInr,
          openingInrPerAed: snap.openingInrPerAed,
          managementInvestorId: snap.managementInvestorId,
        },
      },
    };
  } catch (err) {
    logger.error({ err }, 'getCapitalDashboardAction failed');
    return { success: false, error: 'Failed to load capital dashboard.' };
  }
}

export type CapitalMovementListRow = {
  id: string;
  investorName: string;
  movementType: string;
  book: string;
  lotDate: string;
  amountNative: number;
  inrPerAed: number;
  aedEq: number;
  notes: string;
};

export type CapitalAllocationListRow = {
  id: string;
  voucherDate: string;
  /** Profit voucher posted at (source journal `created_at`). */
  voucherPostedAt: string;
  sourceVoucherId: string;
  book: string;
  investorName: string;
  kind: string;
  eventAmount: number;
  allocatedAmount: number;
  shareBps: number;
};

function mapCapitalDashboardPayload(
  loaded: Awaited<ReturnType<typeof loadCapitalDashboard>>,
): CapitalDashboard & {
  settings: {
    openingAed: number;
    openingInr: number;
    openingInrPerAed: number;
    managementInvestorId: string | null;
  };
} {
  const { settings: snap, ...dashboard } = loaded;
  return {
    ...dashboard,
    settings: {
      openingAed: snap.openingAed,
      openingInr: snap.openingInr,
      openingInrPerAed: snap.openingInrPerAed,
      managementInvestorId: snap.managementInvestorId,
    },
  };
}

async function fetchCapitalMovements(limit: number): Promise<CapitalMovementListRow[]> {
  const res = await query(
    `SELECT l.id, i.name AS investor_name, l.movement_type, l.book, l.lot_date,
            l.amount_native, l.inr_per_aed, l.aed_eq, l.notes
     FROM ic_capital_lots l
     JOIN ic_capital_investors i ON i.id = l.investor_id
     WHERE l.branch_id = $1 AND l.status = 'active'
     ORDER BY l.lot_date DESC, l.created_at DESC
     LIMIT $2`,
    [HQ_IC_FUNDS_BRANCH_ID, Math.min(limit, 500)],
  );
  return res.rows.map(r => ({
    id: String(r.id),
    investorName: String(r.investor_name),
    movementType: String(r.movement_type),
    book: String(r.book),
    lotDate: String(r.lot_date).slice(0, 10),
    amountNative: Number(r.amount_native) || 0,
    inrPerAed: Number(r.inr_per_aed) || 0,
    aedEq: Number(r.aed_eq) || 0,
    notes: String(r.notes ?? ''),
  }));
}

async function fetchCapitalAllocations(limit: number): Promise<CapitalAllocationListRow[]> {
  const res = await query(
    `SELECT a.id, a.source_voucher_date, a.source_voucher_id, a.book, a.kind,
            a.event_amount, a.allocated_amount, a.capital_share_bps_snapshot, i.name AS investor_name,
            COALESCE(iv.created_at, inrv.created_at, a.created_at) AS voucher_posted_at
     FROM ic_capital_allocations a
     JOIN ic_capital_investors i ON i.id = a.investor_id
     LEFT JOIN ic_fund_vouchers iv
       ON a.source_book = 'AED' AND iv.id::text = a.source_voucher_id::text
     LEFT JOIN inr_fund_vouchers inrv
       ON a.source_book = 'INR' AND inrv.id::text = a.source_voucher_id::text
     WHERE a.branch_id = $1 AND a.status = 'active'
     ORDER BY a.source_voucher_date DESC, a.created_at DESC
     LIMIT $2`,
    [HQ_IC_FUNDS_BRANCH_ID, Math.min(limit, 500)],
  );
  return res.rows.map(r => ({
    id: String(r.id),
    voucherDate: String(r.source_voucher_date).slice(0, 10),
    voucherPostedAt: r.voucher_posted_at ? String(r.voucher_posted_at) : String(r.source_voucher_date),
    sourceVoucherId: String(r.source_voucher_id),
    book: String(r.book),
    investorName: String(r.investor_name),
    kind: String(r.kind),
    eventAmount: Number(r.event_amount) || 0,
    allocatedAmount: Number(r.allocated_amount) || 0,
    shareBps: Number(r.capital_share_bps_snapshot) || 0,
  }));
}

/** One auth check + bounded-concurrency loads for the Capital page (avoids pool timeouts). */
type CapitalDashboardPayload = ReturnType<typeof mapCapitalDashboardPayload>;

export async function getCapitalPageDataAction(
  movementLimit = 80,
  allocationLimit = 120,
): Promise<
  ActionResult<{
    dashboard: CapitalDashboardPayload;
    movements: CapitalMovementListRow[];
    allocations: CapitalAllocationListRow[];
  }>
> {
  const readDenied = await requireCapitalRead();
  if (readDenied) return readDenied;

  try {
    const [loaded, movements, allocations] = await Promise.all([
      loadCapitalDashboard(HQ_IC_FUNDS_BRANCH_ID),
      fetchCapitalMovements(movementLimit),
      fetchCapitalAllocations(allocationLimit),
    ]);
    return {
      success: true,
      data: {
        dashboard: mapCapitalDashboardPayload(loaded),
        movements,
        allocations,
      },
    };
  } catch (err) {
    logger.error({ err }, 'getCapitalPageDataAction failed');
    return { success: false, error: 'Failed to load capital page.' };
  }
}

export async function createCapitalInvestorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createCapitalInvestorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const access = await requireCapitalWrite();
  if ('success' in access) return access;

  const id = `ICINV-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  try {
    await withTransaction(async client => {
      await ensureHouseInvestor(client, HQ_IC_FUNDS_BRANCH_ID);
      await client.query(
        `INSERT INTO ic_capital_investors (id, branch_id, name, status, is_house, notes)
         VALUES ($1, $2, $3, 'active', false, $4)`,
        [id, HQ_IC_FUNDS_BRANCH_ID, parsed.data.name, parsed.data.notes],
      );
      await ensureCapitalInvestorAccounts(client, HQ_IC_FUNDS_BRANCH_ID, id, parsed.data.name);
    });
    await writeAuditLog({
      actor: access.user,
      action: 'create',
      entityType: 'ic_capital_investor',
      entityId: id,
      branchId: HQ_IC_FUNDS_BRANCH_ID,
      after: { name: parsed.data.name },
    });
    revalidatePath('/admin/capital');
    scheduleCapitalRebalance();
    return { success: true, data: { id } };
  } catch (err) {
    logger.error({ err }, 'createCapitalInvestorAction failed');
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create investor' };
  }
}

export async function setCapitalOpeningAction(input: unknown): Promise<ActionResult<{ locked: boolean }>> {
  const parsed = setCapitalOpeningSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const access = await requireCapitalWrite();
  if ('success' in access) return access;

  try {
    await withTransaction(async client => {
      const houseId = await ensureHouseInvestor(client, HQ_IC_FUNDS_BRANCH_ID);
      const settingsLock = await client.query(
        `SELECT opening_locked_at FROM ic_capital_settings WHERE id = 'hq' FOR UPDATE`,
      );
      await client.query(
        `UPDATE ic_capital_settings
         SET opening_aed = $1, opening_inr = $2, opening_inr_per_aed = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = 'hq'`,
        [parsed.data.openingAed, parsed.data.openingInr, parsed.data.openingInrPerAed],
      );

      const settings = settingsLock;
      const locked = Boolean(settings.rows[0]?.opening_locked_at);

      const aedBank = await firstBankAccountId('AED', parsed.data.aedBankAccountId);
      const inrBank = await firstBankAccountId('INR', parsed.data.inrBankAccountId);

      if (!locked) {
        const aedAmt = roundLedgerAmount(Number(parsed.data.openingAed));
        const inrAmt = roundLedgerAmount(Number(parsed.data.openingInr));
        const rate = roundLedgerRate(Number(parsed.data.openingInrPerAed));

        if (aedAmt > 0) {
          const lotId = `ICCL-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
          const voucherId = await postOpeningCapitalJournal(client, {
            branchId: HQ_IC_FUNDS_BRANCH_ID,
            book: 'AED',
            investorId: houseId,
            bankAccountId: aedBank,
            amount: aedAmt,
            voucherDate: parsed.data.voucherDate,
            inrPerAed: 1,
            lotId,
          });
          await client.query(
            `INSERT INTO ic_capital_lots (
               id, branch_id, investor_id, movement_type, book, lot_date,
               amount_native, inr_per_aed, aed_eq, bank_account_id, voucher_id, voucher_book, notes
             ) VALUES ($1,$2,$3,'opening','AED',$4,$5,1,$5,$6,$7,'AED','Opening capital AED')`,
            [lotId, HQ_IC_FUNDS_BRANCH_ID, houseId, parsed.data.voucherDate, aedAmt, aedBank, voucherId],
          );
        }

        if (inrAmt > 0) {
          const lotId = `ICCL-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
          const aedEq = computeAedEquivalent('INR', inrAmt, rate);
          const voucherId = await postOpeningCapitalJournal(client, {
            branchId: HQ_IC_FUNDS_BRANCH_ID,
            book: 'INR',
            investorId: houseId,
            bankAccountId: inrBank,
            amount: inrAmt,
            voucherDate: parsed.data.voucherDate,
            inrPerAed: rate,
            lotId,
          });
          await client.query(
            `INSERT INTO ic_capital_lots (
               id, branch_id, investor_id, movement_type, book, lot_date,
               amount_native, inr_per_aed, aed_eq, bank_account_id, voucher_id, voucher_book, notes
             ) VALUES ($1,$2,$3,'opening','INR',$4,$5,$6,$7,$8,$9,'INR','Opening capital INR')`,
            [
              lotId,
              HQ_IC_FUNDS_BRANCH_ID,
              houseId,
              parsed.data.voucherDate,
              inrAmt,
              rate,
              aedEq,
              inrBank,
              voucherId,
            ],
          );
        }

        await client.query(
          `UPDATE ic_capital_settings SET opening_locked_at = CURRENT_TIMESTAMP WHERE id = 'hq'`,
        );
      }
    });
    revalidatePath('/admin/capital');
    revalidatePath('/admin/entities');
    scheduleCapitalRebalance();
    return { success: true, data: { locked: true } };
  } catch (err) {
    logger.error({ err }, 'setCapitalOpeningAction failed');
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save opening capital' };
  }
}

export async function setManagementShareAction(input: unknown): Promise<ActionResult<{ bps: number }>> {
  const parsed = setManagementShareSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const access = await requireCapitalWrite();
  if ('success' in access) return access;

  const bps = Math.round(parsed.data.managementSharePct * 100);
  try {
    await query(
      `UPDATE ic_capital_settings
       SET management_share_bps = $1, management_investor_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = 'hq'`,
      [bps, parsed.data.managementInvestorId ?? null],
    );
    revalidatePath('/admin/capital');
    return { success: true, data: { bps } };
  } catch (err) {
    logger.error({ err }, 'setManagementShareAction failed');
    return { success: false, error: 'Failed to update management share' };
  }
}

export async function postCapitalMovementAction(input: unknown): Promise<ActionResult<{ voucherId: string }>> {
  const parsed = capitalMovementSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const access = await requireCapitalWrite();
  if ('success' in access) return access;

  const inrPerAed = parsed.data.book === 'INR' ? Number(parsed.data.inrPerAed) : 1;
  if (parsed.data.book === 'INR' && (!inrPerAed || inrPerAed <= 0)) {
    return { success: false, error: 'INR per AED rate is required' };
  }

  try {
    const result = await withTransaction(client =>
      postCapitalMovementInTx(client, {
        branchId: HQ_IC_FUNDS_BRANCH_ID,
        investorId: parsed.data.investorId,
        movementType: parsed.data.movementType,
        book: parsed.data.book,
        lotDate: parsed.data.lotDate,
        amountNative: Number(parsed.data.amount),
        inrPerAed,
        bankAccountId: parsed.data.bankAccountId,
        notes: parsed.data.notes,
        createdByName: access.user.name ?? null,
      }),
    );
    revalidatePath('/admin/capital');
    revalidatePath('/admin/entities');
    scheduleCapitalRebalance();
    return { success: true, data: { voucherId: result.voucherId } };
  } catch (err) {
    logger.error({ err }, 'postCapitalMovementAction failed');
    return { success: false, error: err instanceof Error ? err.message : 'Failed to post movement' };
  }
}

async function fetchCapitalBankAccounts(book: 'AED' | 'INR') {
  const table = book === 'AED' ? 'ic_fund_accounts' : 'inr_fund_accounts';
  const res = await query(
    `SELECT id, name, opening_balance AS balance
     FROM ${table}
     WHERE branch_id = $1 AND account_type = 'bank' AND status = 'active'
     ORDER BY LOWER(name)`,
    [HQ_IC_FUNDS_BRANCH_ID],
  );
  return res.rows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    balance: Number(r.balance) || 0,
  }));
}

export async function listCapitalBankAccountsAction(
  book: 'AED' | 'INR',
): Promise<ActionResult<Array<{ id: string; name: string; balance: number }>>> {
  const readDenied = await requireCapitalRead();
  if (readDenied) return readDenied;

  try {
    return { success: true, data: await fetchCapitalBankAccounts(book) };
  } catch (err) {
    logger.error({ err, book }, 'listCapitalBankAccountsAction failed');
    return { success: false, error: 'Failed to load bank accounts' };
  }
}

export async function listCapitalBankAccountsBothAction(): Promise<
  ActionResult<{ aed: Array<{ id: string; name: string; balance: number }>; inr: Array<{ id: string; name: string; balance: number }> }>
> {
  const readDenied = await requireCapitalRead();
  if (readDenied) return readDenied;

  try {
    const [aed, inr] = await runQueryBatch([
      () => fetchCapitalBankAccounts('AED'),
      () => fetchCapitalBankAccounts('INR'),
    ]);
    return { success: true, data: { aed, inr } };
  } catch (err) {
    logger.error({ err }, 'listCapitalBankAccountsBothAction failed');
    return { success: false, error: 'Failed to load bank accounts' };
  }
}

export async function listCapitalAllocationsAction(limit = 150): Promise<
  ActionResult<CapitalAllocationListRow[]>
> {
  const readDenied = await requireCapitalRead();
  if (readDenied) return readDenied;
  return { success: true, data: await fetchCapitalAllocations(limit) };
}

export async function listCapitalMovementsAction(limit = 100): Promise<
  ActionResult<
    Array<{
      id: string;
      investorName: string;
      movementType: string;
      book: string;
      lotDate: string;
      amountNative: number;
      inrPerAed: number;
      aedEq: number;
      notes: string;
    }>
  >
> {
  const readDenied = await requireCapitalRead();
  if (readDenied) return readDenied;
  return { success: true, data: await fetchCapitalMovements(limit) };
}
