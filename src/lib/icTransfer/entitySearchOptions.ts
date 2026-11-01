import { fmtICAmount } from '@/lib/icFunds/format';
import { computeWarehouseAvailableUnits } from '@/lib/icTransfer/warehouseMatrixMetrics';
import type { ComboOption } from '@/components/ui/ComboSearchInput';
import { formatEntitySelectLabel } from '@/lib/validations/entityCode';
import type { ICSale, ICSupplier, ICWarehouse } from '@/types';

export type EntitySearchOption = {
  value: string;
  /** Display name (without code prefix). */
  label: string;
  code?: string;
  detail?: string;
};

function formatLabeledBalance(amount: number): string {
  return `Balance: ${fmtICAmount(amount)} AED`;
}

function formatLabeledAvailableUnits(units: number, metalG?: number): string {
  const unitsLabel = `Stock: ${fmtICAmount(units)} units`;
  if (metalG == null || metalG === 0) return unitsLabel;
  return `${unitsLabel} · ${fmtICAmount(metalG)} g metal`;
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

export function buildSupplierSearchOptions(
  suppliers: ICSupplier[],
  balanceBySupplierId?: Record<string, number>,
): EntitySearchOption[] {
  return suppliers.map(s => {
    const balance = balanceBySupplierId?.[s.id] ?? 0;
    return {
      value: s.id,
      label: s.name,
      code: s.code,
      detail: formatLabeledBalance(balance),
    };
  });
}

export function buildWarehouseSearchOptions(
  warehouses: ICWarehouse[],
  sales: ICSale[],
  availableById?: Record<string, number>,
  metalGById?: Record<string, number>,
): EntitySearchOption[] {
  return warehouses.map(w => {
    const available =
      availableById && availableById[w.id] !== undefined
        ? availableById[w.id]!
        : computeWarehouseAvailableUnits(w, sales);
    const metalG = metalGById?.[w.id] ?? w.currentMetalG ?? 0;
    return {
      value: w.id,
      label: w.name,
      code: w.code,
      detail: formatLabeledAvailableUnits(available, metalG),
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
  balanceByCustomerId?: Record<string, number>,
): EntitySearchOption[] {
  return customers.map(c => {
    const balance =
      balanceByCustomerId?.[c.id] ?? (c.balance !== undefined && c.balance !== null ? Number(c.balance) : 0);
    return {
      value: c.id,
      label: c.name,
      code: c.code,
      detail: formatLabeledBalance(balance),
    };
  });
}

/** Map HQ IC fund accounts to counterparty / legacy source ids. */
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
    if (a.sourceType === 'ic_counterparty' && a.sourceId) {
      counterparties[a.sourceId] = a.balance;
    }
    if (a.sourceType === 'ic_supplier' && a.sourceId) {
      suppliers[a.sourceId] = a.balance;
    }
    const customerKey = a.customerId || (a.sourceType === 'ic_customer' ? a.sourceId : undefined);
    if (customerKey) {
      customers[customerKey] = a.balance;
    }
  }
  return { counterparties, suppliers, customers };
}

export function buildCounterpartySearchOptions(
  counterparties: ICSupplier[],
  balanceByCounterpartyId?: Record<string, number>,
): EntitySearchOption[] {
  return buildSupplierSearchOptions(counterparties, balanceByCounterpartyId);
}
