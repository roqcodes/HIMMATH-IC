import 'server-only';

import type { QueryResult } from 'pg';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';
import { relinkAedAgentLedgerAccounts } from '@/lib/counterparties/aedAgentSync';
import {
  ensureLinkedAccount,
  postVoucherInTx,
  voidVoucherByReference,
} from '@/lib/icFunds/icTransferFundSync';
import {
  ensureInrCounterpartyAccount,
  ensureInrSystemAccount,
  postInrJournalInTx,
  voidInrVoucherByReference,
} from '@/lib/ledgers/inr/inrFundSync';
import { allocateMetalLotCostInr } from '@/lib/icTransfer/metalLotCost';
import {
  planMetalPurchaseJournals,
  planMetalSaleJournals,
  type MetalJournalRole,
} from '@/lib/metal/journalPlan';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

function isoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? '');
  return raw.length >= 10 ? raw.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

async function ensureMetalAedAccount(client: DbClient, branchId: string): Promise<string | null> {
  return ensureLinkedAccount(client, {
    branchId,
    sourceType: 'ic_counterparty',
    sourceId: 'metal_purchase_aed_clearing',
    name: 'Metal purchase AED',
  });
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
): Promise<void> {
  const purchaseId = String(purchase.id);
  const paymentMethod = normalizeMetalPaymentMethod(
    purchase.metal_payment_method as string | null,
  );
  const grossInr = roundLedgerAmount(Number(purchase.inr_total) || 0);
  const aedTotal = roundLedgerAmount(Number(purchase.aed_total) || 0);
  const voucherDate = isoDate(purchase.created_at);

  await voidVoucherByReference(client, branchId, 'ic_purchase', purchaseId);
  await voidVoucherByReference(client, branchId, 'metal_purchase_aed', purchaseId);
  await voidInrVoucherByReference(client, branchId, 'metal_purchase', purchaseId);
  await voidInrVoucherByReference(client, branchId, 'lab_test_purchase', purchaseId);

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
  });
  if (lines.length === 0) return;

  const needsSupplier = lines.some(l => l.debit === 'supplier' || l.credit === 'supplier');
  const supplierAccountId = needsSupplier ? await resolveSupplierInrAccount() : null;
  if (needsSupplier && !supplierAccountId) return;

  const metalStockInr = lines.some(l => l.debit === 'metal_stock' || l.credit === 'metal_stock')
    ? await ensureInrSystemAccount(client, branchId, 'Metal Stock', 'inventory', 'metal_inventory')
    : null;

  const needsAedSettlement = lines.some(
    l => l.debit === 'aed_settlement' || l.credit === 'aed_settlement',
  );
  const aedSettlementInr = needsAedSettlement
    ? await ensureInrSystemAccount(
        client,
        branchId,
        'Metal AED settlement',
        'inventory',
        'metal_aed_settlement',
      )
    : null;
  if (needsAedSettlement && !aedSettlementInr) return;

  let agentAccountId: string | null = null;
  let metalAedAccountId: string | null = null;
  if (lines.some(l => l.debit === 'agent' || l.credit === 'agent' || l.debit === 'metal_aed' || l.credit === 'metal_aed')) {
    if (agentId) {
      agentAccountId = await ensureAedAgentAccount(client, branchId, agentId, 'AED agent');
      metalAedAccountId = await ensureMetalAedAccount(client, branchId);
    }
    if (!agentAccountId || !metalAedAccountId) return;
  }

  const roleId = (role: MetalJournalRole): string | null => {
    switch (role) {
      case 'supplier':
        return supplierAccountId;
      case 'aed_settlement':
        return aedSettlementInr;
      case 'metal_stock':
        return metalStockInr;
      case 'agent':
        return agentAccountId;
      case 'metal_aed':
        return metalAedAccountId;
      default:
        return null;
    }
  };

  for (const line of lines) {
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
      referenceId: purchaseId,
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
  await voidInrVoucherByReference(client, branchId, 'metal_purchase', purchaseId);
  await voidInrVoucherByReference(client, branchId, 'lab_test_purchase', purchaseId);
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
): Promise<{ paymentMethod: string; purchaseInr: number; purchaseAed: number; purchasedG: number; labTotalInr: number }> {
  const res = await client.query(
    `SELECT metal_payment_method, inr_total, aed_total, metal_weight_g, lab_total_inr
     FROM ic_purchases WHERE id = $1 LIMIT 1`,
    [purchaseId],
  );
  const row = res.rows[0];
  if (!row) {
    return { paymentMethod: 'CASH', purchaseInr: 0, purchaseAed: 0, purchasedG: 0, labTotalInr: 0 };
  }
  return {
    paymentMethod: String(row.metal_payment_method || 'AED'),
    purchaseInr: Number(row.inr_total) || 0,
    purchaseAed: Number(row.aed_total) || 0,
    purchasedG: Number(row.metal_weight_g) || 0,
    labTotalInr: Number(row.lab_total_inr) || 0,
  };
}

export async function syncMetalSaleLedgers(
  client: DbClient,
  sale: Record<string, unknown>,
  branchId: string,
): Promise<void> {
  const saleId = String(sale.id);
  const orderStatus = String(sale.order_status || '');
  const paymentMethod = normalizeMetalPaymentMethod(sale.metal_payment_method as string | null);
  const voucherDate = isoDate(sale.status_updated_at || sale.created_at);

  await voidVoucherByReference(client, branchId, 'ic_sale', saleId);
  await voidVoucherByReference(client, branchId, 'metal_sale_aed', saleId);
  await voidVoucherByReference(client, branchId, 'metal_sale_ic_stock', saleId);
  await voidVoucherByReference(client, branchId, 'metal_fx_profit', saleId);
  await voidInrVoucherByReference(client, branchId, 'metal_sale_profit', saleId);
  await voidInrVoucherByReference(client, branchId, 'metal_sale_receipt', saleId);
  await voidInrVoucherByReference(client, branchId, 'metal_sale_cogs', saleId);
  await voidInrVoucherByReference(client, branchId, 'lab_test_sale', saleId);

  if (orderStatus !== 'completed') return;

  const saleG = Number(sale.metal_weight_g) || 0;
  const saleGrossInr = roundLedgerAmount(Number(sale.inr_total) || 0);
  const saleLabInr = roundLedgerAmount(Number(sale.lab_total_inr) || 0);
  const saleAed = roundLedgerAmount(Number(sale.aed_amount) || 0);
  const purchaseId = sale.metal_purchase_id ? String(sale.metal_purchase_id) : '';
  const hasLot = Boolean(purchaseId);
  const lot = hasLot
    ? await loadLotPurchasePayment(client, purchaseId)
    : { paymentMethod: 'CASH', purchaseInr: 0, purchaseAed: 0, purchasedG: 0, labTotalInr: 0 };

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
    hasAgent: Boolean(agentId),
  });
  if (lines.length === 0) return;

  const needsCustomer = lines.some(l => l.debit === 'customer' || l.credit === 'customer');
  const customerAccountId = needsCustomer ? await ensureMetalSaleCustomerInrAccount(client, branchId, sale) : null;
  if (needsCustomer && !customerAccountId) {
    throw new Error('Could not resolve INR account for metal sale customer');
  }

  const metalStockInr = lines.some(l => l.debit === 'metal_stock' || l.credit === 'metal_stock')
    ? await ensureInrSystemAccount(client, branchId, 'Metal Stock', 'inventory', 'metal_inventory')
    : null;
  const metalSalesInr = lines.some(l => l.debit === 'metal_sales' || l.credit === 'metal_sales')
    ? await ensureInrSystemAccount(client, branchId, 'Metal Sales', 'income', 'metal_sales')
    : null;
  const metalCostInr = lines.some(l => l.debit === 'metal_cost' || l.credit === 'metal_cost')
    ? await ensureInrSystemAccount(client, branchId, 'Cost of Metal Sold', 'expense', 'metal_cost')
    : null;
  const metalProfitInr = lines.some(l => l.debit === 'metal_profit' || l.credit === 'metal_profit')
    ? await ensureInrSystemAccount(client, branchId, 'Metal Profit', 'profit', 'metal_profit')
    : null;

  const needsAedSettlement = lines.some(
    l => l.debit === 'aed_settlement' || l.credit === 'aed_settlement',
  );
  const aedSettlementInr = needsAedSettlement
    ? await ensureInrSystemAccount(
        client,
        branchId,
        'Metal AED settlement',
        'inventory',
        'metal_aed_settlement',
      )
    : null;
  if (needsAedSettlement && !aedSettlementInr) {
    throw new Error('Could not resolve INR account for metal AED settlement clearing');
  }

  let agentAccountId: string | null = null;
  let metalAedAccountId: string | null = null;
  if (lines.some(l => l.debit === 'agent' || l.credit === 'agent' || l.debit === 'metal_aed' || l.credit === 'metal_aed')) {
    if (agentId) {
      agentAccountId = await ensureAedAgentAccount(client, branchId, agentId, 'AED agent');
      metalAedAccountId = await ensureMetalAedAccount(client, branchId);
    }
    if (!agentAccountId || !metalAedAccountId) {
      const inrOnly = lines.filter(l => l.book === 'INR');
      if (inrOnly.length === 0) return;
    }
  }

  const roleId = (role: MetalJournalRole): string | null => {
    switch (role) {
      case 'customer':
        return customerAccountId;
      case 'aed_settlement':
        return aedSettlementInr;
      case 'metal_stock':
        return metalStockInr;
      case 'metal_sales':
        return metalSalesInr;
      case 'metal_cost':
        return metalCostInr;
      case 'metal_profit':
        return metalProfitInr;
      case 'agent':
        return agentAccountId;
      case 'metal_aed':
        return metalAedAccountId;
      default:
        return null;
    }
  };

  for (const line of lines) {
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
    const inrVoucherId = await postInrJournalInTx(client, {
      branchId,
      voucherDate,
      debitAccountId,
      creditAccountId,
      amount: line.amount,
      notes,
      referenceType: line.referenceType,
      referenceId: saleId,
    });
    if (inrVoucherId && line.referenceType === 'metal_sale_profit') {
      const { tryAllocateCapitalFromInrVoucher } = await import('@/lib/capital/voucherHook');
      await tryAllocateCapitalFromInrVoucher(client, branchId, inrVoucherId);
    }
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
  await voidInrVoucherByReference(client, branchId, 'metal_sale_profit', saleId);
  await voidInrVoucherByReference(client, branchId, 'metal_sale_receipt', saleId);
  await voidInrVoucherByReference(client, branchId, 'metal_sale_cogs', saleId);
  await voidInrVoucherByReference(client, branchId, 'lab_test_sale', saleId);
}
