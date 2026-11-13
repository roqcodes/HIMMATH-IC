import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';

/** HQ ledger source_id for a UAE ic_branches locker account. */
export function icBranchTillSourceId(icBranchId: string): string {
  return String(icBranchId || '').trim();
}

export function icBranchTillSourceIdsForLookup(icBranchId: string): string[] {
  const primary = icBranchTillSourceId(icBranchId);
  if (!primary) return [];
  const ids = [primary];
  const legacyWh = `branch_cash_wh_${primary}`;
  if (!ids.includes(legacyWh)) ids.push(legacyWh);
  const legacyShop = `branch_cash_${HQ_IC_FUNDS_BRANCH_ID}`;
  if (!ids.includes(legacyShop)) ids.push(legacyShop);
  return ids;
}
