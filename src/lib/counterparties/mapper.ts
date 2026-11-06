import type { ICSupplier } from '@/types';
import { normalizeCounterpartyRoles, type CounterpartyRole } from '@/lib/counterparties/roles';

/** Unified trading partner (payable on purchase, receivable on sale). */
export type ICCounterparty = ICSupplier & {
  status?: 'active' | 'inactive';
  roles?: CounterpartyRole[];
};

export const COUNTERPARTY_SELECT =
  `id, name, code, phone, commission, region_id, email, address, country, subdivision, locality,
   branch_id, status, roles, created_at`;

export function mapICCounterpartyRow(row: Record<string, unknown>): ICCounterparty {
  return {
    id: String(row.id),
    name: String(row.name),
    code: row.code ? String(row.code) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    commission: row.commission != null ? parseFloat(String(row.commission)) : undefined,
    regionId: row.region_id ? String(row.region_id) : undefined,
    email: row.email ? String(row.email) : undefined,
    address: row.address ? String(row.address) : undefined,
    country: row.country ? String(row.country) : undefined,
    subdivision: row.subdivision ? String(row.subdivision) : undefined,
    locality: row.locality ? String(row.locality) : undefined,
    branchId: row.branch_id ? String(row.branch_id) : undefined,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    roles: normalizeCounterpartyRoles(row.roles),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}
