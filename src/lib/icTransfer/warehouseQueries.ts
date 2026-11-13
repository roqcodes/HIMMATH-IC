export function parseManagerIdsFromRow(row: Record<string, unknown>): string[] {
  const raw = row.manager_ids;
  if (Array.isArray(raw)) return raw.map(id => String(id));
  return [];
}

/** Warehouse rows with assigned manager ids (ordered by manager name). */
export const IC_WAREHOUSE_SELECT = `
  SELECT w.*,
    COALESCE(
      (
        SELECT array_agg(wm.manager_id::text ORDER BY m.name)
        FROM ic_warehouse_managers wm
        INNER JOIN ic_counterparties m ON m.id = wm.manager_id
        WHERE wm.warehouse_id = w.id
      ),
      ARRAY[]::text[]
    ) AS manager_ids
  FROM ic_warehouses w
`;
