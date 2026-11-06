/** Display street, city, state (any subset). */
export function formatStreetCityState(
  street?: string | null,
  city?: string | null,
  state?: string | null,
): string {
  return [street, city, state].map(s => s?.trim()).filter(Boolean).join(', ') || '—';
}
