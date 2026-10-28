import type { ICRateGroup } from '@/types';

export function getAdminAssignedBranchRateGroup(
  _groups: ICRateGroup[],
  _branchId?: string,
): ICRateGroup | undefined {
  return undefined;
}

export function resolveBranchCustomerOrderRate(
  groups: ICRateGroup[],
  opts: { branchId?: string; customerId: string; branchCustomerIds?: Set<string> },
): ICRateGroup | undefined {
  const { customerId } = opts;
  return groups.find(g => g.customerIds?.includes(customerId));
}

export function resolveBranchOrderRates(
  groups: ICRateGroup[],
  opts: {
    branchId?: string;
    customerId?: string;
    transactionType?: string | null;
    branchCustomerIds?: Set<string>;
  },
): { group: ICRateGroup | undefined; saleRateAed: number } {
  const group = opts.customerId
    ? groups.find(g => g.customerIds?.includes(opts.customerId!))
    : groups[0];
  const saleRateAed = group ? Number(group.saleRate) || 0 : 0;
  return { group, saleRateAed };
}

export function filterRateGroupsForAdminPortal(groups: ICRateGroup[]): ICRateGroup[] {
  return groups;
}

export function getBranchManageableRateGroups(
  groups: ICRateGroup[],
  _branchId?: string,
  branchCustomerIds?: Set<string>,
): ICRateGroup[] {
  if (branchCustomerIds?.size) {
    return groups.filter(g => g.customerIds?.some(id => branchCustomerIds.has(id)));
  }
  return groups;
}
