import type { ICSupplier } from '@/types';

/** Unified trading partner (payable on purchase, receivable on sale). */
export type ICCounterparty = ICSupplier & {
  status?: 'active' | 'inactive';
  legacyCustomerId?: string | null;
  legacySupplierId?: string | null;
};

export const COUNTERPARTY_SELECT =
  `id, name, code, phone, commission, region_id, email, address, country, subdivision, locality,
   branch_id, status, legacy_customer_id, legacy_supplier_id, created_at`;

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
    legacyCustomerId: row.legacy_customer_id ? String(row.legacy_customer_id) : null,
    legacySupplierId: row.legacy_supplier_id ? String(row.legacy_supplier_id) : null,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}
