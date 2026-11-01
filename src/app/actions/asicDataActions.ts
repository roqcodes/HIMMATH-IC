'use server';

import { getCurrentUserAction } from '@/app/actions/auth';
import type { DbActionResult, InitialDataPayload, TransactionalDataPayload } from '@/lib/dbActionTypes';
import { query, runQueryBatch } from '@/lib/db';
import { ensureDbSchema } from '@/lib/dbSchema';
import { resolveBranchTimeZone } from '@/lib/businessTime';
import { normalizeHiddenPages } from '@/lib/branchPages';
import { isBranchScopedUser, isCustomerRole } from '@/lib/rbac';
import { PRODUCT_NAME } from '@/lib/brand';
import { mapICCounterpartyRow, COUNTERPARTY_SELECT } from '@/lib/counterparties/mapper';
import {
  mapICPurchaseRow,
  mapICRateGroupRow,
  mapICRegionRow,
  mapICSaleRow,
  mapICWarehouseRow,
  mapICWarehouseTransactionRow,
} from '@/lib/icTransferMappers';
import { mapICTransferSettingsRow } from '@/lib/icTransfer/settings';
import { filterRateGroupsForCustomerPortal, stripAdminRatesFromSale } from '@/lib/icTransfer/customerPortalScope';
import { logger } from '@/lib/logger';
import type { Branch, User } from '@/types';
import { ensureHqIcFundsBranch } from '@/lib/icFunds/ensureHqBranch';

const BRANCHES_SELECT = `
  SELECT id, slug, name, logo_url, address, city, country, trn, phone, email, website, location,
         manager_name, cash_balance, gold_balance, current_balance, opening_balance, opening_gold_balance,
         closing_balance, daily_pl, status, timezone, hidden_pages, last_activity, created_at
  FROM branches
  WHERE deleted_at IS NULL`;

import { IC_RATE_GROUPS_WITH_MEMBERS_SELECT } from '@/lib/icTransfer/rateGroupQueries';

const IC_SALES_SELECT = `
  SELECT s.*, a.name AS delivery_agent_name
  FROM ic_sales s
  LEFT JOIN ic_delivery_agents a ON s.delivery_agent_id = a.id`;

type FetchContext = {
  currentUser: User | null;
  branchId: string | null;
  customerSession: boolean;
};

async function resolveFetchContext(
  branchSlug?: string,
  knownUser?: User | null,
): Promise<FetchContext> {
  let currentUser = knownUser ?? null;
  if (knownUser === undefined) {
    const userRes = await getCurrentUserAction(branchSlug);
    currentUser = userRes.success ? userRes.data ?? null : null;
  }

  const isBranchScoped =
    !!currentUser && isBranchScopedUser(currentUser) && !!currentUser.branchId;
  const branchId = isBranchScoped ? currentUser!.branchId! : null;
  const customerSession =
    !!currentUser && isCustomerRole(currentUser.role) && !!currentUser.customerId;

  return { currentUser, branchId, customerSession };
}

function mapBranchRow(r: Record<string, unknown>): Branch {
  return {
    id: String(r.id),
    slug: r.slug ? String(r.slug) : String(r.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: String(r.name),
    logo_url: r.logo_url ? String(r.logo_url) : undefined,
    address: r.address ? String(r.address) : undefined,
    city: r.city ? String(r.city) : undefined,
    country: r.country ? String(r.country) : undefined,
    trn: r.trn ? String(r.trn) : undefined,
    phone: r.phone ? String(r.phone) : undefined,
    email: r.email ? String(r.email) : undefined,
    website: r.website ? String(r.website) : undefined,
    location: r.location ? String(r.location) : '',
    managerName: r.manager_name ? String(r.manager_name) : '',
    cashBalance: parseFloat(String(r.cash_balance || '0')),
    goldBalance: parseFloat(String(r.gold_balance || '0')),
    currentBalance: parseFloat(String(r.current_balance || '0')),
    openingBalance: parseFloat(String(r.opening_balance || '0')),
    openingGoldBalance: parseFloat(String(r.opening_gold_balance || '0')),
    closingBalance: parseFloat(String(r.closing_balance || '0')),
    dailyPL: parseFloat(String(r.daily_pl || '0')),
    status: r.status === 'inactive' ? 'inactive' : 'active',
    timezone: resolveBranchTimeZone(r.timezone ? String(r.timezone) : null),
    hiddenPages: normalizeHiddenPages(Array.isArray(r.hidden_pages) ? r.hidden_pages.map(String) : []),
    lastActivity: r.last_activity ? new Date(String(r.last_activity)).toISOString() : new Date().toISOString(),
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
  };
}

async function loadBranches(branchId: string | null) {
  if (branchId) {
    return query(`${BRANCHES_SELECT} AND id = $1 ORDER BY name ASC`, [branchId]);
  }
  return query(`${BRANCHES_SELECT} ORDER BY name ASC`);
}

async function loadSuppliers(branchId: string | null) {
  if (branchId) {
    return query(
      `SELECT ${COUNTERPARTY_SELECT}
       FROM ic_counterparties WHERE branch_id = $1 OR branch_id IS NULL`,
      [branchId],
    );
  }
  return query(`SELECT ${COUNTERPARTY_SELECT} FROM ic_counterparties`);
}

async function loadWarehouses(branchId: string | null) {
  if (branchId) {
    return query('SELECT * FROM ic_warehouses WHERE branch_id = $1', [branchId]);
  }
  return query('SELECT * FROM ic_warehouses');
}

async function loadPurchases(_branchId: string | null) {
  return query('SELECT * FROM ic_purchases ORDER BY created_at DESC LIMIT 500');
}

async function loadSales(ctx: FetchContext) {
  if (ctx.customerSession && ctx.currentUser?.customerId) {
    return query(
      `${IC_SALES_SELECT}
       WHERE s.order_customer_id = $1
       ORDER BY s.created_at DESC LIMIT 200`,
      [ctx.currentUser.customerId],
    );
  }
  return query(`${IC_SALES_SELECT} ORDER BY s.created_at DESC LIMIT 400`);
}

async function loadWarehouseTransactions(_branchId: string | null) {
  return query('SELECT * FROM ic_warehouse_transactions ORDER BY created_at DESC LIMIT 400');
}

async function postProcessSalesAndRates(
  ctx: FetchContext,
  icSalesRes: { rows: Record<string, unknown>[] },
  icRateGroupsRes: { rows: Record<string, unknown>[] },
) {
  let icSales = icSalesRes.rows.map(r => mapICSaleRow(r));
  let icRateGroups = icRateGroupsRes.rows.map(r => mapICRateGroupRow(r));

  if (ctx.customerSession && ctx.currentUser?.customerId) {
    const parentId = ctx.currentUser.customerId;
    let custBranchId = ctx.currentUser.branchId || '';
    if (!custBranchId) {
      const custBranchRes = await query(`SELECT branch_id FROM customers WHERE id = $1 LIMIT 1`, [parentId]);
      custBranchId = custBranchRes.rows[0]?.branch_id ? String(custBranchRes.rows[0].branch_id) : '';
    }
    icSales = icSales.map(stripAdminRatesFromSale);
    icRateGroups = filterRateGroupsForCustomerPortal(icRateGroups, parentId, custBranchId || undefined);
  } else {
    icSales = icSales.map(sale => {
      const { subCustomerId: _id, subCustomerName: _name, ...rest } = sale;
      return rest;
    });
  }

  return { icSales, icRateGroups };
}

export async function fetchAsicTransactionalDataAction(
  branchSlug?: string,
  knownUser?: User | null,
): Promise<DbActionResult<TransactionalDataPayload>> {
  try {
    const ctx = await resolveFetchContext(branchSlug, knownUser);

    const [branchesRes, icPurchasesRes, icSalesRes, icWarehouseTxRes] = await runQueryBatch([
      () => loadBranches(ctx.branchId),
      () => loadPurchases(ctx.branchId),
      () => loadSales(ctx),
      () => loadWarehouseTransactions(ctx.branchId),
    ]);

    const branches = branchesRes.rows.map(r => mapBranchRow(r as Record<string, unknown>));
    const { icSales } = await postProcessSalesAndRates(ctx, icSalesRes, { rows: [] });

    const finalBranches = ctx.branchId ? branches.filter(b => b.id === ctx.branchId) : branches;

    return {
      success: true,
      data: {
        globalBranches: branches,
        branches: finalBranches,
        icPurchases: icPurchasesRes.rows.map(r => mapICPurchaseRow(r)),
        icSales,
        icWarehouseTransactions: icWarehouseTxRes.rows.map(r => mapICWarehouseTransactionRow(r)),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to refresh transactional data.';
    logger.error({ error, branchSlug }, 'fetchAsicTransactionalDataAction failed');
    return { success: false, error: message };
  }
}

export async function fetchAsicInitialDataAction(
  branchSlug?: string,
  knownUser?: User | null,
): Promise<DbActionResult<InitialDataPayload>> {
  try {
    await ensureDbSchema();
    const ctx = await resolveFetchContext(branchSlug, knownUser);

    if (ctx.currentUser?.role === 'admin') {
      try {
        await ensureHqIcFundsBranch();
      } catch (error) {
        logger.warn({ error }, 'ensureHqIcFundsBranch failed during bootstrap');
      }
    }

    const [
      branchesRes,
      icRegionsRes,
      icSuppliersRes,
      icWarehousesRes,
      icTransferSettingsRes,
      icRateGroupsRes,
      icPurchasesRes,
      icSalesRes,
      icWarehouseTxRes,
    ] = await runQueryBatch([
      () => loadBranches(ctx.branchId),
      () => query('SELECT id, name, country, created_at FROM ic_regions'),
      () => loadSuppliers(ctx.branchId),
      () => loadWarehouses(ctx.branchId),
      () =>
        query(
          `SELECT sales_enabled, auto_rate_reset_enabled, warehouse_fulfillment_enabled, updated_at, updated_by
           FROM ic_transfer_settings WHERE id = 'global' LIMIT 1`,
        ),
      () => query(IC_RATE_GROUPS_WITH_MEMBERS_SELECT),
      () => loadPurchases(ctx.branchId),
      () => loadSales(ctx),
      () => loadWarehouseTransactions(ctx.branchId),
    ]);

    const branches = branchesRes.rows.map(r => mapBranchRow(r as Record<string, unknown>));
    const { icSales, icRateGroups } = await postProcessSalesAndRates(ctx, icSalesRes, icRateGroupsRes);
    const finalBranches = ctx.branchId ? branches.filter(b => b.id === ctx.branchId) : branches;

    return {
      success: true,
      data: {
        globalBranches: branches,
        branches: finalBranches,
        icRegions: icRegionsRes.rows.map(r => mapICRegionRow(r)),
        icSuppliers: icSuppliersRes.rows.map(r => mapICCounterpartyRow(r)),
        icWarehouses: icWarehousesRes.rows.map(r => mapICWarehouseRow(r)),
        icRateGroups,
        icTransferSettings: mapICTransferSettingsRow(icTransferSettingsRes.rows[0]),
        icPurchases: icPurchasesRes.rows.map(r => mapICPurchaseRow(r)),
        icSales,
        icWarehouseTransactions: icWarehouseTxRes.rows.map(r => mapICWarehouseTransactionRow(r)),
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : `Failed to fetch ${PRODUCT_NAME} data.`;
    logger.error({ error, branchSlug }, 'fetchAsicInitialDataAction failed');
    return { success: false, error: message };
  }
}
