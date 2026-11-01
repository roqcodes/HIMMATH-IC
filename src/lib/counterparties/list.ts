import type { ICSupplier } from '@/types';

export type CounterpartyListRow = {
  key: string;
  id: string;
  name: string;
  code?: string;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  subdivision?: string | null;
  locality?: string | null;
  status?: string;
  hasOrders?: boolean;
  supplier?: ICSupplier;
};

export function counterpartiesFromRegistry(suppliers: ICSupplier[]): CounterpartyListRow[] {
  return suppliers
    .map(s => ({
      key: `cp:${s.id}`,
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
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
