import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';

/** Stable HQ ledger key: one till account per branch desk (warehouse), else per shop branch. */
export function branchDeskTillSourceId(params: {
  warehouseId?: string | null;
  shopBranchId?: string | null;
}): string {
  const warehouseId = params.warehouseId?.trim();
  if (warehouseId) return `branch_cash_wh_${warehouseId}`;
  const shopBranchId = params.shopBranchId?.trim() || HQ_IC_FUNDS_BRANCH_ID;
  return `branch_cash_${shopBranchId}`;
}

/** Operator-facing till name (desk/warehouse label, not the HQ ledger book). */
export function branchDeskTillAccountName(params: {
  warehouseName?: string | null;
  branchName?: string | null;
}): string {
  const desk = params.warehouseName?.trim();
  if (desk) return `Branch cash — ${desk}`;
  const branch = params.branchName?.trim();
  if (branch && branch.toLowerCase() !== 'hq') return `Branch cash — ${branch}`;
  if (branch) return `Branch cash — ${branch}`;
  return 'Branch cash';
}

export function branchDeskTillSourceIdsForLookup(params: {
  warehouseId?: string | null;
  shopBranchId?: string | null;
}): string[] {
  const ids: string[] = [];
  const primary = branchDeskTillSourceId(params);
  ids.push(primary);
  const shop = params.shopBranchId?.trim();
  if (shop) {
    const legacy = `branch_cash_${shop}`;
    if (!ids.includes(legacy)) ids.push(legacy);
  }
  return ids;
}
