'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { assertStaffWriteAccess } from '@/app/actions/permissionActions';
import { syncICCounterpartyFundAccount } from '@/lib/icFunds/icTransferFundSync';
import { entityCodeSchema, entityCodeConflictMessage } from '@/lib/validations/entityCode';
import { COUNTERPARTY_SELECT } from '@/lib/counterparties/mapper';
import { mapICCounterpartyRow } from '@/lib/counterparties/mapper';

function revalidateCounterpartyPaths(slug: string) {
  revalidatePath(`/${slug}/counterparties`);
  revalidatePath('/admin/counterparties');
  revalidatePath(`/admin/counterparties/[id]`, 'page');
  revalidatePath(`/${slug}/ic-funds/accounts`);
}

async function assertCounterpartyWriteAccess(slug: string) {
  const user = await getSessionUser(slug);
  if (!user) return { error: 'You must be signed in.' as const, user: null };
  if (user.role === 'customer') {
    return { error: 'Not authorized.' as const, user: null };
  }
  const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [slug]);
  if (branchRes.rows.length === 0) {
    return { error: 'Branch not found' as const, user: null };
  }
  const branchId = String(branchRes.rows[0].id);
  if (user.branchId && user.branchId !== branchId) {
    return { error: 'You are not authorized for this branch.' as const, user: null };
  }
  const denied = await assertStaffWriteAccess(user, 'customers', branchId);
  if (denied) return { error: denied, user: null };
  return { user, branchId };
}

const HAS_ACTIVITY_SQL = `
  EXISTS (SELECT 1 FROM ic_sales WHERE counterparty_id = $1 LIMIT 1)
  OR EXISTS (SELECT 1 FROM ic_purchases WHERE counterparty_id = $1 LIMIT 1)
`;

export async function saveCounterpartyAction(
  slug: string,
  data: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    status?: string;
    country?: string;
    subdivision?: string;
    locality?: string;
    code?: string | null;
  },
) {
  try {
    const access = await assertCounterpartyWriteAccess(slug);
    if ('error' in access && access.error) {
      return { success: false, error: access.error };
    }
    const branchId = access.branchId!;
    const country = data.country?.trim() || '';
    if (!country) return { success: false, error: 'Country is required.' };

    const codeResult = entityCodeSchema.safeParse(data.code);
    if (!codeResult.success) {
      return { success: false, error: codeResult.error.issues[0]?.message || 'Invalid code.' };
    }
    const parsedCode = codeResult.data;
    const status = data.status === 'inactive' ? 'inactive' : 'active';

    if (data.id) {
      const res = await query(
        `UPDATE ic_counterparties
         SET name = $1, code = $2, phone = $3, email = $4, address = $5, country = $6,
             subdivision = $7, locality = $8, status = $9
         WHERE id = $10 AND branch_id = $11
         RETURNING *`,
        [
          data.name.trim(),
          parsedCode,
          data.phone?.trim() || null,
          data.email?.trim() || null,
          data.address?.trim() || null,
          country,
          data.subdivision?.trim() || null,
          data.locality?.trim() || null,
          status,
          data.id,
          branchId,
        ],
      );
      if (res.rowCount === 0) return { success: false, error: 'Counterparty not found' };
      await syncICCounterpartyFundAccount(data.id);
      revalidateCounterpartyPaths(slug);
      return { success: true, id: data.id };
    }

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO ic_counterparties (
         id, branch_id, name, code, phone, email, address, country, subdivision, locality, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        branchId,
        data.name.trim(),
        parsedCode,
        data.phone?.trim() || null,
        data.email?.trim() || null,
        data.address?.trim() || null,
        country,
        data.subdivision?.trim() || null,
        data.locality?.trim() || null,
        status,
      ],
    );
    await syncICCounterpartyFundAccount(id);
    revalidateCounterpartyPaths(slug);
    return { success: true, id };
  } catch (err: unknown) {
    const conflict = entityCodeConflictMessage(err);
    if (conflict) return { success: false, error: conflict };
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, slug, data }, 'saveCounterpartyAction');
    return { success: false, error: message };
  }
}

export async function deleteCounterpartyAction(slug: string, counterpartyId: string) {
  try {
    const access = await assertCounterpartyWriteAccess(slug);
    if ('error' in access && access.error) {
      return { success: false, error: access.error };
    }
    const block = await query(`SELECT (${HAS_ACTIVITY_SQL}) AS blocked`, [counterpartyId]);
    if (block.rows[0]?.blocked) {
      return {
        success: false,
        error: 'This counterparty cannot be deleted because they have purchases or sales.',
      };
    }
    const res = await query(
      `DELETE FROM ic_counterparties WHERE id = $1 AND branch_id = $2`,
      [counterpartyId, access.branchId],
    );
    if (res.rowCount === 0) return { success: false, error: 'Counterparty not found' };
    revalidateCounterpartyPaths(slug);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err, slug, counterpartyId }, 'deleteCounterpartyAction');
    return { success: false, error: message };
  }
}

export async function listCounterpartiesBySlug(slug: string) {
  try {
    const res = await query(
      `SELECT ${COUNTERPARTY_SELECT},
        (
          EXISTS (SELECT 1 FROM ic_sales s WHERE s.counterparty_id = cp.id)
          OR EXISTS (SELECT 1 FROM ic_purchases p WHERE p.counterparty_id = cp.id)
        ) AS has_orders
       FROM ic_counterparties cp
       JOIN branches b ON cp.branch_id = b.id
       WHERE b.slug = $1
       ORDER BY cp.name ASC`,
      [slug],
    );
    return {
      success: true,
      counterparties: res.rows.map(r => ({
        ...mapICCounterpartyRow(r),
        hasOrders: Boolean(r.has_orders),
      })),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message, counterparties: [] };
  }
}
