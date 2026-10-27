import type { Branch } from '@/types';
import { isBranchPageEnabled } from '@/lib/branchPages';

export type GlobalSearchCategory = 'pages' | 'branches';

export type GlobalSearchResult = {
  id: string;
  category: GlobalSearchCategory;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  badge?: string;
  badgeTone?: 'default' | 'success' | 'warning' | 'info';
};

export type GlobalSearchSection = {
  category: GlobalSearchCategory;
  label: string;
  results: GlobalSearchResult[];
};

export const SEARCH_CATEGORY_LABELS: Record<GlobalSearchCategory, string> = {
  pages: 'Pages',
  branches: 'Branches',
};

export const SEARCH_PAGE_ITEMS: {
  id: string;
  label: string;
  path: string;
  keywords: string[];
  superadminOnly?: boolean;
  branchOnly?: boolean;
}[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', keywords: ['home', 'overview'] },
  { id: 'ic-transfer-admin', label: 'IC Transfer (Admin)', path: '/ic-transfer-admin', keywords: ['intercompany', 'ic', 'admin'], branchOnly: true },
  { id: 'ic-funds', label: 'IC Funds', path: '/ic-funds', keywords: ['ic funds', 'payments', 'receipts', 'journal', 'contra', 'tradex'], branchOnly: true },
  { id: 'ic-transfer', label: 'IC Transfer', path: '/ic-transfer', keywords: ['intercompany', 'ic', 'customer', 'orders'], branchOnly: true },
  { id: 'accounts', label: 'Accounts', path: '/accounts', keywords: ['accounts', 'customers', 'client', 'ledger', 'balance'] },
  { id: 'settings', label: 'Settings', path: '/settings', keywords: ['settings', 'profile', 'branch'] },
  { id: 'warehouse', label: 'Warehouse', path: '/warehouse', keywords: ['warehouse', 'stock', 'delivery'] },
  { id: 'branches', label: 'Branches', path: '/branches', keywords: ['branches', 'locations'], superadminOnly: true },
  { id: 'users', label: 'Users & Roles', path: '/users', keywords: ['users', 'roles', 'admin'], superadminOnly: true },
];

const MAX_PER_CATEGORY = 6;

export function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function matchesSearch(q: string, ...fields: (string | number | undefined | null)[]): boolean {
  const norm = normalizeSearchQuery(q);
  if (!norm) return false;
  return fields.some(f => String(f ?? '').toLowerCase().includes(norm));
}

export function resolveBasePath(currentSlug: string): string {
  return currentSlug === 'superadmin' ? '' : `/${currentSlug}`;
}

export function buildContextSearchResults(input: {
  query: string;
  basePath: string;
  currentSlug: string;
  isSuperadmin: boolean;
  isBranchUser: boolean;
  branchId?: string | null;
  hiddenPages?: string[];
  branches: Branch[];
}): GlobalSearchSection[] {
  const q = normalizeSearchQuery(input.query);
  if (!q) return [];

  const sections: GlobalSearchSection[] = [];

  const pageResults: GlobalSearchResult[] = [];
  for (const page of SEARCH_PAGE_ITEMS) {
    if (page.superadminOnly && !input.isSuperadmin) continue;
    if (page.branchOnly && input.isSuperadmin) continue;
    if (input.hiddenPages && !isBranchPageEnabled(page.id, input.hiddenPages)) continue;
    if (!matchesSearch(q, page.label, page.id, ...page.keywords)) continue;
    pageResults.push({
      id: `page-${page.id}`,
      category: 'pages',
      title: page.label,
      href: `${input.basePath}${page.path}`,
    });
    if (pageResults.length >= MAX_PER_CATEGORY) break;
  }
  if (pageResults.length > 0) {
    sections.push({ category: 'pages', label: SEARCH_CATEGORY_LABELS.pages, results: pageResults });
  }

  if (input.isSuperadmin) {
    const branchResults: GlobalSearchResult[] = [];
    for (const branch of input.branches) {
      if (!matchesSearch(q, branch.name, branch.slug, branch.location, branch.managerName)) continue;
      branchResults.push({
        id: `branch-${branch.id}`,
        category: 'branches',
        title: branch.name,
        subtitle: branch.location,
        href: `/admin/branches/${branch.slug}`,
      });
      if (branchResults.length >= MAX_PER_CATEGORY) break;
    }
    if (branchResults.length > 0) {
      sections.push({ category: 'branches', label: SEARCH_CATEGORY_LABELS.branches, results: branchResults });
    }
  }

  return sections;
}

export function mergeSearchSections(
  contextSections: GlobalSearchSection[],
  catalogSections: GlobalSearchSection[],
): GlobalSearchSection[] {
  const merged = new Map<GlobalSearchCategory, GlobalSearchResult[]>();
  for (const section of [...contextSections, ...catalogSections]) {
    const existing = merged.get(section.category) ?? [];
    const seen = new Set(existing.map(r => r.id));
    for (const result of section.results) {
      if (seen.has(result.id)) continue;
      existing.push(result);
      seen.add(result.id);
    }
    merged.set(section.category, existing.slice(0, MAX_PER_CATEGORY));
  }
  return Array.from(merged.entries()).map(([category, results]) => ({
    category,
    label: SEARCH_CATEGORY_LABELS[category],
    results,
  }));
}
