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
import {
  normalizeCounterpartyKind,
  normalizeCounterpartyRoles,
  rolesForCounterpartyKind,
  type CounterpartyKind,
  type CounterpartyRole,
} from '@/lib/counterparties/roles';
import { syncCounterpartyAedAgent } from '@/lib/counterparties/aedAgentSync';
import { parseAedInrOpenings } from '@/lib/icFunds/entityOpenings';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { resolveHqBranchIds } from '@/lib/icFunds/resolveHqBranchIds';

function revalidateCounterpartyPaths(slug: string) {
  revalidatePath(`/${slug}/counterparties`);
  revalidatePath('/admin/counterparties');
  revalidatePath(`/admin/counterparties/[id]`, 'page');
  revalidatePath(`/${slug}/ic-funds/accounts`);
}

async function assertCounterpartyWriteAccess(slug: string) {
  let user = await getSessionUser(slug);
  if (!user && slug === HQ_IC_FUNDS_BRANCH_SLUG) {
    user = await getSessionUser();
  }
  if (!user) return { error: 'You must be signed in.' as const, user: null };
  if (user.role === 'customer') {
    return { error: 'Not authorized.' as const, user: null };
  }
  const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [slug]);
  if (branchRes.rows.length === 0) {
    return { error: 'Branch not found' as const, user: null };
  }
  const branchId = String(branchRes.rows[0].id);
  const hqIds = await resolveHqBranchIds();
  const onHqSlug = slug === HQ_IC_FUNDS_BRANCH_SLUG;
  if (
    user.branchId &&
    user.branchId !== branchId &&
    !(onHqSlug && user.role === 'admin') &&
    !(onHqSlug && hqIds.has(user.branchId))
  ) {
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
    kind?: CounterpartyKind;
    homeManagerId?: string | null;
    roles?: CounterpartyRole[];
    openingAed?: number;
    openingInr?: number;
  },
) {
  try {
    const access = await assertCounterpartyWriteAccess(slug);
    if ('error' in access && access.error) {
      return { success: false, error: access.error };
    }
    const branchId = access.branchId!;
    const country = data.country?.trim() || null;

    const codeResult = entityCodeSchema.safeParse(data.code);
    if (!codeResult.success) {
      return { success: false, error: codeResult.error.issues[0]?.message || 'Invalid code.' };
    }
    const parsedCode = codeResult.data;
    const status = data.status === 'inactive' ? 'inactive' : 'active';
    const kind = normalizeCounterpartyKind(data.kind);
    const homeManagerId =
      kind === 'customer' && data.homeManagerId?.trim() ? data.homeManagerId.trim() : null;
    const roles = rolesForCounterpartyKind(kind, data.roles);
    const hasOpenings = data.openingAed !== undefined || data.openingInr !== undefined;
    const opening = hasOpenings
      ? parseAedInrOpenings({ openingAed: data.openingAed, openingInr: data.openingInr })
      : null;

    if (data.id) {
      const existingRes = await query(
        `SELECT branch_id::text AS branch_id FROM ic_counterparties WHERE id = $1 LIMIT 1`,
        [data.id],
      );
      if (existingRes.rows.length === 0) {
        return { success: false, error: 'Counterparty not found' };
      }
      const hqIds = await resolveHqBranchIds();
      const rowBranchId = existingRes.rows[0].branch_id
        ? String(existingRes.rows[0].branch_id)
        : branchId;
      const scopedBranchId =
        rowBranchId === branchId || hqIds.has(rowBranchId) ? rowBranchId : branchId;

      const res = await query(
        opening
          ? `UPDATE ic_counterparties
             SET name = $1, code = $2, phone = $3, email = $4, address = $5, country = $6,
                 subdivision = $7, locality = $8, status = $9, roles = $10,
                 kind = $13, home_manager_id = $14,
                 opening_aed = $15, opening_inr = $16
             WHERE id = $11 AND branch_id = $12
             RETURNING *`
          : `UPDATE ic_counterparties
             SET name = $1, code = $2, phone = $3, email = $4, address = $5, country = $6,
                 subdivision = $7, locality = $8, status = $9, roles = $10,
                 kind = $13, home_manager_id = $14
             WHERE id = $11 AND branch_id = $12
             RETURNING *`,
        opening
          ? [
              data.name.trim(),
              parsedCode,
              data.phone?.trim() || null,
              data.email?.trim() || null,
              data.address?.trim() || null,
              country,
              data.subdivision?.trim() || null,
              data.locality?.trim() || null,
              status,
              roles,
              data.id,
              scopedBranchId,
              kind,
              homeManagerId,
              opening.openingAed,
              opening.openingInr,
            ]
          : [
              data.name.trim(),
              parsedCode,
              data.phone?.trim() || null,
              data.email?.trim() || null,
              data.address?.trim() || null,
              country,
              data.subdivision?.trim() || null,
              data.locality?.trim() || null,
              status,
              roles,
              data.id,
              scopedBranchId,
              kind,
              homeManagerId,
            ],
      );
      if (res.rowCount === 0) return { success: false, error: 'Counterparty not found' };
      await syncCounterpartyAedAgent({ query }, {
        counterpartyId: data.id,
        name: data.name.trim(),
        hasAgentRole: kind === 'agent',
      });
      if (kind === 'customer') {
        await syncICCounterpartyFundAccount(data.id);
      }
      revalidateCounterpartyPaths(slug);
      return { success: true, id: data.id };
    }

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO ic_counterparties (
         id, branch_id, name, code, phone, email, address, country, subdivision, locality, status, roles,
         kind, home_manager_id, opening_aed, opening_inr
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
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
        roles,
        kind,
        homeManagerId,
        (opening ?? parseAedInrOpenings(null)).openingAed,
        (opening ?? parseAedInrOpenings(null)).openingInr,
      ],
    );
    await syncCounterpartyAedAgent({ query }, {
      counterpartyId: id,
      name: data.name.trim(),
      hasAgentRole: kind === 'agent',
    });
    if (kind === 'customer') {
      await syncICCounterpartyFundAccount(id);
    }
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
