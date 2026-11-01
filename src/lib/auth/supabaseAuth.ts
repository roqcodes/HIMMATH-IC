import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { User, UserRole } from '@/types';
import { PRODUCT_NAME } from '@/lib/brand';

const VALID_ROLES: UserRole[] = ['admin', 'auditor', 'branch_manager', 'staff', 'delivery', 'customer', 'collection_agent'];

function asRole(value: string | undefined): UserRole | null {
  if (!value) return null;
  if (VALID_ROLES.includes(value as UserRole)) return value as UserRole;
  if (value.startsWith('warehouse_') || value.startsWith('delivery')) return value as UserRole;
  return null;
}

export async function authenticateWithSupabase(email: string, password: string): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message || 'Authentication failed');
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, branch_id, warehouse_id, delivery_agent_id, name')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }
  if (!profile) {
    throw new Error(`Access Denied: No profile is linked to this login. An admin must create the account in ${PRODUCT_NAME}.`);
  }

  const appRole = (data.user.app_metadata as { role?: string } | undefined)?.role;
  const role = asRole(profile?.role || appRole);
  if (!role) {
    throw new Error('Access Denied: Your account has not been assigned a valid role.');
  }

  return {
    id: data.user.id,
    email: data.user.email || email,
    name: profile?.name || data.user.email?.split('@')[0] || email,
    role,
    branchId: profile?.branch_id || undefined,
    warehouseId: profile?.warehouse_id ? String(profile.warehouse_id) : undefined,
  };
}

export function isSupabaseAuthEnabled(): boolean {
  return true;
}
