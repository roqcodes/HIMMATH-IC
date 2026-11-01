'use server';

import { query } from '@/lib/db';
import { computeWarehouseAvailableUnits } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { mapICSaleRow, mapICWarehouseRow } from '@/lib/icTransferMappers';
import { getCurrentUserAction } from '@/app/actions/auth';
import { logger } from '@/lib/logger';

export type ICTransferModalSnapshot = {
  warehouseAvailableById: Record<string, number>;
  warehouseMetalGById: Record<string, number>;
};

/** Fresh warehouse available units (on-hand minus active reservations) for entity pickers. */
export async function getICTransferModalSnapshotsAction(): Promise<ICTransferModalSnapshot> {
  const userRes = await getCurrentUserAction();
  const user = userRes.success ? userRes.data : null;
  if (!user || !['admin', 'branch_manager', 'staff'].includes(user.role)) {
    return { warehouseAvailableById: {}, warehouseMetalGById: {} };
  }

  try {
    const [warehousesRes, salesRes] = await Promise.all([
      query(`SELECT * FROM ic_warehouses ORDER BY LOWER(name)`),
      query(
        `SELECT s.*
         FROM ic_sales s
         WHERE s.warehouse_id IS NOT NULL
           AND s.order_status NOT IN (
             'cancelled', 'branch_rejected', 'admin_rejected', 'wh_rejected', 'da_rejected', 'cancellation_pending'
           )`,
      ),
    ]);

    const warehouses = warehousesRes.rows.map(row => mapICWarehouseRow(row));
    const sales = salesRes.rows.map(row => mapICSaleRow(row));

    const warehouseAvailableById: Record<string, number> = {};
    const warehouseMetalGById: Record<string, number> = {};
    for (const w of warehouses) {
      warehouseAvailableById[w.id] = computeWarehouseAvailableUnits(w, sales);
      warehouseMetalGById[w.id] = Number(w.currentMetalG ?? 0);
    }

    return { warehouseAvailableById, warehouseMetalGById };
  } catch (err) {
    logger.error({ err }, 'getICTransferModalSnapshotsAction failed');
    return { warehouseAvailableById: {}, warehouseMetalGById: {} };
  }
}
