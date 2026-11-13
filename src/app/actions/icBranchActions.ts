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
  name: string,
  code?: string | null,
  phone?: string,
  email?: string,
  address?: string,
  timezone?: string,
  managerIds?: string[] | null,
): Promise<DbActionResult<ICBranch>> {
  try {
    const parsed = branchBodySchema.parse({ name, code, phone, email, address, timezone });
    if (managerIds !== undefined) {
      const mgrErr = await validateIcBranchManagerIds(managerIds ?? []);
      if (mgrErr) return { success: false, error: mgrErr };
    }

    const existing = await query(`SELECT id FROM ic_branches WHERE id = $1 LIMIT 1`, [id]);
    if (existing.rows.length === 0) return { success: false, error: 'Branch not found' };

    await withTransaction(async client => {
      await client.query(
        `UPDATE ic_branches
         SET name = $2, code = $3, phone = $4, email = $5, address = $6, timezone = $7
         WHERE id = $1`,
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
      if (managerIds !== undefined) {
        await replaceIcBranchManagers(client, id, managerIds ?? []);
      }
    });

    const loaded = await loadIcBranchById(id);
    if (!loaded) return { success: false, error: 'Branch not found after update.' };
    revalidatePath('/admin/branches');
    revalidatePath(`/admin/branches/[id]`, 'page');
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
    const dep = await query(
      `SELECT 1 FROM ic_branch_deposits WHERE ic_branch_id = $1 LIMIT 1`,
      [id],
    );
    if (dep.rows.length > 0) {
      return { success: false, error: 'Cannot delete a branch that has customer deposits.' };
    }
    const del = await query(`DELETE FROM ic_branches WHERE id = $1 RETURNING id`, [id]);
    if (del.rows.length === 0) return { success: false, error: 'Branch not found' };
    revalidatePath('/admin/branches');
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, id }, 'dbDeleteICBranchAction failed');
    return { success: false, error: error instanceof Error ? error.message : 'Database error' };
  }
}

export async function dbGetICBranchManagersAction(icBranchId: string): Promise<string[]> {
  return fetchIcBranchManagerIds(icBranchId);
}
