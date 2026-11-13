import type { ICSupplier } from '@/types';

export const COUNTERPARTY_KINDS = ['manager', 'customer'] as const;
export type CounterpartyKind = (typeof COUNTERPARTY_KINDS)[number];

export const COUNTERPARTY_ROLES = ['supplier', 'party', 'agent'] as const;
export type CounterpartyRole = (typeof COUNTERPARTY_ROLES)[number];

export const DEFAULT_COUNTERPARTY_ROLES: CounterpartyRole[] = ['supplier', 'party'];

export function normalizeCounterpartyRoles(
  value: unknown,
): CounterpartyRole[] {
  if (!Array.isArray(value)) return [...DEFAULT_COUNTERPARTY_ROLES];
  const set = new Set<CounterpartyRole>();
  for (const item of value) {
    const s = String(item);
    if (s === 'supplier' || s === 'party' || s === 'agent') set.add(s);
  }
  if (set.size === 0) return [...DEFAULT_COUNTERPARTY_ROLES];
  return COUNTERPARTY_ROLES.filter(r => set.has(r));
}

export function counterpartyHasRole(
  cp: { roles?: CounterpartyRole[] | null; status?: string | null },
  role: CounterpartyRole,
): boolean {
  if (cp.status === 'inactive') return false;
  const roles = normalizeCounterpartyRoles(cp.roles);
  return roles.includes(role);
}

export function filterCounterpartiesByRole<T extends { roles?: CounterpartyRole[] | null; status?: string | null }>(
  list: T[],
  role: CounterpartyRole,
): T[] {
  return list.filter(cp => counterpartyHasRole(cp, role));
}

export function formatCounterpartyRolesLabel(roles: CounterpartyRole[] | null | undefined): string {
  const normalized = normalizeCounterpartyRoles(roles);
  return normalized
    .map(r => (r === 'party' ? 'Party' : r === 'supplier' ? 'Supplier' : 'Agent'))
    .join(' · ');
}

export function normalizeCounterpartyKind(value: unknown): CounterpartyKind {
  return String(value) === 'manager' ? 'manager' : 'customer';
}

export function rolesForCounterpartyKind(
  kind: CounterpartyKind,
  roles: CounterpartyRole[] | undefined,
): CounterpartyRole[] {
  if (kind === 'manager') return [];
  return normalizeCounterpartyRoles(roles);
}

export function counterpartyIsManager(cp: Pick<ICSupplier, 'kind'>): boolean {
  return normalizeCounterpartyKind(cp.kind) === 'manager';
}

export function counterpartyIsCustomer(cp: Pick<ICSupplier, 'kind'>): boolean {
  return normalizeCounterpartyKind(cp.kind) === 'customer';
}

export function filterCounterpartiesByKind<T extends Pick<ICSupplier, 'kind' | 'status'>>(
  list: T[],
  kind: CounterpartyKind,
): T[] {
  return list.filter(cp => cp.status !== 'inactive' && normalizeCounterpartyKind(cp.kind) === kind);
}

export function filterCustomersUnderManager<T extends Pick<ICSupplier, 'kind' | 'status' | 'homeManagerId'>>(
  list: T[],
  managerId: string,
): T[] {
  if (!managerId) return [];
  return filterCounterpartiesByKind(list, 'customer').filter(cp => cp.homeManagerId === managerId);
}

export function formatCounterpartyKindLabel(kind: CounterpartyKind | null | undefined): string {
  return normalizeCounterpartyKind(kind) === 'manager' ? 'Manager' : 'Customer';
}
