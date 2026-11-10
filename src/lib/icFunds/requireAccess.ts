import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { isBranchPageEnabled } from '@/lib/branchPages';
import { HQ_IC_FUNDS_BRANCH_ID, HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import {
  canReadPage,
  canWritePage,
  isBranchScopedUser,
  READ_ONLY_ACCESS_MESSAGE,
} from '@/lib/rbac';
import type { User } from '@/types';

export type ICFundsAccessOk = {
  ok: true;
  user: User;
  slug: string;
  hiddenPages: string[];
};

export type ICFundsAccessErr = { ok: false; error: string };

function parseHiddenPages(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

async function resolveSessionUser(branchSlug: string): Promise<User | null> {
  const hqUser = await getSessionUser();
  if (hqUser) return hqUser;
  return getSessionUser(branchSlug);
}

async function loadBranchRow(branchId: string) {
  const branchRes = await query(
    `SELECT id, slug, hidden_pages FROM branches WHERE id = $1 LIMIT 1`,
    [branchId],
  );
  return branchRes.rows[0];
}

function finishAccessCheck(
  branchId: string,
  slug: string,
  hiddenPages: string[],
  user: User,
  mode: 'read' | 'write',
): ICFundsAccessOk | ICFundsAccessErr {
  if (isBranchScopedUser(user) && user.branchId && user.branchId !== branchId) {
    return { ok: false, error: 'Forbidden' };
  }

  const pageHidden = user.role === 'admin' ? [] : hiddenPages;
  if (!isBranchPageEnabled('ic-funds', pageHidden) || !canReadPage(user, 'ic-funds', pageHidden)) {
    return { ok: false, error: 'Forbidden' };
  }

  if (mode === 'write' && !canWritePage(user, 'ic-funds', pageHidden)) {
    return { ok: false, error: READ_ONLY_ACCESS_MESSAGE };
  }

  return { ok: true, user, slug, hiddenPages };
}

export async function requireICFundsAccess(
  branchId: string,
  mode: 'read' | 'write',
): Promise<ICFundsAccessOk | ICFundsAccessErr> {
  if (branchId === HQ_IC_FUNDS_BRANCH_ID) {
    const user = await resolveSessionUser(HQ_IC_FUNDS_BRANCH_SLUG);
    if (!user) return { ok: false, error: 'Not authenticated' };
    if (user.role === 'admin') {
      return finishAccessCheck(branchId, HQ_IC_FUNDS_BRANCH_SLUG, [], user, mode);
    }
    const row = await loadBranchRow(branchId);
    if (!row) return { ok: false, error: 'Branch not found' };
    return finishAccessCheck(
      branchId,
      String(row.slug),
      parseHiddenPages(row.hidden_pages),
      user,
      mode,
    );
  }

  const row = await loadBranchRow(branchId);
  if (!row) return { ok: false, error: 'Branch not found' };

  const slug = String(row.slug);
  const hiddenPages = parseHiddenPages(row.hidden_pages);
  const user = await resolveSessionUser(slug);
  if (!user) return { ok: false, error: 'Not authenticated' };

  return finishAccessCheck(branchId, slug, hiddenPages, user, mode);
}
