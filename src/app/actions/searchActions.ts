'use server';

import type { GlobalSearchSection } from '@/lib/globalSearch';

/** Catalog search reserved for future IC modules; legacy product/invoice tables removed. */
export async function searchCatalogAction(
  _searchQuery: string,
  _branchSlug?: string,
): Promise<{ success: boolean; sections: GlobalSearchSection[]; error?: string }> {
  return { success: true, sections: [] };
}
