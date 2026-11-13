import { parseCalendarDate } from '@/lib/businessTime';
import { toIsoDateString, toIsoTimestamp } from '@/lib/toIsoDateString';
import type { ICBranchDeposit } from '@/types';

export function mapBranchDepositRow(row: Record<string, unknown>): ICBranchDeposit {
  return {
    id: String(row.id),
    branchId: String(row.branch_id),
    icBranchId: row.ic_branch_id ? String(row.ic_branch_id) : null,
    warehouseId: row.warehouse_id ? String(row.warehouse_id) : null,
    managerId: String(row.manager_id),
    customerId: String(row.customer_id),
    managerName: row.manager_name ? String(row.manager_name) : undefined,
    customerName: row.customer_name ? String(row.customer_name) : undefined,
    settlementMode: String(row.settlement_mode) === 'metal' ? 'metal' : 'cash',
    amountAed: Number(row.amount_aed) || 0,
    metalWeightG: row.metal_weight_g != null ? Number(row.metal_weight_g) : null,
    metalRateAedPerG: row.metal_rate_aed_per_g != null ? Number(row.metal_rate_aed_per_g) : null,
    depositDate: parseCalendarDate(row.deposit_date) || toIsoDateString(row.deposit_date),
    notes: row.notes ? String(row.notes) : null,
    enteredByName: row.entered_by_name ? String(row.entered_by_name) : null,
    createdAt: row.created_at ? toIsoTimestamp(row.created_at) : '',
  };
}
