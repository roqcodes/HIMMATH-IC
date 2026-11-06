import { fmtICAmount, fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { computeWarehouseAvailableUnits, formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import type { ComboOption } from '@/components/ui/ComboSearchInput';
import { formatEntitySelectLabel } from '@/lib/validations/entityCode';
import type { ICPurchase, ICSale, ICSupplier, ICWarehouse } from '@/types';

export type EntityLedgerBalances = {
  aed: number;
  inr: number;
};

export type EntitySearchOption = {
  value: string;
  /** Display name (without code prefix). */
  label: string;
  code?: string;
  detail?: string;
};

const ZERO_LEDGER: EntityLedgerBalances = { aed: 0, inr: 0 };

export function formatEntityLedgerDetail(balances: EntityLedgerBalances): string {
  return `Balance: ${fmtLedgerAed(balances.aed)} · ${fmtLedgerInr(balances.inr)}`;
}

function formatWarehouseStockDetail(units: number, metalG: number): string {
  return `Stock: ${fmtICAmount(units)} units · ${formatMetalGrams(metalG)}`;
}

function addToBalanceMap(map: Record<string, number>, key: string | undefined, amount: number): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + amount;
}

export function entitySearchOptionsToComboOptions(options: EntitySearchOption[]): ComboOption[] {
  return options.map(o => ({
    value: o.value,
    label: formatEntitySelectLabel(o.label, o.code),
    name: o.label,
    code: o.code,
    detail: o.detail,
  }));
}

function ledgerForEntity(
  entityId: string,
  ledgerByEntityId?: Record<string, EntityLedgerBalances>,
): EntityLedgerBalances {
  return ledgerByEntityId?.[entityId] ?? ZERO_LEDGER;
}

export function buildSupplierSearchOptions(
  suppliers: ICSupplier[],
  ledgerByEntityId?: Record<string, EntityLedgerBalances>,
): EntitySearchOption[] {
  return suppliers.map(s => ({
    value: s.id,
    label: s.name,
    code: s.code,
    detail: formatEntityLedgerDetail(ledgerForEntity(s.id, ledgerByEntityId)),
  }));
}

export function buildWarehouseSearchOptions(
  warehouses: ICWarehouse[],
  sales: ICSale[],
  availableById?: Record<string, number>,
  metalGById?: Record<string, number>,
  purchases?: ICPurchase[],
): EntitySearchOption[] {
  return warehouses.map(w => {
    const units =
      availableById && availableById[w.id] !== undefined
        ? availableById[w.id]!
        : purchases
          ? computeWarehouseAvailableUnits(w, purchases, sales)
          : Number(w.currentStock ?? 0);
    const metalG = metalGById?.[w.id] ?? w.currentMetalG ?? 0;
    return {
      value: w.id,
      label: w.name,
      code: w.code,
      detail: formatWarehouseStockDetail(units, metalG),
    };
  });
}

export function buildCustomerSearchOptions(
  customers: {
    id: string;
    name: string;
    code?: string;
    balance?: string | number | null;
  }[],
  ledgerByEntityId?: Record<string, EntityLedgerBalances>,
  /** @deprecated use ledgerByEntityId — legacy AED-only map */
  balanceByCustomerId?: Record<string, number>,
): EntitySearchOption[] {
  return customers.map(c => {
    const fromLedger = ledgerByEntityId?.[c.id];
    const balances: EntityLedgerBalances = fromLedger
      ? fromLedger
      : {
          aed:
            balanceByCustomerId?.[c.id] ??
            (c.balance !== undefined && c.balance !== null ? Number(c.balance) : 0),
          inr: 0,
        };
    return {
      value: c.id,
      label: c.name,
      code: c.code,
      detail: formatEntityLedgerDetail(balances),
    };
  });
}

/** Map HQ IC fund accounts to counterparty / legacy source ids (AED book). */
export function indexICFundBalancesBySource(
  accounts: { sourceType?: string; sourceId?: string; customerId?: string; balance: number }[],
): {
  counterparties: Record<string, number>;
  suppliers: Record<string, number>;
  customers: Record<string, number>;
} {
  const counterparties: Record<string, number> = {};
  const suppliers: Record<string, number> = {};
  const customers: Record<string, number> = {};
  for (const a of accounts) {
    const amount = Number(a.balance) || 0;
    if (a.sourceType === 'ic_counterparty' && a.sourceId) {
      addToBalanceMap(counterparties, a.sourceId, amount);
    }
    if (a.sourceType === 'ic_supplier' && a.sourceId) {
      addToBalanceMap(suppliers, a.sourceId, amount);
    }
    const customerKey = a.customerId || (a.sourceType === 'ic_customer' ? a.sourceId : undefined);
    if (customerKey) {
      addToBalanceMap(customers, customerKey, amount);
    }
  }
  return { counterparties, suppliers, customers };
}

/** Merge AED maps from HQ accounts with INR balances keyed by entity id. */
export function buildEntityLedgerMap(
  aedIndexed: ReturnType<typeof indexICFundBalancesBySource>,
  inrByEntityId: Record<string, number> = {},
): Record<string, EntityLedgerBalances> {
  const aedById: Record<string, number> = {};
  for (const [id, bal] of Object.entries(aedIndexed.suppliers)) {
    addToBalanceMap(aedById, id, bal);
  }
  for (const [id, bal] of Object.entries(aedIndexed.customers)) {
    addToBalanceMap(aedById, id, bal);
  }
  for (const [id, bal] of Object.entries(aedIndexed.counterparties)) {
    addToBalanceMap(aedById, id, bal);
  }

  const keys = new Set([...Object.keys(aedById), ...Object.keys(inrByEntityId)]);
  const out: Record<string, EntityLedgerBalances> = {};
  for (const id of keys) {
    out[id] = { aed: aedById[id] ?? 0, inr: inrByEntityId[id] ?? 0 };
  }
  return out;
}

export function buildCounterpartySearchOptions(
  counterparties: ICSupplier[],
  ledgerByEntityId?: Record<string, EntityLedgerBalances>,
  /** @deprecated use ledgerByEntityId */
  balanceByCounterpartyId?: Record<string, number>,
): EntitySearchOption[] {
  if (ledgerByEntityId) {
    return buildSupplierSearchOptions(counterparties, ledgerByEntityId);
  }
  const legacy: Record<string, EntityLedgerBalances> = {};
  if (balanceByCounterpartyId) {
    for (const [id, aed] of Object.entries(balanceByCounterpartyId)) {
      legacy[id] = { aed, inr: 0 };
    }
  }
  return buildSupplierSearchOptions(counterparties, legacy);
}
