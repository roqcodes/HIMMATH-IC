import type { ICFundAccount } from '@/types';
import { resolveCustomerIdFromFundAccount } from '@/lib/icFunds/customerAccountLink';

export function icFundAccountDetailPath(slug: string, accountId: string): string {
  return `/${slug}/ic-funds/accounts/${accountId}`;
}

/** Where a row click should navigate — customer profile or IC Funds account detail. */
export function resolveAccountDetailHref(slug: string, account: ICFundAccount): string {
  const customerId = resolveCustomerIdFromFundAccount(account);
  const navSlug = account.branchSlug || slug;
  if (customerId) return `/${navSlug}/customers/${customerId}?from=ic-funds`;
  return icFundAccountDetailPath(navSlug, account.id);
}

/** Resolve href when only id is known; optional account list enriches customer links. */
export function resolveAccountDetailHrefById(
  slug: string,
  accountId: string,
  accounts?: ICFundAccount[],
): string {
  const account = accounts?.find(a => a.id === accountId);
  if (account) return resolveAccountDetailHref(slug, account);
  return icFundAccountDetailPath(slug, accountId);
}

export function isCustomerFundAccount(account: ICFundAccount): boolean {
  return Boolean(resolveCustomerIdFromFundAccount(account));
}
