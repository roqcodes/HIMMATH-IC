import { query } from '@/lib/db';
import { mapICBranchRow } from '@/lib/icTransferMappers';
import { IC_BRANCH_SELECT } from '@/lib/icTransfer/icBranchQueries';
import type { ICBranch } from '@/types';
import {
  isFullWarehouseUuid,
  isWarehouseRouteShortSlug,
} from '@/lib/icTransfer/warehouseSlug';

export async function fetchIcBranchByRouteParam(param: string): Promise<ICBranch | null> {
  if (!param) return null;

  if (isFullWarehouseUuid(param)) {
    const res = await query(`${IC_BRANCH_SELECT} WHERE b.id = $1 LIMIT 1`, [param]);
    return res.rows[0] ? mapICBranchRow(res.rows[0]) : null;
  }

  const slug = param.toLowerCase();
  if (!isWarehouseRouteShortSlug(slug)) return null;

  const res = await query(
    `${IC_BRANCH_SELECT}
     WHERE lower(substring(replace(b.id::text, '-', ''), 1, 8)) = $1
     LIMIT 2`,
    [slug],
  );

  if (res.rows.length !== 1) return null;
  return mapICBranchRow(res.rows[0]);
}
