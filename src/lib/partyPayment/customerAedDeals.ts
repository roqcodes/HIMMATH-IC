import { bookedMetalAed } from '@/lib/icTransfer/metalSplit';
import { metalPaymentShortLabel } from '@/lib/icTransfer/metalSplit';
import { normalizeMetalPaymentMethod, needsMetalAedAgent } from '@/lib/domain/books';

export type CustomerAedDealKind = 'purchase' | 'sale';

export type CustomerAedDealLine = {
  id: string;
  kind: CustomerAedDealKind;
  warehouseId: string;
  warehouseName: string;
  dealDate: string;
  paymentMethod: string;
  paymentLabel: string;
  aedAmount: number;
  aedAgentId: string | null;
  aedAgentName: string | null;
  managerId: string | null;
  metalWeightG: number | null;
  shortRef: string;
};

export type CustomerAedDealsByWarehouse = {
  warehouseId: string;
  warehouseName: string;
  purchases: CustomerAedDealLine[];
  sales: CustomerAedDealLine[];
};

export function groupCustomerAedDealsByWarehouse(lines: CustomerAedDealLine[]): CustomerAedDealsByWarehouse[] {
  const map = new Map<string, CustomerAedDealsByWarehouse>();
  for (const line of lines) {
    let bucket = map.get(line.warehouseId);
    if (!bucket) {
      bucket = {
        warehouseId: line.warehouseId,
        warehouseName: line.warehouseName,
        purchases: [],
        sales: [],
      };
      map.set(line.warehouseId, bucket);
    }
    if (line.kind === 'purchase') bucket.purchases.push(line);
    else bucket.sales.push(line);
  }
  const list = [...map.values()];
  list.sort((a, b) => a.warehouseName.localeCompare(b.warehouseName, undefined, { sensitivity: 'base' }));
  for (const w of list) {
    const byDate = (x: CustomerAedDealLine, y: CustomerAedDealLine) =>
      y.dealDate.localeCompare(x.dealDate);
    w.purchases.sort(byDate);
    w.sales.sort(byDate);
  }
  return list;
}

type DealRow = {
  id: string;
  deal_kind: 'purchase' | 'sale';
  warehouse_id: string;
  warehouse_name: string;
  created_at: string;
  metal_payment_method: string | null;
  aed_total: string | number | null;
  split_aed_paid: string | number | null;
  aed_agent_id: string | null;
  aed_agent_name: string | null;
  manager_id: string | null;
  metal_weight_g: string | number | null;
};

export function mapCustomerAedDealRow(row: DealRow): CustomerAedDealLine | null {
  const pay = normalizeMetalPaymentMethod(row.metal_payment_method);
  if (!needsMetalAedAgent(pay)) return null;
  const aedAmount = bookedMetalAed({
    paymentMethod: pay,
    aedTotal: Number(row.aed_total) || 0,
    splitAedPaid: row.split_aed_paid != null ? Number(row.split_aed_paid) : null,
  });
  if (aedAmount <= 0) return null;

  const id = String(row.id);
  return {
    id,
    kind: row.deal_kind,
    warehouseId: String(row.warehouse_id),
    warehouseName: String(row.warehouse_name || 'Warehouse'),
    dealDate: row.created_at ? new Date(row.created_at).toISOString() : '',
    paymentMethod: pay,
    paymentLabel: metalPaymentShortLabel(pay),
    aedAmount,
    aedAgentId: row.aed_agent_id ? String(row.aed_agent_id) : null,
    aedAgentName: row.aed_agent_name ? String(row.aed_agent_name).trim() : null,
    managerId: row.manager_id ? String(row.manager_id) : null,
    metalWeightG: row.metal_weight_g != null ? Number(row.metal_weight_g) : null,
    shortRef: `${row.deal_kind === 'purchase' ? 'P' : 'S'}-${id.slice(0, 8)}`,
  };
}

export function settlementNoteForDeal(line: CustomerAedDealLine): string {
  return `AED settlement · ${line.kind} ${line.shortRef} · ${line.warehouseName}`;
}