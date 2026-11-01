import type { CounterpartyRole } from '@/lib/counterparties/labels';
import type { ICSupplier } from '@/types';

export type CounterpartyListRow = {
  key: string;
  role: CounterpartyRole;
  id: string;
  name: string;
  code?: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  subdivision?: string | null;
  locality?: string | null;
  status?: string;
  balance?: number;
  hasOrders?: boolean;
  supplier?: ICSupplier;
  legacyCustomerId?: string | null;
};

export function customerRowKey(id: string): string {
  return `customer:${id}`;
}

export function supplierRowKey(id: string): string {
  return `supplier:${id}`;
}

export function mergeCounterpartyRows(params: {
  customers: {
    id: string;
    name: string;
    code?: string;
    phone?: string | null;
    email?: string | null;
    country?: string | null;
    subdivision?: string | null;
    locality?: string | null;
    status?: string;
    balance?: string | number | null;
    hasOrders?: boolean;
  }[];
  suppliers: ICSupplier[];
}): CounterpartyListRow[] {
  const customerRows: CounterpartyListRow[] = params.customers.map(c => ({
    key: customerRowKey(c.id),
    role: 'customer',
    id: c.id,
    name: c.name,
    code: c.code,
    phone: c.phone,
    email: c.email,
    country: c.country,
    subdivision: c.subdivision,
    locality: c.locality,
    status: c.status,
    balance: Number(c.balance ?? 0),
    hasOrders: c.hasOrders,
  }));

  const supplierRows: CounterpartyListRow[] = params.suppliers.map(s => ({
    key: supplierRowKey(s.id),
    role: 'supplier',
    id: s.id,
    name: s.name,
    code: s.code,
    phone: s.phone,
    email: s.email,
    country: s.country,
    subdivision: s.subdivision,
    locality: s.locality,
    status: 'active',
    supplier: s,
  }));

  return [...customerRows, ...supplierRows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export function counterpartiesFromRegistry(suppliers: ICSupplier[]): CounterpartyListRow[] {
  return suppliers
    .map(s => {
      const hasCustomer = Boolean(s.legacyCustomerId);
      const hasSupplier = Boolean(s.legacySupplierId) || Boolean(s.commission != null);
      const role: CounterpartyRole =
        hasCustomer && hasSupplier ? 'both' : hasCustomer ? 'customer' : 'supplier';
      return {
        key: `cp:${s.id}`,
        role,
        id: s.id,
        name: s.name,
        code: s.code,
        phone: s.phone,
        email: s.email,
        country: s.country,
        subdivision: s.subdivision,
        locality: s.locality,
        status: s.status ?? 'active',
        supplier: s,
        legacyCustomerId: s.legacyCustomerId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
