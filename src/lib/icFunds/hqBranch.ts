import type { Branch, User } from '@/types';

/** System ledger used by HQ admin for IC Funds (accounts, vouchers, reports). */
export const HQ_IC_FUNDS_BRANCH_ID = 'branch_hq';
export const HQ_IC_FUNDS_BRANCH_SLUG = 'hq';
export const HQ_IC_FUNDS_BRANCH_NAME = 'HQ';

export function isHqIcFundsBranch(branch: Pick<Branch, 'id' | 'slug'>): boolean {
  return branch.id === HQ_IC_FUNDS_BRANCH_ID || branch.slug === HQ_IC_FUNDS_BRANCH_SLUG;
}

export function isHqIcFundsBranchId(branchId?: string | null): boolean {
  return branchId === HQ_IC_FUNDS_BRANCH_ID;
}

/** HQ admin-panel staff — role staff scoped to the system HQ ledger branch. */
export function isHqAdminStaff(user: Pick<User, 'role' | 'branchId'> | null | undefined): boolean {
  return user?.role === 'staff' && isHqIcFundsBranchId(user.branchId);
}

/** HQ direct customers — sign in at root admin login, not a branch portal URL. */
export function isHqPortalCustomer(user: Pick<User, 'role' | 'branchId'> | null | undefined): boolean {
  return user?.role === 'customer' && isHqIcFundsBranchId(user.branchId);
}

export function isHqPortalCollectionAgent(user: Pick<User, 'role' | 'branchId'> | null | undefined): boolean {
  return user?.role === 'collection_agent' && isHqIcFundsBranchId(user.branchId);
}

export function buildHqIcFundsBranch(): Branch {
  const now = new Date().toISOString();
  return {
    id: HQ_IC_FUNDS_BRANCH_ID,
    slug: HQ_IC_FUNDS_BRANCH_SLUG,
    name: HQ_IC_FUNDS_BRANCH_NAME,
    location: 'Head office',
    managerName: 'HQ Admin',
    cashBalance: 0,
    goldBalance: 0,
    currentBalance: 0,
    openingBalance: 0,
    openingGoldBalance: 0,
    closingBalance: 0,
    dailyPL: 0,
    status: 'active',
    timezone: 'Asia/Dubai',
    hiddenPages: [],
    enabledCurrencies: ['AED'],
    lastActivity: now,
    createdAt: now,
  };
}

/** HQ ledger first, then operational branches (no duplicate HQ row). */
export function icFundsBranchOptions(branches: Branch[]): Branch[] {
  const operational = branches.filter(b => !isHqIcFundsBranch(b));
  const hqFromDb = branches.find(isHqIcFundsBranch);
  return [hqFromDb ?? buildHqIcFundsBranch(), ...operational];
}
