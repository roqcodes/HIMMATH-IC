'use server';

import { query } from '@/lib/db';
import {
  accountBalanceSql,
  accountMovementJoinSql,
  inrAccountBalanceSql,
  inrAccountMovementJoinSql,
} from '@/lib/icFunds/accountBalance';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { requireICFundsAccess } from '@/lib/icFunds/requireAccess';
import { getCurrentUserAction } from '@/app/actions/auth';
import { logger } from '@/lib/logger';

export type ICTransferModalSnapshot = {
  warehouseAvailableById: Record<string, number>;
  warehouseMetalGById: Record<string, number>;
  inrBalanceByEntityId: Record<string, number>;
  /** Minimal rows for indexICFundBalancesBySource (admin HQ only). */
  aedFundAccounts: {
    sourceType?: string;
    sourceId?: string;
    customerId?: string;
    balance: number;
  }[];
};

const EMPTY_SNAPSHOT: ICTransferModalSnapshot = {
  warehouseAvailableById: {},
  warehouseMetalGById: {},
  inrBalanceByEntityId: {},
  aedFundAccounts: [],
};

async function loadInrBalancesByEntityId(): Promise<Record<string, number>> {
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return {};

  try {
    const join = inrAccountMovementJoinSql({ branchParam: '$1' });
    const balanceSql = inrAccountBalanceSql();
    const res = await query(
      `SELECT a.source_id, ${balanceSql} AS balance
       FROM inr_fund_accounts a
       ${join}
       WHERE a.branch_id = $1
         AND a.source_type = 'ic_counterparty'
         AND a.source_id IS NOT NULL`,
      [HQ_IC_FUNDS_BRANCH_ID],
    );
    const out: Record<string, number> = {};
    for (const row of res.rows) {
      const id = String(row.source_id ?? '');
      if (!id) continue;
      out[id] = (out[id] ?? 0) + (Number(row.balance) || 0);
    }
    return out;
  } catch (err) {
    logger.error({ err }, 'loadInrBalancesByEntityId failed');
    return {};
  }
}

async function loadAedFundAccountBalances(isAdmin: boolean): Promise<ICTransferModalSnapshot['aedFundAccounts']> {
  if (!isAdmin) return [];
  const access = await requireICFundsAccess(HQ_IC_FUNDS_BRANCH_ID, 'read');
  if (!access.ok) return [];

  try {
    const join = accountMovementJoinSql({ branchParam: '$1' });
    const balanceSql = accountBalanceSql();
    const res = await query(
      `SELECT a.source_type, a.source_id, ${balanceSql} AS balance
       FROM ic_fund_accounts a
       ${join}
       WHERE a.branch_id = $1
         AND a.source_type IN ('ic_counterparty', 'ic_supplier', 'ic_customer')`,
      [HQ_IC_FUNDS_BRANCH_ID],
    );
    return res.rows.map(row => ({
      sourceType: row.source_type ? String(row.source_type) : undefined,
      sourceId: row.source_id != null ? String(row.source_id) : undefined,
      balance: Number(row.balance) || 0,
    }));
  } catch (err) {
    logger.error({ err }, 'loadAedFundAccountBalances failed');
    return [];
  }
}

/** Fresh warehouse stock and entity ledger inputs for IC transfer modals (one round trip). */
export async function getICTransferModalSnapshotsAction(): Promise<ICTransferModalSnapshot> {
  const userRes = await getCurrentUserAction();
  const user = userRes.success ? userRes.data : null;
  if (!user || !['admin', 'branch_manager', 'staff'].includes(user.role)) {
    return EMPTY_SNAPSHOT;
  }

  const isAdmin = user.role === 'admin';

  try {
    const [warehousesRes, inrBalanceByEntityId, aedFundAccounts] = await Promise.all([
      query(
        `SELECT id, current_stock, current_metal_g
         FROM ic_warehouses`,
      ),
      loadInrBalancesByEntityId(),
      loadAedFundAccountBalances(isAdmin),
    ]);

    const warehouseAvailableById: Record<string, number> = {};
    const warehouseMetalGById: Record<string, number> = {};
    for (const row of warehousesRes.rows) {
      const id = String(row.id);
      warehouseAvailableById[id] = Number(row.current_stock) || 0;
      warehouseMetalGById[id] = Number(row.current_metal_g) || 0;
    }

    return { warehouseAvailableById, warehouseMetalGById, inrBalanceByEntityId, aedFundAccounts };
  } catch (err) {
    logger.error({ err }, 'getICTransferModalSnapshotsAction failed');
    return EMPTY_SNAPSHOT;
  }
}

/** Single warehouse stock — targeted refresh without reloading all modal data. */
export async function getWarehouseStockSnapshotAction(
  warehouseId: string,
): Promise<{ units: number; metalG: number } | null> {
  if (!warehouseId?.trim()) return null;
  const userRes = await getCurrentUserAction();
  const user = userRes.success ? userRes.data : null;
  if (!user || !['admin', 'branch_manager', 'staff'].includes(user.role)) return null;

  try {
    const res = await query(
      `SELECT current_stock, current_metal_g FROM ic_warehouses WHERE id = $1 LIMIT 1`,
      [warehouseId.trim()],
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      units: Number(row.current_stock) || 0,
      metalG: Number(row.current_metal_g) || 0,
    };
  } catch (err) {
    logger.error({ err, warehouseId }, 'getWarehouseStockSnapshotAction failed');
    return null;
  }
}
