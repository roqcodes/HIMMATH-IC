import 'server-only';

import { query } from '@/lib/db';
import { CUSTOMER_STATEMENT_INTERNAL_REFS } from '@/lib/icFunds/customerStatementView';
import type { ICFundStatementLine } from '@/types';

function isInternalLine(referenceType?: string): boolean {
  return Boolean(referenceType && CUSTOMER_STATEMENT_INTERNAL_REFS.has(referenceType));
}

function normalizeFxRate(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function uuidList(ids: Iterable<string>): string[] {
  return [...ids].filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}

/** Weighted foreign-per-AED from this customer's completed FX sales. Never invent 1:1. */
export async function resolveCustomerDefaultFxRate(customerId: string): Promise<number> {
  const res = await query(
    `SELECT SUM(converted_amount) / NULLIF(SUM(converted_amount / conversion_rate), 0) AS weighted_rate
     FROM ic_sales
     WHERE order_customer_id = $1
       AND conversion_rate IS NOT NULL
       AND conversion_rate > 0
       AND COALESCE(converted_amount, 0) > 0`,
    [customerId],
  );
  return normalizeFxRate(res.rows[0]?.weighted_rate) ?? 0;
}

export async function enrichStatementFxRates(
  lines: ICFundStatementLine[],
  customerId: string,
): Promise<{ lines: ICFundStatementLine[]; defaultFxRate: number }> {
  const defaultFxRate = await resolveCustomerDefaultFxRate(customerId);

  const saleIds = new Set<string>();
  const settlementIds = new Set<string>();
  const batchIds = new Set<string>();

  for (const line of lines) {
    if (!line.referenceType || !line.referenceId) continue;
    if (line.referenceType === 'ic_sale') saleIds.add(line.referenceId);
    if (
      line.referenceType === 'ic_sale_fx_receipt' ||
      line.referenceType === 'ic_sale_fx_profit'
    ) {
      settlementIds.add(line.referenceId);
    }
    if (line.referenceType === 'ic_sale_fx_batch_payment') {
      batchIds.add(line.referenceId);
    }
  }

  const saleRateById = new Map<string, number>();
  const saleForeignById = new Map<string, number>();
  const saleUuids = uuidList(saleIds);
  if (saleUuids.length > 0) {
    const res = await query(
      `SELECT id, conversion_rate, converted_amount
       FROM ic_sales
       WHERE id = ANY($1::uuid[])`,
      [saleUuids],
    );
    for (const row of res.rows) {
      const id = String(row.id);
      const rate = normalizeFxRate(row.conversion_rate);
      if (rate) saleRateById.set(id, rate);
      const foreign = Number(row.converted_amount);
      if (Number.isFinite(foreign) && foreign > 0) saleForeignById.set(id, foreign);
    }
  }

  const settlementRateById = new Map<string, number>();
  const settlementSaleRateById = new Map<string, number>();
  const settlementPaidForeignById = new Map<string, number>();
  const settlementUuids = uuidList(settlementIds);
  if (settlementUuids.length > 0) {
    const res = await query(
      `SELECT id, sale_id, settlement_rate, sale_conversion_rate, paid_foreign
       FROM ic_sale_fx_settlements
       WHERE id = ANY($1::uuid[])`,
      [settlementUuids],
    );
    for (const row of res.rows) {
      const id = String(row.id);
      const settle = normalizeFxRate(row.settlement_rate);
      if (settle) settlementRateById.set(id, settle);
      const saleRate = normalizeFxRate(row.sale_conversion_rate);
      if (saleRate) settlementSaleRateById.set(id, saleRate);
      const paidForeign = Number(row.paid_foreign);
      if (Number.isFinite(paidForeign) && paidForeign > 0) {
        settlementPaidForeignById.set(id, paidForeign);
      }
    }
  }

  const batchRateById = new Map<string, number>();
  const batchUuids = uuidList(batchIds);
  if (batchUuids.length > 0) {
    const res = await query(
      `SELECT batch_id,
              SUM(paid_foreign) / NULLIF(SUM(settled_aed), 0) AS effective_rate
       FROM ic_sale_fx_settlements
       WHERE batch_id = ANY($1::uuid[])
       GROUP BY batch_id`,
      [batchUuids],
    );
    for (const row of res.rows) {
      const rate = normalizeFxRate(row.effective_rate);
      if (rate && row.batch_id) batchRateById.set(String(row.batch_id), rate);
    }
  }

  const enriched = lines.map(line => {
    const internalOnly = isInternalLine(line.referenceType);
    let fxRate: number | null = null;
    let foreignDebit: number | null = null;
    let foreignCredit: number | null = null;

    if (line.referenceType === 'ic_sale' && line.referenceId) {
      fxRate = saleRateById.get(line.referenceId) ?? null;
      if (line.debit > 0 && saleForeignById.has(line.referenceId)) {
        foreignDebit = saleForeignById.get(line.referenceId) ?? null;
      }
    } else if (line.referenceType === 'ic_sale_fx_receipt' && line.referenceId) {
      fxRate = settlementRateById.get(line.referenceId) ?? null;
      if (line.credit > 0 && settlementPaidForeignById.has(line.referenceId)) {
        foreignCredit = settlementPaidForeignById.get(line.referenceId) ?? null;
      }
    } else if (line.referenceType === 'ic_sale_fx_profit' && line.referenceId) {
      fxRate = settlementSaleRateById.get(line.referenceId) ?? settlementRateById.get(line.referenceId) ?? null;
    } else if (
      line.referenceType === 'ic_sale_fx_batch_payment' &&
      line.referenceId &&
      batchRateById.has(line.referenceId)
    ) {
      fxRate = batchRateById.get(line.referenceId) ?? null;
    }

    if (fxRate == null && defaultFxRate > 0) fxRate = defaultFxRate;

    return {
      ...line,
      fxRate,
      foreignDebit,
      foreignCredit,
      internalOnly,
    };
  });

  return { lines: enriched, defaultFxRate };
}
