'use server';

import { query, withTransaction } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth';
import { assertStaffWriteAccess } from '@/app/actions/permissionActions';
import { logger } from '@/lib/logger';
import {
  ensureLinkedAccount,
  postVoucherInTx,
  syncICBranchDepositToICFunds,
  voidVoucherByReference,
  deleteVouchersByReference,
} from '@/lib/icFunds/icTransferFundSync';
import { ensureHqIcFundsBranch } from '@/lib/icFunds/ensureHqBranch';
import { mapBranchDepositRow } from '@/lib/icTransfer/branchDepositMapper';
import { assertManagerCustomerAllowedAtIcBranch } from '@/lib/icTransfer/icBranchManagerScope';
import { loadBranchTimeZoneInTx } from '@/lib/branchTimeZoneDb';
import { ledgerVoucherDateFromInstant } from '@/lib/toIsoDateString';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import type { BranchDepositKpis } from '@/lib/icTransfer/branchDepositKpis';
import type { ICBranchDeposit } from '@/types';

export type BranchDepositSummary = BranchDepositKpis & { icBranchId: string };
import { z } from 'zod';

const depositSchema = z
  .object({
    icBranchId: z.string().uuid(),
    managerId: z.string().uuid(),
    customerId: z.string().uuid(),
    settlementMode: z.enum(['cash', 'metal']).optional().default('cash'),
    amountAed: z.number().positive(),
    metalWeightG: z.number().positive().optional().nullable(),
    metalRateAedPerG: z.number().positive().optional().nullable(),
    depositDate: z.string().optional(),
    notes: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.settlementMode === 'metal') {
      if (!data.metalWeightG || data.metalWeightG <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Weight (g) required', path: ['metalWeightG'] });
      }
      if (!data.metalRateAedPerG || data.metalRateAedPerG <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Rate (AED/g) required', path: ['metalRateAedPerG'] });
      }
    }
  });

export async function createBranchDepositAction(
  slug: string,
  data: z.infer<typeof depositSchema>,
) {
  try {
    const user = await getSessionUser(slug);
    if (!user) return { success: false, error: 'You must be signed in.' };
    const parsed = depositSchema.parse(data);
    const denied = await assertStaffWriteAccess(user, 'warehouse', HQ_IC_FUNDS_BRANCH_ID);
    if (denied) return { success: false, error: denied };

    const icBranchId = parsed.icBranchId.trim();
    const scopeCheck = await assertManagerCustomerAllowedAtIcBranch({
      icBranchId,
      managerId: parsed.managerId,
      customerId: parsed.customerId,
    });
    if (scopeCheck) return { success: false, error: scopeCheck.error };

    const depositId = crypto.randomUUID();
    const depositInstant = new Date().toISOString();

    // ensureHqIcFundsBranch uses the global pool — call before opening transaction
    await ensureHqIcFundsBranch();

    await withTransaction(async client => {
      // 1. Validate branch + load timezone
      const brRes = await client.query<{ timezone: string | null; name: string | null }>(
        `SELECT timezone, name FROM ic_branches WHERE id = $1 LIMIT 1`,
        [icBranchId],
      );
      if (brRes.rows.length === 0) throw new Error('Branch not found.');
      const branchTz = String(brRes.rows[0].timezone || 'Asia/Dubai').trim();
      const deskName = (brRes.rows[0].name ? String(brRes.rows[0].name) : '').trim() || icBranchId;
      await loadBranchTimeZoneInTx(client, HQ_IC_FUNDS_BRANCH_ID);

      // 2. Resolve customer name for journal notes
      const custRes = await client.query<{ name: string | null }>(
        `SELECT name FROM ic_counterparties WHERE id = $1 LIMIT 1`,
        [parsed.customerId],
      );
      const customerName = custRes.rows[0] ? String(custRes.rows[0].name || 'Customer') : 'Customer';

      const depositDate =
        parsed.depositDate?.trim() || ledgerVoucherDateFromInstant(depositInstant, branchTz);

      // 3. Insert the deposit row
      await client.query(
        `INSERT INTO ic_branch_deposits (
           id, branch_id, ic_branch_id, manager_id, customer_id,
           settlement_mode, amount_aed, metal_weight_g, metal_rate_aed_per_g,
           deposit_date, notes, entered_by_user_id, entered_by_name
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          depositId,
          HQ_IC_FUNDS_BRANCH_ID,
          icBranchId,
          parsed.managerId,
          parsed.customerId,
          parsed.settlementMode,
          parsed.amountAed,
          parsed.settlementMode === 'metal' ? parsed.metalWeightG : null,
          parsed.settlementMode === 'metal' ? parsed.metalRateAedPerG : null,
          depositDate,
          parsed.notes?.trim() || null,
          user.id || null,
          user.name || null,
        ],
      );

      // 4. Update the branch cash balance
      await client.query(
        `UPDATE ic_branches SET cash_balance = COALESCE(cash_balance, 0) + $2 WHERE id = $1`,
        [icBranchId, parsed.amountAed],
      );

      // 5. Post the IC Funds AED journal — inlined from syncICBranchDepositToICFunds
      const amount = roundLedgerAmount(parsed.amountAed);
      if (amount > 0) {
        await voidVoucherByReference(client, HQ_IC_FUNDS_BRANCH_ID, 'ic_branch_deposit', depositId);

        const tillAccountId = await ensureLinkedAccount(client, {
          branchId: HQ_IC_FUNDS_BRANCH_ID,
          sourceType: 'ic_branch',
          sourceId: icBranchId,
          name: deskName,
        });
        const customerAccountId = await ensureLinkedAccount(client, {
          branchId: HQ_IC_FUNDS_BRANCH_ID,
          sourceType: 'ic_counterparty',
          sourceId: parsed.customerId,
          name: customerName,
        });
        if (!tillAccountId || !customerAccountId) {
          throw new Error('Could not resolve IC Funds accounts for branch deposit');
        }

        const notes =
          parsed.settlementMode === 'metal'
            ? `Metal deposit at ${deskName} · ${parsed.metalWeightG ?? 0}g · ${depositId.slice(0, 8)}`
            : `AED deposit at ${deskName} · ${depositId.slice(0, 8)}`;

        await postVoucherInTx(client, {
          branchId: HQ_IC_FUNDS_BRANCH_ID,
          voucherType: 'journal',
          voucherDate: depositDate,
          debitAccountId: tillAccountId,
          creditAccountId: customerAccountId,
          amount,
          notes,
          referenceType: 'ic_branch_deposit',
          referenceId: depositId,
        });
      }
    });

    revalidatePath('/admin/branches');
    revalidatePath(`/admin/branches/[id]`, 'page');
    return { success: true, id: depositId };
  } catch (err: unknown) {
    logger.error({ err, slug, data }, 'createBranchDepositAction');
    return { success: false, error: err instanceof Error ? err.message : 'Could not save deposit.' };
  }
}

export async function deleteBranchDepositAction(slug: string, depositId: string) {
  const id = depositId?.trim();
  if (!id) return { success: false, error: 'Deposit id is required.' };

  try {
    const user = await getSessionUser(slug);
    if (!user) return { success: false, error: 'You must be signed in.' };

    const depRes = await query<{
      branch_id: string;
      ic_branch_id: string | null;
      amount_aed: string | number;
    }>(`SELECT branch_id, ic_branch_id, amount_aed FROM ic_branch_deposits WHERE id = $1 LIMIT 1`, [
      id,
    ]);
    if (depRes.rows.length === 0) {
      return { success: false, error: 'Deposit not found.' };
    }
    const row = depRes.rows[0];
    const amount = Number(row.amount_aed) || 0;
    const icBranchId = row.ic_branch_id ? String(row.ic_branch_id) : null;

    const denied = await assertStaffWriteAccess(user, 'warehouse', HQ_IC_FUNDS_BRANCH_ID);
    if (denied) return { success: false, error: denied };

    await withTransaction(async client => {
      // 1. Void the IC Funds journal inside the same tx (atomic with delete)
      await voidVoucherByReference(client, HQ_IC_FUNDS_BRANCH_ID, 'ic_branch_deposit', id);
      await deleteVouchersByReference(client, HQ_IC_FUNDS_BRANCH_ID, ['ic_branch_deposit'], id);

      // 2. Delete the deposit row
      const del = await client.query(`DELETE FROM ic_branch_deposits WHERE id = $1 RETURNING id`, [id]);
      if (del.rows.length === 0) {
        throw new Error('Deposit not found.');
      }

      // 3. Reverse the branch cash balance
      if (amount > 0 && icBranchId) {
        await client.query(
          `UPDATE ic_branches SET cash_balance = COALESCE(cash_balance, 0) - $2 WHERE id = $1`,
          [icBranchId, amount],
        );
      }
    });

    revalidatePath('/admin/branches');
    revalidatePath(`/admin/branches/[id]`, 'page');
    return { success: true };
  } catch (err: unknown) {
    logger.error({ err, slug, depositId: id }, 'deleteBranchDepositAction');
    return { success: false, error: err instanceof Error ? err.message : 'Could not delete deposit.' };
  }
}

/** Per-branch deposit totals for a date range (branches list KPIs / matrix). */
export async function listBranchDepositSummariesAction(params: {
  startDate?: string | null;
  endDate?: string | null;
}): Promise<BranchDepositSummary[]> {
  try {
    const user = await getSessionUser();
    if (!user || user.role === 'customer') return [];

    const res = await query<{
      ic_branch_id: string;
      deposit_count: number;
      total_aed: string;
      cash_count: number;
      cash_aed: string;
      metal_count: number;
      metal_aed: string;
      metal_weight_g: string;
    }>(
      `SELECT
         d.ic_branch_id::text AS ic_branch_id,
         COUNT(*)::int AS deposit_count,
         COALESCE(SUM(d.amount_aed), 0)::text AS total_aed,
         COUNT(*) FILTER (WHERE d.settlement_mode = 'cash')::int AS cash_count,
         COALESCE(SUM(d.amount_aed) FILTER (WHERE d.settlement_mode = 'cash'), 0)::text AS cash_aed,
         COUNT(*) FILTER (WHERE d.settlement_mode = 'metal')::int AS metal_count,
         COALESCE(SUM(d.amount_aed) FILTER (WHERE d.settlement_mode = 'metal'), 0)::text AS metal_aed,
         COALESCE(SUM(d.metal_weight_g) FILTER (WHERE d.settlement_mode = 'metal'), 0)::text AS metal_weight_g
       FROM ic_branch_deposits d
       WHERE ($1::date IS NULL OR d.deposit_date >= $1::date)
         AND ($2::date IS NULL OR d.deposit_date <= $2::date)
       GROUP BY d.ic_branch_id`,
      [params.startDate ?? null, params.endDate ?? null],
    );

    return res.rows.map(row => ({
      icBranchId: String(row.ic_branch_id),
      depositCount: Number(row.deposit_count) || 0,
      totalAed: Number(row.total_aed) || 0,
      cashCount: Number(row.cash_count) || 0,
      cashAed: Number(row.cash_aed) || 0,
      metalCount: Number(row.metal_count) || 0,
      metalAed: Number(row.metal_aed) || 0,
      metalWeightG: Number(row.metal_weight_g) || 0,
    }));
  } catch (err: unknown) {
    logger.error({ err, params }, 'listBranchDepositSummariesAction');
    return [];
  }
}

export async function listBranchDepositsAction(params: {
  icBranchId: string;
  startDate?: string | null;
  endDate?: string | null;
  slug?: string;
  limit?: number;
}): Promise<ICBranchDeposit[]> {
  const icBranchId = String(params.icBranchId || '').trim();
  if (!icBranchId) return [];

  try {
    const slug = params.slug?.trim();
    let user = slug ? await getSessionUser(slug) : await getSessionUser();
    if (!user && slug) {
      user = await getSessionUser();
    }
    if (!user || user.role === 'customer') return [];

    const limit = Math.min(Math.max(params.limit ?? 500, 1), 1000);
    const res = await query(
      `SELECT d.*, m.name AS manager_name, c.name AS customer_name
       FROM ic_branch_deposits d
       JOIN ic_counterparties m ON m.id = d.manager_id
       JOIN ic_counterparties c ON c.id = d.customer_id
       WHERE d.ic_branch_id = $1
         AND ($2::date IS NULL OR d.deposit_date >= $2::date)
         AND ($3::date IS NULL OR d.deposit_date <= $3::date)
       ORDER BY d.deposit_date DESC, d.created_at DESC
       LIMIT $4`,
      [icBranchId, params.startDate ?? null, params.endDate ?? null, limit],
    );

    return res.rows.map((row: Record<string, unknown>) => mapBranchDepositRow(row));
  } catch (err: unknown) {
    logger.error({ err, params }, 'listBranchDepositsAction');
    return [];
  }
}

async function listDepositsQuery(
  extraWhere: string,
  params: unknown[],
): Promise<ICBranchDeposit[]> {
  const res = await query(
    `SELECT d.*, m.name AS manager_name, c.name AS customer_name
     FROM ic_branch_deposits d
     JOIN ic_counterparties m ON m.id = d.manager_id
     JOIN ic_counterparties c ON c.id = d.customer_id
     WHERE ${extraWhere}
     ORDER BY d.deposit_date DESC, d.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
  return res.rows.map((row: Record<string, unknown>) => mapBranchDepositRow(row));
}

/** Post missing HQ journals for this customer's branch deposits (e.g. after a failed sync). */
export async function repairCustomerDepositLedgersAction(customerId: string): Promise<{ repaired: number }> {
  const id = String(customerId || '').trim();
  if (!id) return { repaired: 0 };
  try {
    const user = await getSessionUser();
    if (!user || user.role === 'customer') return { repaired: 0 };

    const deps = await query<{ id: string }>(
      `SELECT id::text AS id FROM ic_branch_deposits WHERE customer_id = $1::uuid ORDER BY created_at DESC LIMIT 100`,
      [id],
    );
    let repaired = 0;
    for (const row of deps.rows) {
      const depositId = String(row.id);
      const voucher = await query(
        `SELECT 1 FROM ic_fund_vouchers
         WHERE branch_id = $1
           AND reference_type = 'ic_branch_deposit'
           AND reference_id = $2
           AND status IS DISTINCT FROM 'void'
         LIMIT 1`,
        [HQ_IC_FUNDS_BRANCH_ID, depositId],
      );
      if (voucher.rows.length > 0) continue;
      await syncICBranchDepositToICFunds(depositId);
      repaired += 1;
    }
    return { repaired };
  } catch (err: unknown) {
    logger.error({ err, customerId: id }, 'repairCustomerDepositLedgersAction');
    return { repaired: 0 };
  }
}

export async function listDepositsByCustomerAction(params: {
  customerId: string;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
}): Promise<ICBranchDeposit[]> {
  const customerId = String(params.customerId || '').trim();
  if (!customerId) return [];
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 1000);
  try {
    const user = await getSessionUser();
    if (!user || user.role === 'customer') return [];
    return listDepositsQuery(
      `d.customer_id = $1::uuid
         AND ($2::date IS NULL OR d.deposit_date >= $2::date)
         AND ($3::date IS NULL OR d.deposit_date <= $3::date)`,
      [customerId, params.startDate ?? null, params.endDate ?? null, limit],
    );
  } catch (err: unknown) {
    logger.error({ err, params }, 'listDepositsByCustomerAction');
    return [];
  }
}

export async function listDepositsByManagerAction(params: {
  managerId: string;
  startDate?: string | null;
  endDate?: string | null;
  limit?: number;
}): Promise<ICBranchDeposit[]> {
  const managerId = String(params.managerId || '').trim();
  if (!managerId) return [];
  const limit = Math.min(Math.max(params.limit ?? 500, 1), 1000);
  try {
    const user = await getSessionUser();
    if (!user || user.role === 'customer') return [];
    return listDepositsQuery(
      `d.manager_id = $1::uuid
         AND ($2::date IS NULL OR d.deposit_date >= $2::date)
         AND ($3::date IS NULL OR d.deposit_date <= $3::date)`,
      [managerId, params.startDate ?? null, params.endDate ?? null, limit],
    );
  } catch (err: unknown) {
    logger.error({ err, params }, 'listDepositsByManagerAction');
    return [];
  }
}
