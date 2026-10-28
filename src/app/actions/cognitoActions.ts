'use server';

import { getSessionUser } from '@/lib/auth';
import { canReadSection, canWriteSection } from '@/lib/asic/pages';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { seedDefaultStaffPermissions } from '@/lib/userPermissions';
import { HQ_IC_FUNDS_BRANCH_ID, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import { authSessionSlug } from '@/lib/icTransfer/warehouseSlug';
import { logger } from '@/lib/logger';
import { PASSWORD_INVALID_MESSAGE, validatePassword } from '@/lib/passwordValidation';
import { PRODUCT_NAME } from '@/lib/brand';
import { query } from '@/lib/db';

const CUSTOMER_ROLE = 'customer';

export type CognitoUser = {
  username: string;
  email: string;
  name: string;
  role: string;
  branchId?: string;
  userId?: string;
  status: string;
  created: string;
};

async function requireUserManagementAccess(branchSlug?: string, mode: 'read' | 'write' = 'write') {
  const normalizedBranchSlug = authSessionSlug(branchSlug) ?? undefined;
  const user = normalizedBranchSlug
    ? await getSessionUser(normalizedBranchSlug)
    : await getSessionUser();
  if (!user) {
    return { error: 'You must be signed in.' as const, user: null };
  }

  if (user.role === 'delivery' || user.role.startsWith('delivery')) {
    return { error: 'Access denied.' as const, user: null };
  }

  const portal = normalizedBranchSlug ? 'branch' : 'admin';
  const allowed =
    mode === 'read'
      ? canReadSection(user, 'users', portal)
      : canWriteSection(user, 'users', portal);

  if (user.role === 'staff' || user.role === 'auditor') {
    if (!allowed) {
      return {
        error: mode === 'write' ? 'Read-only access.' : 'Access denied.',
        user: null,
      };
    }
    return { user, branchSlug: normalizedBranchSlug };
  }

  if (user.role === 'branch_manager' && normalizedBranchSlug) {
    if (!allowed) {
      return {
        error: mode === 'write' ? 'Read-only access.' : 'Access denied.',
        user: null,
      };
    }
    return { user, branchSlug: normalizedBranchSlug };
  }

  if (user.role.startsWith('warehouse_') && normalizedBranchSlug) {
    return { user, branchSlug: normalizedBranchSlug };
  }

  if (!normalizedBranchSlug && user.role === 'admin') {
    return { user, branchSlug: undefined };
  }

  return { error: 'Access denied.' as const, user: null };
}

async function findAuthUserByEmail(email: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase()) ?? null;
}

async function upsertProfile(input: {
  id: string;
  email: string;
  name: string;
  role: string;
  branchId?: string | null;
  customerId?: string | null;
  warehouseId?: string | null;
  deliveryAgentId?: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from('profiles').upsert(
    {
      id: input.id,
      email: input.email,
      name: input.name,
      role: input.role,
      branch_id: input.branchId || null,
      customer_id: input.customerId || null,
      warehouse_id: input.warehouseId || null,
      delivery_agent_id: input.deliveryAgentId || null,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
  await admin.auth.admin.updateUserById(input.id, {
    app_metadata: { role: input.role, branch_id: input.branchId || null },
    user_metadata: { name: input.name },
  });
}

export async function fetchCognitoUsersAction(branchSlug?: string) {
  const access = await requireUserManagementAccess(branchSlug, 'read');
  if ('error' in access && access.error) {
    return { success: false, error: access.error };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('profiles').select('id, email, name, role, branch_id, created_at');
    if (error) return { success: false, error: error.message };

    let users: CognitoUser[] = (data ?? [])
      .filter(p => p.role !== CUSTOMER_ROLE && p.role !== 'investor')
      .map(p => ({
        username: String(p.email || p.id),
        email: String(p.email || ''),
        name: String(p.name || ''),
        role: String(p.role || ''),
        branchId: p.branch_id ? String(p.branch_id) : undefined,
        userId: String(p.id),
        status: 'ACTIVE',
        created: p.created_at ? String(p.created_at) : new Date().toISOString(),
      }));

    if (access.user?.role === 'branch_manager' && access.user.branchId) {
      users = users.filter(u => u.branchId === access.user!.branchId);
    }

    return { success: true, data: users };
  } catch (error: unknown) {
    logger.error({ error, branchSlug }, 'Error listing users');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch users' };
  }
}

export async function createCognitoUserAction(
  email: string,
  name: string,
  role: string,
  branchId: string,
  passwordRaw: string,
  branchSlug?: string,
) {
  const access = await requireUserManagementAccess(branchSlug);
  if ('error' in access && access.error) {
    return { success: false, error: access.error };
  }

  if (access.user?.role === 'branch_manager' || access.user?.role?.startsWith('warehouse_')) {
    if (role !== 'staff' && !role.startsWith('warehouse_') && !role.startsWith('delivery')) {
      return { success: false, error: 'Managers can only create staff, warehouse, or delivery accounts.' };
    }
    if (branchId !== access.user.branchId) {
      return { success: false, error: 'You can only create users for your branch.' };
    }
  }

  if (!validatePassword(passwordRaw).isValid) {
    return { success: false, error: PASSWORD_INVALID_MESSAGE };
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: passwordRaw,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role, branch_id: branchId || null },
    });
    if (error || !data.user) {
      return { success: false, error: error?.message || 'Failed to create user' };
    }

    await upsertProfile({
      id: data.user.id,
      email,
      name,
      role,
      branchId: role === 'admin' || role === 'auditor' ? null : branchId,
    });

    if (role === 'staff' && branchId) {
      await seedDefaultStaffPermissions(data.user.id, branchId, access.user!.email);
    }

    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email, role, branchId }, 'Error creating user');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create user' };
  }
}

export async function updateCognitoUserPasswordAction(email: string, newPassword: string) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Password reset for other users is disabled. Users must change their own password.' };
  }
  void email;
  void newPassword;
  return { success: false, error: 'Password reset for other users is disabled. Users must change their own password.' };
}

export async function updateCognitoUserAttributesAction(
  email: string,
  name: string,
  branchSlug?: string,
  role?: string,
  branchId?: string,
) {
  const access = await requireUserManagementAccess(branchSlug);
  if ('error' in access && access.error) {
    return { success: false, error: access.error };
  }

  const isAdmin = access.user?.role === 'admin';
  if (!isAdmin && (role !== undefined || branchId !== undefined)) {
    return { success: false, error: 'Only admin can change role or branch assignment.' };
  }
  if (isAdmin && role === 'admin' && branchId) {
    return { success: false, error: 'Admin accounts cannot be assigned to a branch.' };
  }
  if (isAdmin && role === 'branch_manager' && !branchId) {
    return { success: false, error: 'Branch managers must be assigned to a branch.' };
  }
  if (isAdmin && role === 'staff' && !branchId) {
    return { success: false, error: 'Staff must be assigned to a branch or HQ admin panel.' };
  }

  try {
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) return { success: false, error: 'User not found.' };
    const nextRole = isAdmin && role ? role : String(authUser.app_metadata?.role || '');
    await upsertProfile({
      id: authUser.id,
      email,
      name,
      role: nextRole,
      branchId: nextRole === 'admin' || nextRole === 'auditor' ? null : branchId,
    });
    if (isAdmin && role === 'staff' && branchId) {
      await seedDefaultStaffPermissions(authUser.id, branchId, access.user!.email);
    }
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email }, 'Error updating user');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update user' };
  }
}

export async function resetCognitoUserPasswordAction(email: string, passwordRaw: string, branchSlug?: string) {
  const access = await requireUserManagementAccess(branchSlug);
  if ('error' in access && access.error) {
    return { success: false, error: access.error };
  }

  try {
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) return { success: false, error: 'User not found.' };
    const { data: profile } = await createSupabaseAdminClient()
      .from('profiles')
      .select('role, branch_id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (access.user?.role === 'branch_manager') {
      if (profile?.role !== 'staff' || profile?.branch_id !== access.user.branchId) {
        return { success: false, error: 'You can only reset passwords for staff in your branch.' };
      }
    }

    if (!validatePassword(passwordRaw).isValid) {
      return { success: false, error: PASSWORD_INVALID_MESSAGE };
    }

    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(authUser.id, {
      password: passwordRaw,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email }, 'Error resetting password');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reset password' };
  }
}

export async function resetCustomerCognitoPasswordAction(email: string, passwordRaw: string, branchSlug: string) {
  const user = await getSessionUser(branchSlug);
  if (!user) return { success: false, error: 'You must be signed in.' };
  if (user.role === 'customer' || user.role === 'delivery' || user.role.startsWith('warehouse_')) {
    return { success: false, error: 'Access denied.' };
  }

  try {
    const branchRes = await query(`SELECT id FROM branches WHERE slug = $1 LIMIT 1`, [branchSlug]);
    if (branchRes.rows.length === 0) return { success: false, error: 'Branch not found.' };
    const branchId = String(branchRes.rows[0].id);
    if (user.branchId && user.branchId !== branchId) {
      return { success: false, error: 'You are not authorized for this branch.' };
    }

    const custRes = await query(
      `SELECT id FROM customers WHERE LOWER(email) = LOWER($1) AND branch_id = $2 LIMIT 1`,
      [email.trim(), branchId],
    );
    if (custRes.rows.length === 0) return { success: false, error: 'Customer not found in this branch.' };

    const authUser = await findAuthUserByEmail(email);
    if (!authUser) return { success: false, error: 'Portal account not found.' };
    if (!validatePassword(passwordRaw).isValid) {
      return { success: false, error: PASSWORD_INVALID_MESSAGE };
    }
    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(authUser.id, {
      password: passwordRaw,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email, branchSlug }, 'Error resetting customer password');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to reset password' };
  }
}

export async function deleteCognitoUserAction(email: string, branchSlug?: string) {
  const access = await requireUserManagementAccess(branchSlug);
  if ('error' in access && access.error) {
    return { success: false, error: access.error };
  }
  if (access.user?.email === email) {
    return { success: false, error: 'You cannot delete your own account.' };
  }

  try {
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) return { success: false, error: 'User not found.' };
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role, branch_id').eq('id', authUser.id).maybeSingle();

    if (access.user?.role === 'branch_manager') {
      if (
        (profile?.role !== 'staff' && !(profile?.role || '').startsWith('warehouse_')) ||
        profile?.branch_id !== access.user.branchId
      ) {
        return { success: false, error: 'You can only remove staff or warehouse users from your branch.' };
      }
    }

    const { error } = await admin.auth.admin.deleteUser(authUser.id);
    if (error) return { success: false, error: error.message };
    const { deleteUserPermissions } = await import('@/lib/userPermissions');
    await deleteUserPermissions(authUser.id);
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email }, 'Error deleting user');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete user' };
  }
}

export async function createCustomerCognitoUser(input: {
  email: string;
  name: string;
  branchId: string;
  password: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  if (!validatePassword(input.password).isValid) {
    return { success: false, error: PASSWORD_INVALID_MESSAGE };
  }
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
      app_metadata: { role: CUSTOMER_ROLE, branch_id: input.branchId },
    });
    if (error || !data.user) {
      return { success: false, error: error?.message || 'Failed to create customer account' };
    }
    await upsertProfile({
      id: data.user.id,
      email: input.email,
      name: input.name,
      role: CUSTOMER_ROLE,
      branchId: input.branchId,
    });
    return { success: true, userId: data.user.id };
  } catch (error: unknown) {
    logger.error({ error, email: input.email }, 'Error creating customer login');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create customer account' };
  }
}

export async function createInvestorCognitoUser(_input: {
  email: string;
  name: string;
  branchId: string;
  password: string;
}): Promise<{ success: boolean; userId?: string; error?: string }> {
  return { success: false, error: `Investor accounts are not part of ${PRODUCT_NAME}.` };
}

export async function deleteInvestorCognitoUser(_email: string): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: `Investor accounts are not part of ${PRODUCT_NAME}.` };
}

export async function updateCognitoUserName(email: string, name: string) {
  try {
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) return { success: false, error: 'User not found.' };
    const admin = createSupabaseAdminClient();
    await admin.auth.admin.updateUserById(authUser.id, { user_metadata: { name } });
    await admin.from('profiles').update({ name }).eq('id', authUser.id);
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email }, 'Error updating user name');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update user name' };
  }
}

export async function deleteCognitoUserByEmail(email: string) {
  try {
    const authUser = await findAuthUserByEmail(email);
    if (!authUser) return { success: false, error: 'User not found.' };
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('role').eq('id', authUser.id).maybeSingle();
    if (profile?.role !== CUSTOMER_ROLE) {
      return { success: false, error: 'Refusing to delete a non-customer account.' };
    }
    const { error } = await admin.auth.admin.deleteUser(authUser.id);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: unknown) {
    logger.error({ error, email }, 'Error deleting customer login');
    return { success: false, error: error instanceof Error ? error.message : 'Failed to delete customer account' };
  }
}
