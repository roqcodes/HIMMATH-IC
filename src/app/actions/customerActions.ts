'use server';

import { query } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { getSessionUser } from '@/lib/auth';
import { assertStaffWriteAccess } from '@/app/actions/permissionActions';
import { createCustomerCognitoUser, deleteCognitoUserByEmail, resetCustomerCognitoPasswordAction, updateCognitoUserName } from '@/app/actions/cognitoActions';
import { PASSWORD_INVALID_MESSAGE, validatePassword } from '@/lib/passwordValidation';
import { syncCustomerFundAccount, deactivateCustomerFundAccount } from '@/lib/icFunds/customerFundSync';
import { syncICCounterpartyFundAccount } from '@/lib/icFunds/icTransferFundSync';
import { isHqAdminStaff } from '@/lib/icFunds/hqBranch';
import { readSectionAccess } from '@/lib/staffSectionPermissions';
import { entityCodeSchema, entityCodeConflictMessage } from '@/lib/validations/entityCode';

function revalidateCustomerPaths(slug: string) {
  revalidatePath(`/${slug}/customers`);
  revalidatePath('/admin/customers');
  revalidatePath(`/${slug}/ic-funds/accounts`);
}

const CUSTOMER_DELETE_BLOCKED_MESSAGE =
  'This customer cannot be deleted because they have existing orders or transactions.';

function customerHasOrdersExpr(customerIdRef: string): string {
  return `(EXISTS (SELECT 1 FROM ic_sales WHERE order_customer_id = ${customerIdRef} LIMIT 1))`;
}

async function customerHasAnyOrders(customerId: string): Promise<boolean> {
  const res = await query(`SELECT ${customerHasOrdersExpr('$1')} AS has_orders`, [customerId]);
  return Boolean(res.rows[0]?.has_orders);
}

function mapCustomerRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    branchId: String(r.branch_id),
    name: String(r.name),
    code: r.code ? String(r.code) : undefined,
    phone: r.phone ? String(r.phone) : undefined,
    email: r.email ? String(r.email) : undefined,
    balance: parseFloat(String(r.balance ?? 0)),
    status: String(r.status ?? 'active'),
    country: r.country ? String(r.country) : undefined,
    subdivision: r.subdivision ? String(r.subdivision) : undefined,
    locality: r.locality ? String(r.locality) : undefined,
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : undefined,
    cognitoUserId: r.auth_user_id ? String(r.auth_user_id) : undefined,
    hasOrders: Boolean(r.has_orders),
    netUsdt: r.net_usdt != null ? parseFloat(String(r.net_usdt)) : 0,
  };
}

async function assertCustomerWriteAccess(slug: string) {
  const user = await getSessionUser(slug);
  if (!user) return { error: 'You must be signed in.' as const, user: null };
  if (user.role === 'customer') {
    return { error: 'Customers cannot manage customer records.' as const, user: null };
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

export async function getCustomersBySlug(slug: string) {
  try {
    const res = await query(
      `
      SELECT c.*,
        COALESCE(h.has_orders, false) AS has_orders,
        0 AS net_usdt
      FROM customers c
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN (
        SELECT DISTINCT order_customer_id AS customer_id, true AS has_orders
        FROM ic_sales
        WHERE order_customer_id IS NOT NULL
      ) h ON h.customer_id = c.id
      WHERE b.slug = $1
      ORDER BY c.created_at DESC
    `,
      [slug],
    );
    return { success: true, customers: res.rows.map(mapCustomerRow) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err, slug }, 'getCustomers error');
    return { success: false, error: message };
  }
}

export async function getCustomerByCognitoUserId(cognitoUserId: string) {
  try {
    const res = await query(
      `SELECT c.* FROM customers c WHERE c.auth_user_id = $1 LIMIT 1`,
      [cognitoUserId],
    );
    if (res.rows.length === 0) {
      return { success: false, error: 'Customer not found' };
    }
    return { success: true, customer: mapCustomerRow(res.rows[0]) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err, cognitoUserId }, 'getCustomerByCognitoUserId error');
    return { success: false, error: message };
  }
}

export async function getAllCustomers() {
  const user = await getSessionUser();
  const canList =
    user?.role === 'admin' ||
    user?.role === 'auditor' ||
    (user?.role === 'staff' &&
      isHqAdminStaff(user) &&
      readSectionAccess(user.permissions, 'customers') !== 'none');
  if (!canList) {
    return { success: false as const, error: 'Unauthorized', customers: [] };
  }
  try {
    const res = await query(
      `
      SELECT c.*,
        COALESCE(h.has_orders, false) AS has_orders,
        0 AS net_usdt
      FROM customers c
      LEFT JOIN (
        SELECT DISTINCT order_customer_id AS customer_id, true AS has_orders
        FROM ic_sales
        WHERE order_customer_id IS NOT NULL
      ) h ON h.customer_id = c.id
      ORDER BY c.name ASC
    `,
    );
    return { success: true, customers: res.rows.map(mapCustomerRow) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err }, 'getAllCustomers error');
    return { success: false, error: message };
  }
}

export async function getCustomerById(customerId: string, slug?: string) {
  try {
    const res = await query(
      `
      SELECT c.*
      FROM customers c
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.id = $1
        AND ($2::text IS NULL OR b.slug = $2)
      LIMIT 1
    `,
      [customerId, slug ?? null],
    );
    if (res.rows.length === 0) {
      return { success: false, error: 'Customer not found' };
    }
    return { success: true, customer: mapCustomerRow(res.rows[0]) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err, customerId, slug }, 'getCustomerById error');
    return { success: false, error: message };
  }
}

export async function saveCustomer(
  slug: string,
  data: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
    password?: string;
    balance?: number | string;
    status?: string;
    enablePortalLogin?: boolean;
    country?: string;
    subdivision?: string;
    locality?: string;
    code?: string | null;
  },
) {
  try {
    const access = await assertCustomerWriteAccess(slug);
    if ('error' in access && access.error) {
      return { success: false, error: access.error };
    }

    const branchId = access.branchId!;
    const isNew = !data.id;
    const email = data.email?.trim() || '';
    const password = data.password?.trim() || '';
    const enablePortalLogin = Boolean(data.enablePortalLogin);

    if (isNew) {
      if (enablePortalLogin) {
        if (!email) {
          return { success: false, error: 'Email is required when customer portal login is enabled.' };
        }
        if (!validatePassword(password).isValid) {
          return { success: false, error: PASSWORD_INVALID_MESSAGE };
        }
      }
    }

    let existingCognitoUserId: string | null = null;
    if (!isNew && data.id) {
      const existing = await query(
        `SELECT auth_user_id, email FROM customers WHERE id = $1 AND branch_id = $2 LIMIT 1`,
        [data.id, branchId],
      );
      if (existing.rows.length === 0) {
        return { success: false, error: 'Customer not found' };
      }
      existingCognitoUserId = existing.rows[0].auth_user_id
        ? String(existing.rows[0].auth_user_id)
        : null;
    }

    const id = data.id || `cust_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const balance = data.balance !== undefined && data.balance !== '' ? Number(data.balance) : 0;
    const status = data.status || 'active';
    const country = data.country?.trim() || '';
    const subdivision = data.subdivision?.trim() || null;
    const locality = data.locality?.trim() || null;
    if (!country) {
      return { success: false, error: 'Country is required.' };
    }

    let parsedCode: string | null = null;
    const codeResult = entityCodeSchema.safeParse(data.code);
    if (!codeResult.success) {
      return { success: false, error: codeResult.error.issues[0]?.message || 'Invalid code.' };
    }
    parsedCode = codeResult.data;

    let cognitoUserId = existingCognitoUserId;

    if (isNew && enablePortalLogin) {
      const cognitoRes = await createCustomerCognitoUser({
        email,
        name: data.name.trim(),
        branchId,
        password,
      });
      if (!cognitoRes.success || !cognitoRes.userId) {
        return { success: false, error: cognitoRes.error || 'Failed to create customer login account.' };
      }
      cognitoUserId = cognitoRes.userId;
    } else if (!isNew && enablePortalLogin && !existingCognitoUserId) {
      if (!email) {
        return { success: false, error: 'Email is required when customer portal login is enabled.' };
      }
      if (!validatePassword(password).isValid) {
        return { success: false, error: PASSWORD_INVALID_MESSAGE };
      }
      const cognitoRes = await createCustomerCognitoUser({
        email,
        name: data.name.trim(),
        branchId,
        password,
      });
      if (!cognitoRes.success || !cognitoRes.userId) {
        return { success: false, error: cognitoRes.error || 'Failed to create customer login account.' };
      }
      cognitoUserId = cognitoRes.userId;
    } else if (existingCognitoUserId && email) {
      await updateCognitoUserName(email, data.name.trim());
    }

    await query(
      `
      INSERT INTO customers (id, branch_id, name, code, phone, email, balance, status, auth_user_id, country, subdivision, locality)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        code = EXCLUDED.code,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        balance = EXCLUDED.balance,
        status = EXCLUDED.status,
        auth_user_id = COALESCE(EXCLUDED.auth_user_id, customers.auth_user_id),
        country = EXCLUDED.country,
        subdivision = EXCLUDED.subdivision,
        locality = EXCLUDED.locality
    `,
      [
        id,
        branchId,
        data.name.trim(),
        parsedCode,
        data.phone?.trim() || null,
        email || null,
        balance,
        status,
        cognitoUserId,
        country,
        subdivision,
        locality,
      ],
    );

    const cpExisting = await query(
      `SELECT id FROM ic_counterparties WHERE legacy_customer_id = $1 LIMIT 1`,
      [id],
    );
    let counterpartyId: string;
    if (cpExisting.rows.length > 0) {
      counterpartyId = String(cpExisting.rows[0].id);
      await query(
        `UPDATE ic_counterparties
         SET branch_id = $1, name = $2, code = $3, phone = $4, email = $5, country = $6,
             subdivision = $7, locality = $8, status = $9, auth_user_id = COALESCE($10, auth_user_id)
         WHERE id = $11`,
        [
          branchId,
          data.name.trim(),
          parsedCode,
          data.phone?.trim() || null,
          email || null,
          country,
          subdivision,
          locality,
          status,
          cognitoUserId,
          counterpartyId,
        ],
      );
    } else {
      counterpartyId = crypto.randomUUID();
      await query(
        `INSERT INTO ic_counterparties (
           id, branch_id, name, code, phone, email, country, subdivision, locality, status, auth_user_id, legacy_customer_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          counterpartyId,
          branchId,
          data.name.trim(),
          parsedCode,
          data.phone?.trim() || null,
          email || null,
          country,
          subdivision,
          locality,
          status,
          cognitoUserId,
          id,
        ],
      );
    }

    await query(`UPDATE customers SET counterparty_id = $1 WHERE id = $2`, [counterpartyId, id]);

    await syncICCounterpartyFundAccount(counterpartyId);
    await syncCustomerFundAccount(id);
    if (cognitoUserId) {
      await query(`UPDATE profiles SET customer_id = $1 WHERE id = $2`, [id, cognitoUserId]);
    }

    revalidateCustomerPaths(slug);
    return { success: true, id };
  } catch (err: unknown) {
    const conflict = entityCodeConflictMessage(err);
    if (conflict) return { success: false, error: conflict };
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err, slug, data }, 'saveCustomer error');
    return { success: false, error: message };
  }
}

export async function resetCustomerPasswordAction(slug: string, customerId: string, passwordRaw: string) {
  try {
    const access = await assertCustomerWriteAccess(slug);
    if ('error' in access && access.error) {
      return { success: false, error: access.error };
    }
    if (!validatePassword(passwordRaw).isValid) {
      return { success: false, error: PASSWORD_INVALID_MESSAGE };
    }

    const existing = await query(
      `SELECT email, auth_user_id FROM customers WHERE id = $1 AND branch_id = $2 LIMIT 1`,
      [customerId, access.branchId],
    );
    if (existing.rows.length === 0) {
      return { success: false, error: 'Customer not found' };
    }
    const email = existing.rows[0].email ? String(existing.rows[0].email) : '';
    const cognitoUserId = existing.rows[0].auth_user_id;
    if (!email || !cognitoUserId) {
      return { success: false, error: 'Customer has no portal login account.' };
    }

    return resetCustomerCognitoPasswordAction(email, passwordRaw, slug);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err, slug, customerId }, 'resetCustomerPasswordAction error');
    return { success: false, error: message };
  }
}

export async function deleteCustomer(id: string, slug: string) {
  try {
    const access = await assertCustomerWriteAccess(slug);
    if ('error' in access && access.error) {
      return { success: false, error: access.error };
    }

    const existing = await query(
      `SELECT email, auth_user_id FROM customers WHERE id = $1 AND branch_id = $2 LIMIT 1`,
      [id, access.branchId],
    );
    if (existing.rows.length === 0) {
      return { success: false, error: 'Customer not found' };
    }

    if (await customerHasAnyOrders(id)) {
      return { success: false, error: CUSTOMER_DELETE_BLOCKED_MESSAGE };
    }

    const email = existing.rows[0].email ? String(existing.rows[0].email) : '';
    if (email) {
      await deleteCognitoUserByEmail(email);
    }

    await query(`DELETE FROM customers WHERE id = $1`, [id]);
    await deactivateCustomerFundAccount(id);
    revalidateCustomerPaths(slug);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ error: err, id, slug }, 'deleteCustomer error');
    return { success: false, error: message };
  }
}

/** Adjust customer balance within an existing transaction client. Returns opening balance before change. */
export async function adjustCustomerBalanceInTx(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: { balance: string }[] }> },
  customerId: string,
  delta: number,
): Promise<number> {
  const res = await client.query(`SELECT balance FROM customers WHERE id = $1 FOR UPDATE`, [customerId]);
  if (res.rows.length === 0) throw new Error('Customer not found');
  const openingBalance = parseFloat(res.rows[0].balance);
  await client.query(`UPDATE customers SET balance = balance + $1 WHERE id = $2`, [delta, customerId]);
  return openingBalance;
}
