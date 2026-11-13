import type { ICBranch } from '@/types';
import { isWarehouseRouteShortSlug } from '@/lib/icTransfer/warehouseSlug';

export function findIcBranchByRouteParam(branches: ICBranch[], param: string): ICBranch | undefined {
  const trimmed = String(param || '').trim();
  if (!trimmed) return undefined;
  const byId = branches.find(b => b.id === trimmed);
  if (byId) return byId;
  const slug = trimmed.toLowerCase();
  if (!isWarehouseRouteShortSlug(slug)) return undefined;
  const matches = branches.filter(
    b => b.id.replace(/-/g, '').slice(0, 8).toLowerCase() === slug,
  );
  return matches.length === 1 ? matches[0] : undefined;
}
