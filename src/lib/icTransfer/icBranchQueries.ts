import { parseManagerIdsFromRow } from '@/lib/icTransfer/warehouseQueries';

export { parseManagerIdsFromRow };

/** IC branch rows with assigned manager ids (ordered by manager name). */
export const IC_BRANCH_SELECT = `
  SELECT b.*,
    COALESCE(
      (
        SELECT array_agg(bm.manager_id::text ORDER BY m.name)
        FROM ic_branch_managers bm
        INNER JOIN ic_counterparties m ON m.id = bm.manager_id
        WHERE bm.branch_id = b.id
      ),
      ARRAY[]::text[]
    ) AS manager_ids
  FROM ic_branches b
`;
