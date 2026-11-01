import type { ICSupplier } from '@/types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFullCounterpartyUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/** First 8 hex chars of counterparty UUID — used in URLs. */
export function counterpartyShortSlug(counterpartyId: string): string {
  return counterpartyId.replace(/-/g, '').slice(0, 8).toLowerCase();
}

/** Client-safe lookup from AppContext registry (no DB). */
export function findCounterpartyByRouteParam(
  suppliers: ICSupplier[],
  routeParam: string,
): ICSupplier | undefined {
  if (!routeParam) return undefined;
  if (isFullCounterpartyUuid(routeParam)) {
    return suppliers.find(s => s.id === routeParam);
  }
  const short = routeParam.toLowerCase();
  return suppliers.find(s => counterpartyShortSlug(s.id) === short);
}
