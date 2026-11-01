import { counterpartyShortSlug } from '@/lib/counterparties/counterpartySlug';

/** Counterparty directory (admin). */
export function counterpartyListPath(opts?: { branchSlug?: string }): string {
  if (opts?.branchSlug) return `/${opts.branchSlug}/ic-transfer/suppliers`;
  return '/admin/counterparties';
}

export function counterpartyDetailPath(counterpartyId: string, opts?: { branchSlug?: string }): string {
  const slug = counterpartyShortSlug(counterpartyId);
  if (opts?.branchSlug) return `/${opts.branchSlug}/ic-transfer/suppliers/${slug}`;
  return `/admin/counterparties/${slug}`;
}

/** Deep link to counterparty profile (replaces list highlight modal). */
export function counterpartyListHighlightPath(
  counterpartyId: string,
  opts?: { from?: string; branchSlug?: string },
): string {
  const base = counterpartyDetailPath(counterpartyId, { branchSlug: opts?.branchSlug });
  if (opts?.from?.trim()) {
    return `${base}?from=${encodeURIComponent(opts.from.trim())}`;
  }
  return base;
}
