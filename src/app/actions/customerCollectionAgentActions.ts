'use server';

import { z } from 'zod';
import { query } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { assertStaffWriteAccess } from '@/app/actions/permissionActions';
import { logger } from '@/lib/logger';
import { assertCurrencyMatch, normalizeAccountCurrency } from '@/lib/icTransfer/icWallet';

const assignSchema = z.object({
  customerId: z.string().trim().min(1),
  collectionAccountIds: z.array(z.string().trim().min(1)).min(1),
  primaryCollectionAccountId: z.string().trim().min(1).optional(),
});

async function assertAdminWrite(branchSlug?: string) {
  const user = await getSessionUser(branchSlug);
  if (!user) return { error: 'You must be signed in.' as const, user: null };
  if (user.role === 'customer') return { error: 'Unauthorized' as const, user: null };
  if (!branchSlug || branchSlug === 'superadmin') {
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return { error: 'Unauthorized' as const, user: null };
    }
    return { error: null, user };
  }
  const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [branchSlug]);
  if (branchRes.rows.length === 0) return { error: 'Branch not found' as const, user: null };
  const branchId = String(branchRes.rows[0].id);
  const denied = await assertStaffWriteAccess(user, 'customers', branchId);
  if (denied) return { error: denied, user: null };
  return { error: null, user };
}

export async function listCustomerCollectionAgentsAction(customerId: string, branchSlug?: string) {
  try {
    const user = await getSessionUser(branchSlug);
    if (!user) return { success: false as const, error: 'Unauthorized' };

    const res = await query(
      `SELECT cca.id, cca.customer_id, cca.collection_account_id, cca.is_primary,
              a.name AS collection_account_name, a.currency, a.status
       FROM customer_collection_agents cca
       JOIN ic_fund_accounts a ON a.id = cca.collection_account_id
       WHERE cca.customer_id = $1
       ORDER BY cca.is_primary DESC, a.name ASC`,
      [customerId],
    );

    return {
      success: true as const,
      agents: res.rows.map(row => ({
        id: String(row.id),
        customerId: String(row.customer_id),
        collectionAccountId: String(row.collection_account_id),
        collectionAccountName: String(row.collection_account_name),
        currency: normalizeAccountCurrency(row.currency),
        isPrimary: Boolean(row.is_primary),
        status: String(row.status),
      })),
    };
  } catch (err) {
    logger.error({ err, customerId }, 'listCustomerCollectionAgentsAction failed');
    return { success: false as const, error: 'Failed to load collection agents' };
  }
}

export async function setCustomerCollectionAgentsAction(
  input: z.infer<typeof assignSchema>,
  branchSlug?: string,
) {
  try {
    const access = await assertAdminWrite(branchSlug);
    if (access.error) return { success: false as const, error: access.error };

    const parsed = assignSchema.parse(input);
    const uniqueIds = [...new Set(parsed.collectionAccountIds)];
    const primaryId = parsed.primaryCollectionAccountId || uniqueIds[0];

    if (!uniqueIds.includes(primaryId)) {
      return { success: false as const, error: 'Primary agent must be in the assigned list' };
    }

    const customerRes = await query(
      `SELECT id, currency FROM customers WHERE id = $1 LIMIT 1`,
      [parsed.customerId],
    );
    if (customerRes.rows.length === 0) {
      return { success: false as const, error: 'Customer not found' };
    }
    const customerCurrency = normalizeAccountCurrency(customerRes.rows[0].currency);

    const agentsRes = await query(
      `SELECT id, name, currency, account_type, status
       FROM ic_fund_accounts
       WHERE id = ANY($1::varchar[])`,
      [uniqueIds],
    );
    if (agentsRes.rows.length !== uniqueIds.length) {
      return { success: false as const, error: 'One or more collection agents were not found' };
    }

    for (const row of agentsRes.rows) {
      if (String(row.account_type) !== 'collection_agent') {
        return { success: false as const, error: `${row.name} is not a collection agent account` };
      }
      if (String(row.status) !== 'active') {
        return { success: false as const, error: `${row.name} is inactive` };
      }
      try {
        assertCurrencyMatch('Collection agent', customerCurrency, String(row.currency));
      } catch (e) {
        return {
          success: false as const,
          error: e instanceof Error ? e.message : 'Currency mismatch',
        };
      }
    }

    await query(`DELETE FROM customer_collection_agents WHERE customer_id = $1`, [parsed.customerId]);

    for (const accountId of uniqueIds) {
      await query(
        `INSERT INTO customer_collection_agents (
           customer_id, collection_account_id, is_primary, created_by, created_by_name
         ) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (customer_id, collection_account_id) DO NOTHING`,
        [
          parsed.customerId,
          accountId,
          accountId === primaryId,
          access.user?.email || 'system',
          access.user?.name || 'System',
        ],
      );
    }

    return { success: true as const };
  } catch (err) {
    logger.error({ err, input }, 'setCustomerCollectionAgentsAction failed');
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to assign collection agents',
    };
  }
}

export async function listCollectionAgentsForCustomerAction(customerId: string, branchSlug?: string) {
  return listCustomerCollectionAgentsAction(customerId, branchSlug);
}
