import 'server-only';

import type { QueryResult } from 'pg';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { relinkAedAgentLedgerAccounts } from '@/lib/counterparties/aedAgentSync';
import {
  ensureLinkedAccount,
  ensureSystemAccount,
  postVoucherInTx,
  voidVoucherByReference,
} from '@/lib/icFunds/icTransferFundSync';
import {
  ensureInrCounterpartyAccount,
  ensureInrWarehouseAccount,
  ensureInrSystemAccount,
  metalInrJournalReferenceId,
  postInrJournalInTx,
  voidInrMetalDealVouchers,
} from '@/lib/ledgers/inr/inrFundSync';
import { allocateMetalLotBookedCostAed, allocateMetalLotCostInr } from '@/lib/icTransfer/metalLotCost';
import {
  planMetalPurchaseJournals,
  planMetalSaleJournals,
  type MetalJournalRole,
} from '@/lib/metal/journalPlan';
import { ledgerVoucherDateFromInstant } from '@/lib/toIsoDateString';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

async function ensureMetalAedAccount(client: DbClient, branchId: string): Promise<string | null> {
  return ensureLinkedAccount(client, {
    branchId,
    sourceType: 'ic_counterparty',
    sourceId: 'metal_purchase_aed_clearing',
    name: 'Metal purchase AED',
  });
}

async function ensureMetalAedProceedsAccount(client: DbClient, branchId: string): Promise<string> {
  return ensureSystemAccount(client, branchId, 'Metal AED proceeds', 'personal', 'metal_aed_proceeds');
}

async function ensureAedAgentAccount(
  client: DbClient,
  branchId: string,
  agentId: string,
  agentName: string,
): Promise<string | null> {
  const agentRes = await client.query(
    `SELECT id, name, counterparty_id FROM ic_aed_agents WHERE id = $1 LIMIT 1`,
    [agentId],
  );
  const row = agentRes.rows[0];
  if (!row) return null;
  const displayName = String(row.name || agentName);
  const counterpartyId = row.counterparty_id ? String(row.counterparty_id) : null;
  await relinkAedAgentLedgerAccounts(client);

  if (counterpartyId) {
    return ensureLinkedAccount(client, {
      branchId,
      sourceType: 'ic_counterparty',
      sourceId: counterpartyId,
      name: displayName,
    });
  }

  return ensureLinkedAccount(client, {
    branchId,
    sourceType: 'ic_counterparty',
    sourceId: `aed_agent:${agentId}`,
    name: `Agent: ${displayName}`,
  });
}

export async function syncMetalPurchaseLedgers(
  client: DbClient,
  purchase: Record<string, unknown>,
  branchId: string,
  branchTz: string,
): Promise<void> {
  const purchaseId = String(purchase.id);
  const paymentMethod = normalizeMetalPaymentMethod(
    purchase.metal_payment_method as string | null,
  );
  const grossInr = roundLedgerAmount(Number(purchase.inr_total) || 0);
  const aedTotal = roundLedgerAmount(Number(purchase.aed_total) || 0);
  const voucherDate = ledgerVoucherDateFromInstant(purchase.created_at, branchTz);

  await voidVoucherByReference(client, branchId, 'ic_purchase', purchaseId);
  await voidVoucherByReference(client, branchId, 'metal_purchase_aed', purchaseId);
  await voidInrMetalDealVouchers(client, branchId, purchaseId, [
    'metal_purchase',
    'lab_test_purchase',
  ]);

  const labInr = roundLedgerAmount(Number(purchase.lab_total_inr) || 0);

  async function resolveSupplierInrAccount(): Promise<string | null> {
    let supplierAccountId: string | null = null;
    const counterpartyId = purchase.counterparty_id ? String(purchase.counterparty_id) : null;
    if (counterpartyId) {
      const cpRes = await client.query(
        `SELECT id, name FROM ic_counterparties WHERE id = $1 LIMIT 1`,
        [counterpartyId],
      );
      if (cpRes.rows[0]) {
        supplierAccountId = await ensureInrCounterpartyAccount(
          client,
          branchId,
          counterpartyId,
          String(cpRes.rows[0].name),
        );
      }
    }
    if (!supplierAccountId) {
      supplierAccountId = await ensureInrCounterpartyAccount(
        client,
        branchId,
        `purchase:${purchaseId}`,
        'Metal supplier',
      );
    }
    return supplierAccountId;
  }

  const agentId = purchase.aed_agent_id ? String(purchase.aed_agent_id) : null;
  const lines = planMetalPurchaseJournals({
    paymentMethod,
    grossInr,
    labInr,
    aedTotal,
    hasAgent: Boolean(agentId),
    splitInrPaid: Number(purchase.split_inr_paid) || 0,
    splitAedPaid: Number(purchase.split_aed_paid) || 0,
    hasWarehouse: Boolean(purchase.warehouse_id),
  });
  if (lines.length === 0) return;

  const needsSupplier = lines.some(l => l.debit === 'supplier' || l.credit === 'supplier');
  const needsMetalStock = lines.some(l => l.debit === 'metal_stock' || l.credit === 'metal_stock');
  const needsAedSettlement = lines.some(
    l => l.debit === 'aed_settlement' || l.credit === 'aed_settlement',
  );
  const needsCustomerAed = lines.some(l => l.debit === 'customer_aed' || l.credit === 'customer_aed');
  const needsMetalAed = lines.some(l => l.debit === 'metal_aed' || l.credit === 'metal_aed');
  const needsWarehouseInr = lines.some(l => l.debit === 'warehouse_inr' || l.credit === 'warehouse_inr');

  // Resolve supplier sequentially first (requires a DB lookup to build its own query).
  const supplierAccountId = needsSupplier ? await resolveSupplierInrAccount() : null;
  if (needsSupplier && !supplierAccountId) {
    throw new Error('Could not resolve INR account for metal purchase supplier');
  }

  // Resolve all independent system accounts in parallel to cut sequential round-trips.
  const purchaseCounterpartyId = purchase.counterparty_id ? String(purchase.counterparty_id) : null;
  const warehouseId = purchase.warehouse_id ? String(purchase.warehouse_id) : null;
  const [metalStockInr, aedSettlementInr, aedAccountPair, warehouseInr] = await Promise.all([
    needsMetalStock
      ? ensureInrSystemAccount(client, branchId, 'Metal Stock', 'inventory', 'metal_inventory')
      : Promise.resolve(null as string | null),
    needsAedSettlement
      ? ensureInrSystemAccount(client, branchId, 'Metal AED settlement', 'inventory', 'metal_aed_settlement')
      : Promise.resolve(null as string | null),
    (needsCustomerAed || needsMetalAed)
      ? (async (): Promise<{ customerAed: string | null; metalAed: string | null }> => {
          const [cpResult, metalAed] = await Promise.all([
            purchaseCounterpartyId
              ? client.query(`SELECT name FROM ic_counterparties WHERE id = $1 LIMIT 1`, [purchaseCounterpartyId])
              : Promise.resolve(null),
            ensureMetalAedAccount(client, branchId),
          ]);
          const customerAed = cpResult && cpResult.rows[0]
            ? await ensureLinkedAccount(client, {
                branchId,
                sourceType: 'ic_counterparty',
                sourceId: purchaseCounterpartyId!,
                name: String(cpResult.rows[0].name),
              })
            : null;
          return { customerAed, metalAed };
        })()
      : Promise.resolve({ customerAed: null as string | null, metalAed: null as string | null }),
    needsWarehouseInr && warehouseId
      ? ensureInrWarehouseAccount(client, warehouseId, branchId)
      : Promise.resolve(null as string | null),
  ]);

  if (needsAedSettlement && !aedSettlementInr) {
    throw new Error('Could not resolve INR account for metal AED settlement clearing');
  }
  const customerAedAccountId = aedAccountPair.customerAed;
  const metalAedAccountId = aedAccountPair.metalAed;
  if (needsCustomerAed && !customerAedAccountId) {
    throw new Error('Could not resolve AED account for metal purchase customer');
  }

  const roleId = (role: MetalJournalRole): string | null => {
    switch (role) {
      case 'supplier':
        return supplierAccountId;
      case 'aed_settlement':
        return aedSettlementInr;
      case 'warehouse_inr':
        return warehouseInr;
      case 'metal_stock':
        return metalStockInr;
      case 'customer_aed':
        return customerAedAccountId;
      case 'agent':
        return null;
      case 'metal_aed':
        return metalAedAccountId;
      default:
        return null;
    }
  };

  const sortedPurchaseLines = [...lines].sort((a, b) => {
    if (a.book === b.book) return 0;
    return a.book === 'INR' ? -1 : 1;
  });

  for (const line of sortedPurchaseLines) {
    const debitAccountId = roleId(line.debit);
    const creditAccountId = roleId(line.credit);
    if (!debitAccountId || !creditAccountId) {
      throw new Error(`Metal journal missing account for ${line.label} (${line.debit} → ${line.credit})`);
    }
    const notes = `${line.label} ${purchaseId.slice(0, 8)}`;
    if (line.book === 'AED') {
      await postVoucherInTx(client, {
        branchId,
        voucherType: 'journal',
        voucherDate,
        debitAccountId,
        creditAccountId,
        amount: line.amount,
        notes,
        referenceType: line.referenceType,
        referenceId: purchaseId,
      });
      continue;
    }
    await postInrJournalInTx(client, {
      branchId,
      voucherDate,
      debitAccountId,
      creditAccountId,
      amount: line.amount,
      notes,
      referenceType: line.referenceType,
      referenceId: metalInrJournalReferenceId(purchaseId, line),
    });
  }
}

export async function voidMetalPurchaseLedgers(
  client: DbClient,
  branchId: string,
  purchaseId: string,
): Promise<void> {
  await voidVoucherByReference(client, branchId, 'ic_purchase', purchaseId);
  await voidVoucherByReference(client, branchId, 'metal_purchase_aed', purchaseId);
  await voidInrMetalDealVouchers(client, branchId, purchaseId, [
    'metal_purchase',
    'lab_test_purchase',
  ]);
}

async function ensureMetalSaleCustomerInrAccount(
  client: DbClient,
  branchId: string,
  sale: Record<string, unknown>,
): Promise<string | null> {
  const counterpartyId = sale.counterparty_id
    ? String(sale.counterparty_id)
    : sale.order_customer_id
      ? String(sale.order_customer_id)
      : '';
  const displayName = String(sale.order_customer_name || sale.customer_name || '').trim();

  if (counterpartyId) {
    const cpRes = await client.query(
      `SELECT id, name FROM ic_counterparties WHERE id = $1 LIMIT 1`,
      [counterpartyId],
    );
    if (cpRes.rows[0]) {
      return ensureInrCounterpartyAccount(
        client,
        branchId,
        String(cpRes.rows[0].id),
        String(cpRes.rows[0].name || displayName || 'Customer'),
      );
    }
  }

  if (displayName) {
    const byName = await client.query(
      `SELECT id, name FROM ic_counterparties WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1`,
      [displayName],
    );
    if (byName.rows[0]) {
      return ensureInrCounterpartyAccount(
        client,
        branchId,
        String(byName.rows[0].id),
        String(byName.rows[0].name),
      );
    }
  }

  return null;
}

async function loadLotPurchasePayment(
  client: DbClient,
  purchaseId: string,
): Promise<{ paymentMethod: string; purchaseInr: number; purchaseAed: number; purchaseAedRatePerG: number; splitAedPaid: number; purchasedG: number; labTotalInr: number }> {
  const res = await client.query(
    `SELECT metal_payment_method, inr_total, aed_total, split_aed_paid, metal_weight_g, metal_rate_aed_per_g, lab_total_inr
     FROM ic_purchases WHERE id = $1 LIMIT 1`,
    [purchaseId],
  );
  const row = res.rows[0];
  if (!row) {
    return { paymentMethod: 'CASH', purchaseInr: 0, purchaseAed: 0, purchaseAedRatePerG: 0, splitAedPaid: 0, purchasedG: 0, labTotalInr: 0 };
  }
  return {
    paymentMethod: String(row.metal_payment_method || 'AED'),
    purchaseInr: Number(row.inr_total) || 0,
    purchaseAed: Number(row.aed_total) || 0,
    purchaseAedRatePerG: Number(row.metal_rate_aed_per_g) || 0,
    splitAedPaid: Number(row.split_aed_paid) || 0,
    purchasedG: Number(row.metal_weight_g) || 0,
    labTotalInr: Number(row.lab_total_inr) || 0,
  };
}

export async function syncMetalSaleLedgers(
  client: DbClient,
  sale: Record<string, unknown>,
  branchId: string,
  branchTz: string,
): Promise<void> {
  const saleId = String(sale.id);
  const orderStatus = String(sale.order_status || '');
  const paymentMethod = normalizeMetalPaymentMethod(sale.metal_payment_method as string | null);
  const voucherDate = ledgerVoucherDateFromInstant(sale.created_at, branchTz);

  await voidVoucherByReference(client, branchId, 'ic_sale', saleId);
  await voidVoucherByReference(client, branchId, 'metal_sale_aed', saleId);
  await voidVoucherByReference(client, branchId, 'metal_sale_ic_stock', saleId);
  await voidVoucherByReference(client, branchId, 'metal_fx_profit', saleId);
  await voidInrMetalDealVouchers(client, branchId, saleId, [
    'metal_sale_profit',
    'metal_sale_receipt',
    'metal_sale_cogs',
    'lab_test_sale',
  ]);

  if (orderStatus !== 'completed') return;

  const saleG = Number(sale.metal_weight_g) || 0;
  const saleGrossInr = roundLedgerAmount(Number(sale.inr_total) || 0);
  const saleLabInr = roundLedgerAmount(Number(sale.lab_total_inr) || 0);
  const saleAed = roundLedgerAmount(Number(sale.aed_amount) || 0);
  const purchaseId = sale.metal_purchase_id ? String(sale.metal_purchase_id) : '';
  const hasLot = Boolean(purchaseId);
  const lot = hasLot
    ? await loadLotPurchasePayment(client, purchaseId)
    : { paymentMethod: 'CASH', purchaseInr: 0, purchaseAed: 0, purchaseAedRatePerG: 0, splitAedPaid: 0, purchasedG: 0, labTotalInr: 0 };

  const lotCostInrAllocated = hasLot
    ? allocateMetalLotCostInr(
        {
          inrTotal: lot.purchaseInr,
          metalWeightG: lot.purchasedG,
          labTotalInr: lot.labTotalInr,
        },
        saleG,
      )
    : 0;
  const lotPurchaseAedAllocated = hasLot
    ? allocateMetalLotBookedCostAed(
        { aedTotal: lot.purchaseAed, splitAedPaid: lot.splitAedPaid, paymentMethod: lot.paymentMethod, metalWeightG: lot.purchasedG, metalRateAedPerG: lot.purchaseAedRatePerG },
        saleG,
      )
    : 0;

  const agentId = sale.aed_agent_id ? String(sale.aed_agent_id) : null;
  const lines = planMetalSaleJournals({
    completed: true,
    paymentMethod,
    lotPaymentMethod: hasLot ? lot.paymentMethod : null,
    hasLot,
    saleGrossInr,
    saleLabInr,
    saleAed,
    lotCostInrAllocated,
    lotPurchaseAedAllocated,
    hasAgent: Boolean(agentId),
    splitInrPaid: Number(sale.split_inr_paid) || 0,
    splitAedPaid: Number(sale.split_aed_paid) || 0,
    hasWarehouse: Boolean(sale.warehouse_id),
  });
  if (lines.length === 0) return;

  const needsCustomer = lines.some(l => l.debit === 'customer' || l.credit === 'customer');
  const needsMetalStockSale = lines.some(l => l.debit === 'metal_stock' || l.credit === 'metal_stock');
  const needsMetalSales = lines.some(l => l.debit === 'metal_sales' || l.credit === 'metal_sales');
  const needsMetalCost = lines.some(l => l.debit === 'metal_cost' || l.credit === 'metal_cost');
  const needsMetalProfit = lines.some(l => l.debit === 'metal_profit' || l.credit === 'metal_profit');
  const needsMetalFx = lines.some(l => l.debit === 'metal_fx' || l.credit === 'metal_fx');
  const needsAedSettlement = lines.some(
    l => l.debit === 'aed_settlement' || l.credit === 'aed_settlement',
  );
  const needsCustomerAed = lines.some(l => l.debit === 'customer_aed' || l.credit === 'customer_aed');
  const needsMetalAedProceeds = lines.some(
    l => l.debit === 'metal_aed_proceeds' || l.credit === 'metal_aed_proceeds',
  );
  const needsMetalAedAny = lines.some(
    l =>
      l.debit === 'metal_aed' ||
      l.credit === 'metal_aed' ||
      l.debit === 'metal_aed_proceeds' ||
      l.credit === 'metal_aed_proceeds',
  );
  const needsWarehouseInr = lines.some(l => l.debit === 'warehouse_inr' || l.credit === 'warehouse_inr');

  // Resolve all independent system accounts in parallel to cut sequential round-trips.
  const saleCounterpartyId = sale.counterparty_id ? String(sale.counterparty_id) : null;

  const [
    customerAccountId,
    metalStockInr,
    metalSalesInr,
    metalCostInr,
    metalProfitInr,
    metalFxAed,
    aedSettlementInr,
    metalAedProceedsId,
    aedAccountPairSale,
    warehouseInr,
  ] = await Promise.all([
    needsCustomer
      ? ensureMetalSaleCustomerInrAccount(client, branchId, sale)
      : Promise.resolve(null as string | null),
    needsMetalStockSale
      ? ensureInrSystemAccount(client, branchId, 'Metal Stock', 'inventory', 'metal_inventory')
      : Promise.resolve(null as string | null),
    needsMetalSales
      ? ensureInrSystemAccount(client, branchId, 'Metal Sales', 'income', 'metal_sales')
      : Promise.resolve(null as string | null),
    needsMetalCost
      ? ensureInrSystemAccount(client, branchId, 'Cost of Metal Sold', 'expense', 'metal_cost')
      : Promise.resolve(null as string | null),
    needsMetalProfit
      ? ensureInrSystemAccount(client, branchId, 'Metal Profit', 'profit', 'metal_profit')
      : Promise.resolve(null as string | null),
    needsMetalFx
      ? ensureSystemAccount(client, branchId, 'Metal FX Profit', 'profit', 'metal_fx_profit')
      : Promise.resolve(null as string | null),
    needsAedSettlement
      ? ensureInrSystemAccount(client, branchId, 'Metal AED settlement', 'inventory', 'metal_aed_settlement')
      : Promise.resolve(null as string | null),
    needsMetalAedProceeds
      ? ensureMetalAedProceedsAccount(client, branchId)
      : Promise.resolve(null as string | null),
    (needsCustomerAed || needsMetalAedAny)
      ? (async (): Promise<{ customerAed: string | null; metalAed: string | null }> => {
          const [cpResult, metalAed] = await Promise.all([
            saleCounterpartyId
              ? client.query(`SELECT name FROM ic_counterparties WHERE id = $1 LIMIT 1`, [saleCounterpartyId])
              : Promise.resolve(null),
            ensureMetalAedAccount(client, branchId),
          ]);
          const customerAed = cpResult && cpResult.rows[0]
            ? await ensureLinkedAccount(client, {
                branchId,
                sourceType: 'ic_counterparty',
                sourceId: saleCounterpartyId!,
                name: String(cpResult.rows[0].name),
              })
            : null;
          return { customerAed, metalAed };
        })()
      : Promise.resolve({ customerAed: null as string | null, metalAed: null as string | null }),
    needsWarehouseInr && sale.warehouse_id
      ? ensureInrWarehouseAccount(client, String(sale.warehouse_id), branchId)
      : Promise.resolve(null as string | null),
  ]);

  if (needsCustomer && !customerAccountId) {
    throw new Error('Could not resolve INR account for metal sale customer');
  }
  if (needsAedSettlement && !aedSettlementInr) {
    throw new Error('Could not resolve INR account for metal AED settlement clearing');
  }

  const customerAedAccountId = aedAccountPairSale.customerAed;
  let metalAedAccountId: string | null = aedAccountPairSale.metalAed;

  if (needsCustomerAed || needsMetalAedAny) {
    const needsAedBook = lines.some(l => l.book === 'AED');
    if (needsAedBook && needsCustomerAed && !customerAedAccountId) {
      throw new Error('Could not resolve AED account for metal sale customer');
    }
    if (needsAedBook && !metalAedAccountId && !metalAedProceedsId) {
      throw new Error('Could not resolve AED clearing accounts for metal sale');
    }
  }

  const roleId = (role: MetalJournalRole): string | null => {
    switch (role) {
      case 'customer':
        return customerAccountId;
      case 'customer_aed':
        return customerAedAccountId;
      case 'aed_settlement':
        return aedSettlementInr;
      case 'warehouse_inr':
        return warehouseInr;
      case 'metal_stock':
        return metalStockInr;
      case 'metal_sales':
        return metalSalesInr;
      case 'metal_cost':
        return metalCostInr;
      case 'metal_profit':
        return metalProfitInr;
      case 'agent':
        return null;
      case 'metal_aed':
        return metalAedAccountId;
      case 'metal_aed_proceeds':
        return metalAedProceedsId;
      case 'metal_fx':
        return metalFxAed;
      default:
        return null;
    }
  };

  const sortedLines = [...lines].sort((a, b) => {
    if (a.book === b.book) return 0;
    return a.book === 'INR' ? -1 : 1;
  });

  for (const line of sortedLines) {
    const debitAccountId = roleId(line.debit);
    const creditAccountId = roleId(line.credit);
    if (!debitAccountId || !creditAccountId) {
      throw new Error(`Metal journal missing account for ${line.label} (${line.debit} → ${line.credit})`);
    }
    const notes = `${line.label} ${saleId.slice(0, 8)}`;
    if (line.book === 'AED') {
      await postVoucherInTx(client, {
        branchId,
        voucherType: 'journal',
        voucherDate,
        debitAccountId,
        creditAccountId,
        amount: line.amount,
        notes,
        referenceType: line.referenceType,
        referenceId: saleId,
      });
      continue;
    }
    await postInrJournalInTx(client, {
      branchId,
      voucherDate,
      debitAccountId,
      creditAccountId,
      amount: line.amount,
      notes,
      referenceType: line.referenceType,
      referenceId: metalInrJournalReferenceId(saleId, line),
    });
  }

  const profitRow = await client.query(
    `SELECT id::text AS id FROM inr_fund_vouchers
     WHERE branch_id = $1 AND reference_type = 'metal_sale_profit' AND status = 'active'
       AND (reference_id = $2 OR reference_id LIKE $3)
     LIMIT 1`,
    [branchId, saleId, `${saleId}#%`],
  );
  const profitVoucherId = profitRow.rows[0]?.id;
  if (profitVoucherId) {
    const { tryAllocateCapitalFromInrVoucher } = await import('@/lib/capital/voucherHook');
    await tryAllocateCapitalFromInrVoucher(client, branchId, profitVoucherId);
  }
}

export async function voidMetalSaleLedgers(
  client: DbClient,
  branchId: string,
  saleId: string,
): Promise<void> {
  await voidVoucherByReference(client, branchId, 'ic_sale', saleId);
  await voidVoucherByReference(client, branchId, 'metal_sale_aed', saleId);
  await voidVoucherByReference(client, branchId, 'metal_sale_ic_stock', saleId);
  await voidVoucherByReference(client, branchId, 'metal_fx_profit', saleId);
  await voidInrMetalDealVouchers(client, branchId, saleId, [
    'metal_sale_profit',
    'metal_sale_receipt',
    'metal_sale_cogs',
    'lab_test_sale',
  ]);
}
