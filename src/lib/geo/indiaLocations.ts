import { ASIAN_LOCATION_TREE } from '@/lib/geo/asianLocationTree.generated';

const INDIA_TREE = ASIAN_LOCATION_TREE.India ?? {};

export const INDIAN_STATES: readonly string[] = Object.keys(INDIA_TREE).sort((a, b) =>
  a.localeCompare(b),
);

export function getIndianStateComboOptions(): ReadonlyArray<{ value: string; label: string }> {
  return INDIAN_STATES.map(s => ({ value: s, label: s }));
}

export function getIndianCityComboOptions(
  state: string,
): ReadonlyArray<{ value: string; label: string }> {
  const cities = INDIA_TREE[state.trim()] ?? [];
  return cities.map(c => ({ value: c, label: c }));
}

export function isKnownIndianState(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return INDIAN_STATES.some(s => s.toLowerCase() === trimmed.toLowerCase());
}

export function isKnownIndianCity(state: string, city: string): boolean {
  const trimmedCity = city.trim();
  if (!trimmedCity) return false;
  const cities = INDIA_TREE[state.trim()] ?? [];
  return cities.some(c => c.toLowerCase() === trimmedCity.toLowerCase());
}

/** @deprecated India provinces for Asian picker — same as INDIAN_STATES. */
export function getIndiaSubdivisions(): readonly string[] {
  return INDIAN_STATES;
}
