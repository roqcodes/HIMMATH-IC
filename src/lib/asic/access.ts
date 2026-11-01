import { getPageIdFromBranchPathname } from '@/lib/branchPages';
import { defaultSection, isAsicSection } from '@/lib/asic/nav';
import { mapLegacyPageId, type AsicSectionId } from '@/lib/asic/pages';
import { parseAsicPath, type AsicPortal } from '@/lib/asic/routing';

export type ResolvedAsicScope = {
  portal: AsicPortal;
  section: AsicSectionId;
};

function resolveSectionId(sectionRaw: string | null, portal: AsicPortal): AsicSectionId {
  if (sectionRaw === 'accounts') return 'entities';
  if (sectionRaw && isAsicSection(sectionRaw)) return sectionRaw;
  return defaultSection(portal);
}

/** Map the current URL to an ASIC portal + section for RBAC write checks. */
export function resolveSectionFromPathname(pathname: string): ResolvedAsicScope | null {
  const normalized = pathname.replace(/\/$/, '') || '/';
  if (normalized === '/admin/customers' || normalized.startsWith('/admin/customers/')) {
    if (normalized === '/admin/customers' || normalized === '/admin/customers/') {
      return { portal: 'admin', section: 'counterparties' };
    }
    return { portal: 'admin', section: 'customers' };
  }
  if (normalized === '/admin/suppliers') {
    return { portal: 'admin', section: 'counterparties' };
  }

  const parsed = parseAsicPath(pathname);

  if (parsed.portal === 'legacy') {
    if (!parsed.branchSlug) return null;
    const pageId = getPageIdFromBranchPathname(pathname, parsed.branchSlug);
    const section = pageId ? mapLegacyPageId(pageId) : defaultSection('branch');
    if (!section) return null;
    return { portal: 'branch', section };
  }

  if (parsed.portal === 'admin-root') {
    return {
      portal: 'admin',
      section: resolveSectionId(parsed.section, 'admin'),
    };
  }

  const portal = parsed.portal as AsicPortal;
  return {
    portal,
    section: resolveSectionId(parsed.section, portal),
  };
}
