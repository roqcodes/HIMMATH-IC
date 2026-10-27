import 'server-only';
import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { User, UserRole, PagePermissionMap, DealPermissionMap } from '@/types';
import { env } from '@/lib/env';
import { fetchStaffAccessFromDb } from '@/lib/userPermissions';
import { isHqIcFundsBranchId, isHqAdminStaff, isHqPortalCustomer, isHqPortalCollectionAgent } from '@/lib/icFunds/hqBranch';
import { authSessionSlug, isHqOpsUser } from '@/lib/icTransfer/warehouseSlug';
import { defaultStaffPermissions, normalizePermissionMap } from '@/lib/rbac';
import { query } from '@/lib/db';
import { authenticateWithSupabase } from '@/lib/auth/supabaseAuth';

const encodedKey = new TextEncoder().encode(env.SESSION_SECRET);

export interface SessionPayload {
  id?: string;
  email: string;
  role: UserRole;
  name: string;
  branchId?: string;
  customerId?: string;
  collectionAccountId?: string;
  permissions?: PagePermissionMap;
  dealPermissions?: DealPermissionMap;
  expiresAt: string;
}

export async function encrypt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function authenticateWithPassword(email: string, password: string): Promise<User> {
  return authenticateWithSupabase(email, password);
}

async function loadCustomerProfile(user: User): Promise<User> {
  if (user.role !== 'customer' || !user.id) return user;

  try {
    const res = await query(
      `SELECT id, name, branch_id FROM customers WHERE auth_user_id = $1 LIMIT 1`,
      [user.id],
    );
    if (res.rows.length === 0) return user;
    const branchId = user.branchId || (res.rows[0].branch_id ? String(res.rows[0].branch_id) : undefined);
    return {
      ...user,
      customerId: String(res.rows[0].id),
      name: String(res.rows[0].name || user.name),
      branchId,
    };
  } catch {
    return user;
  }
}

async function loadCollectionAgentProfile(user: User): Promise<User> {
  if (user.role !== 'collection_agent' || !user.id) return user;

  try {
    const res = await query(
      `SELECT p.collection_account_id, a.name, a.branch_id, a.status
       FROM profiles p
       JOIN ic_fund_accounts a ON a.id = p.collection_account_id
       WHERE p.id = $1 AND a.account_type = 'collection_agent'
       LIMIT 1`,
      [user.id],
    );
    if (res.rows.length === 0) return user;
    const row = res.rows[0];
    if (String(row.status) !== 'active') return user;
    return {
      ...user,
      collectionAccountId: String(row.collection_account_id),
      name: String(row.name || user.name),
      branchId: row.branch_id ? String(row.branch_id) : user.branchId,
    };
  } catch {
    return user;
  }
}

async function loadStaffPermissions(user: User): Promise<User> {
  if (user.role !== 'staff' || !user.id || !user.branchId) return user;

  try {
    const { permissions, hiddenPages } = await fetchStaffAccessFromDb(user.id, user.branchId);
    if (isHqIcFundsBranchId(user.branchId)) {
      return { ...user, permissions };
    }
    return {
      ...user,
      permissions: normalizePermissionMap(permissions, hiddenPages),
    };
  } catch {
    return { ...user, permissions: defaultStaffPermissions() };
  }
}

export async function createSession(user: User, branchSlug?: string): Promise<User> {
  branchSlug = authSessionSlug(branchSlug);
  let enriched = user;
  if (user.role === 'staff') {
    enriched = await loadStaffPermissions(user);
  } else if (user.role === 'customer') {
    enriched = await loadCustomerProfile(user);
  } else if (user.role === 'collection_agent') {
    enriched = await loadCollectionAgentProfile(user);
  }
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encrypt({
    ...enriched,
    expiresAt: expiresAt.toISOString(),
  });

  const cookieName = branchSlug ? `session_${branchSlug}` : 'session_superadmin';
  const cookieStore = await cookies();
  cookieStore.set(cookieName, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });

  return enriched;
}

export async function deleteSession(branchSlug?: string) {
  const sessionSlug = authSessionSlug(branchSlug);
  const cookieName = sessionSlug ? `session_${sessionSlug}` : 'session_superadmin';
  const cookieStore = await cookies();
  cookieStore.delete({
    name: cookieName,
    path: '/',
  });
}

async function getSessionUserUncached(branchSlug?: string): Promise<User | null> {
  const sessionSlug = authSessionSlug(branchSlug);
  const cookieName = sessionSlug ? `session_${sessionSlug}` : 'session_superadmin';
  const cookieStore = await cookies();
  const session = cookieStore.get(cookieName)?.value;
  if (!session) return null;

  const payload = await decrypt(session);
  if (!payload) return null;

  if (new Date(payload.expiresAt) < new Date()) {
    return null;
  }

  if (sessionSlug && (payload.role === 'admin' || payload.role === 'auditor')) return null;
  if (
    !sessionSlug &&
    payload.role !== 'admin' &&
    payload.role !== 'auditor' &&
    !isHqAdminStaff({ role: payload.role, branchId: payload.branchId }) &&
    !isHqOpsUser({ role: payload.role, branchId: payload.branchId }) &&
    !isHqPortalCustomer({ role: payload.role, branchId: payload.branchId }) &&
    !isHqPortalCollectionAgent({ role: payload.role, branchId: payload.branchId })
  ) {
    return null;
  }

  const baseUser: User = {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    branchId: payload.branchId,
    customerId: payload.customerId,
    collectionAccountId: payload.collectionAccountId,
    permissions: payload.permissions,
    dealPermissions: payload.dealPermissions,
  };

  if (baseUser.role === 'staff') return loadStaffPermissions(baseUser);
  if (baseUser.role === 'customer') {
    if (baseUser.customerId) return baseUser;
    return loadCustomerProfile(baseUser);
  }
  if (baseUser.role === 'collection_agent') {
    if (baseUser.collectionAccountId) return baseUser;
    return loadCollectionAgentProfile(baseUser);
  }
  return baseUser;
}

/** Dedupes session + permission reads within a single server request. */
export const getSessionUser = cache(getSessionUserUncached);
