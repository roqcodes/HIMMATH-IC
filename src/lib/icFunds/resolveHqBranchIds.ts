import { query } from '@/lib/db';
import type { User } from '@/types';
import { HQ_IC_FUNDS_BRANCH_ID, HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';

/** HQ ledger branch ids (canonical `branch_hq` plus DB row for slug `hq`). */
export async function resolveHqBranchIds(): Promise<Set<string>> {
  const res = await query(`SELECT id::text AS id FROM branches WHERE slug = $1 OR id = $2`, [
    HQ_IC_FUNDS_BRANCH_SLUG,
    HQ_IC_FUNDS_BRANCH_ID,
  ]);
  const ids = new Set<string>([HQ_IC_FUNDS_BRANCH_ID]);
  for (const row of res.rows) {
    ids.add(String(row.id));
  }
  return ids;
}

export function isHqLedgerBranchId(
  branchId: string | null | undefined,
  hqIds: Set<string>,
): boolean {
  if (!branchId) return true;
  return hqIds.has(branchId);
}

/** User may edit HQ-ledger counterparties (admin, or staff scoped to an HQ branch id). */
export function canMutateHqLedgerCounterparties(
  user: Pick<User, 'role' | 'branchId'> | null | undefined,
  hqIds: Set<string>,
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.branchId) return false;
  if (!hqIds.has(user.branchId)) return false;
  return user.role === 'staff' || user.role === 'branch_manager';
}
