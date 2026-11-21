'use server';

import { query, withTransaction } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import type { DbActionResult } from '@/lib/dbActionTypes';
import type { ICBranch } from '@/types';
import { mapICBranchRow } from '@/lib/icTransferMappers';
import { IC_BRANCH_SELECT } from '@/lib/icTransfer/icBranchQueries';
import {
  replaceIcBranchManagers,
  fetchIcBranchManagerIds,
} from '@/lib/icTransfer/icBranchManagerScope';
import { z } from 'zod';
import { entityCodeConflictMessage } from '@/lib/validations/entityCode';

async function loadIcBranchById(id: string): Promise<ICBranch | null> {
  const res = await query(`${IC_BRANCH_SELECT} WHERE b.id = $1 LIMIT 1`, [id]);
  return res.rows[0] ? mapICBranchRow(res.rows[0]) : null;
}

async function validateIcBranchManagerIds(managerIds: string[] | undefined): Promise<string | null> {
  const ids = [...new Set((managerIds ?? []).map(id => id.trim()).filter(Boolean))];
  if (ids.length === 0) return 'Assign at least one manager to this branch.';
  const res = await query(
    `SELECT id::text AS id FROM ic_counterparties
     WHERE id = ANY($1::uuid[]) AND kind = 'manager' AND status = 'active'`,
    [ids],
  );
  if (res.rows.length !== ids.length) return 'One or more selected managers are invalid.';
  return null;
}

const branchBodySchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(32).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  address: z.string().optional().nullable(),
  timezone: z.string().max(64).optional().default('Asia/Dubai'),
});

export async function dbAddICBranchAction(
  name: string,
  code?: string | null,
  phone?: string,
  email?: string,
  address?: string,
  timezone?: string,
  managerIds?: string[],
): Promise<DbActionResult<ICBranch>> {
  try {
    const parsed = branchBodySchema.parse({ name, code, phone, email, address, timezone });
    const mgrErr = await validateIcBranchManagerIds(managerIds);
    if (mgrErr) return { success: false, error: mgrErr };

    const id = crypto.randomUUID();
    await withTransaction(async client => {
      await client.query(
        `INSERT INTO ic_branches (id, name, code, phone, email, address, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          parsed.name.trim(),
          parsed.code?.trim() || null,
          parsed.phone?.trim() || null,
          parsed.email?.trim() || null,
          parsed.address?.trim() || null,
          parsed.timezone?.trim() || 'Asia/Dubai',
        ],
      );
      if (managerIds?.length) {
        await replaceIcBranchManagers(client, id, managerIds);
      }
    });

    const loaded = await loadIcBranchById(id);
    if (!loaded) return { success: false, error: 'Branch not found after create.' };
    revalidatePath('/admin/branches');
    return { success: true, data: loaded };
  } catch (error: unknown) {
    const conflict = entityCodeConflictMessage(error);
    if (conflict) return { success: false, error: conflict };
    logger.error({ error, name }, 'dbAddICBranchAction failed');
    return { success: false, error: error instanceof Error ? error.message : 'Database error' };
  }
}

export async function dbUpdateICBranchAction(
  id: string,
  code?: string | null,
  phone?: string,
  email?: string,
  address?: string,
  timezone?: string,
  managerIds?: string[] | null,
): Promise<DbActionResult<ICBranch>> {
  try {
    const parsed = branchBodySchema.omit({ name: true }).parse({ code, phone, email, address, timezone });
    if (managerIds !== undefined) {
      const mgrErr = await validateIcBranchManagerIds(managerIds ?? []);
      if (mgrErr) return { success: false, error: mgrErr };
    }

    const existing = await query(`SELECT id FROM ic_branches WHERE id = $1 LIMIT 1`, [id]);
    if (existing.rows.length === 0) return { success: false, error: 'Branch not found' };

    await withTransaction(async client => {
      await client.query(
        `UPDATE ic_branches
         SET code = $2, phone = $3, email = $4, address = $5, timezone = $6
         WHERE id = $1`,
        [
          id,
          parsed.code?.trim() || null,
          parsed.phone?.trim() || null,
          parsed.email?.trim() || null,
          parsed.address?.trim() || null,
          parsed.timezone?.trim() || 'Asia/Dubai',
        ],
      );
      if (managerIds !== undefined) {
        await replaceIcBranchManagers(client, id, managerIds ?? []);
      }
    });

    const loaded = await loadIcBranchById(id);
    if (!loaded) return { success: false, error: 'Branch not found after update.' };
    revalidatePath('/admin/branches');
    revalidatePath(`/admin/branches/[id]`, 'page');
    // Branch details are rendered across the app; refresh previously visited
    // routes after branch changes so their server-rendered details stay current.
    revalidatePath('/', 'layout');
    return { success: true, data: loaded };
  } catch (error: unknown) {
    const conflict = entityCodeConflictMessage(error);
    if (conflict) return { success: false, error: conflict };
    logger.error({ error, id }, 'dbUpdateICBranchAction failed');
    return { success: false, error: error instanceof Error ? error.message : 'Database error' };
  }
}

export async function dbDeleteICBranchAction(id: string): Promise<DbActionResult<void>> {
  try {
    const result = await withTransaction(async client => {
      const branch = await client.query(`SELECT id FROM ic_branches WHERE id = $1 FOR UPDATE`, [id]);
      if (branch.rows.length === 0) return { error: 'Branch not found' };

      const dep = await client.query(
        `SELECT 1 FROM ic_branch_deposits WHERE ic_branch_id = $1 LIMIT 1`,
        [id],
      );
      if (dep.rows.length > 0) {
        return { error: 'Cannot delete a branch with associated customer deposits.' };
      }

      const bankAccounts = await client.query(
        `SELECT id, opening_balance FROM ic_fund_accounts
         WHERE source_type = 'ic_branch' AND source_id = $1
         FOR UPDATE`,
        [id],
      );
      const accountIds = bankAccounts.rows.map(row => String(row.id));
      if (accountIds.length > 0) {
        if (bankAccounts.rows.some(row => Number(row.opening_balance) !== 0)) {
          return { error: 'Cannot delete a branch with an opening balance in its associated bank account.' };
        }
        const vouchers = await client.query(
          `SELECT 1 FROM ic_fund_vouchers
           WHERE (debit_account_id = ANY($1::varchar[])
              OR credit_account_id = ANY($1::varchar[]))
             AND status IN ('active', 'pending')
           LIMIT 1`,
          [accountIds],
        );
        if (vouchers.rows.length > 0) {
          return { error: 'Cannot delete a branch with entries in its associated bank account.' };
        }
        await client.query(
          `DELETE FROM ic_fund_accounts a
           WHERE a.id = ANY($1::varchar[])
             AND NOT EXISTS (
               SELECT 1 FROM ic_fund_vouchers v
               WHERE v.debit_account_id = a.id OR v.credit_account_id = a.id
             )`,
          [accountIds],
        );
      }

      await client.query(`DELETE FROM ic_branches WHERE id = $1`, [id]);
      return { error: null };
    });
    if (result.error) return { success: false, error: result.error };
    revalidatePath('/admin/branches');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, id }, 'dbDeleteICBranchAction failed');
    return { success: false, error: error instanceof Error ? error.message : 'Database error' };
  }
}

export async function dbGetICBranchManagersAction(icBranchId: string): Promise<string[]> {
  return fetchIcBranchManagerIds(icBranchId);
}
