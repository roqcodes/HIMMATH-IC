import type { ICSale, ICRateGroup } from '@/types';
import { getBranchPortalDisplayName } from '@/lib/icTransfer/branchPortalScope';

/** Page header on customer IC Transfer — customer name. */
export function getCustomerPortalDisplayName(
  customerName: string | null | undefined,
  branch: { name?: string | null; country?: string | null; location?: string | null } | null | undefined,
): { title: string } {
  const name = customerName?.trim();
  if (name) {
    return { title: name };
  }
  return getBranchPortalDisplayName(branch, 'Customer Portal');
}

/** Customer portal sales omit internal fields (none required after HQ refactor). */
export function stripAdminRatesFromSale(sale: ICSale): ICSale {
  return sale;
}

/** Rate group assigned to this customer. */
export function resolveCustomerPortalRateGroup(
  groups: ICRateGroup[],
  customerId: string,
  _branchId?: string,
): ICRateGroup | undefined {
  if (groups.length === 1 && groups[0].customerIds?.includes(customerId)) {
    return groups[0];
  }
  return groups.find(g => g.customerIds?.includes(customerId));
}

export function filterRateGroupsForCustomerPortal(
  groups: ICRateGroup[],
  customerId: string,
  branchId?: string,
): ICRateGroup[] {
  const rate = resolveCustomerPortalRateGroup(groups, customerId, branchId);
  return rate ? [rate] : [];
}

export function getCustomerPortalSubCustomerName(sale: ICSale): string {
  return sale.subCustomerName?.trim() || '—';
}
