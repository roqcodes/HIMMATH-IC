import { ASIAN_LOCATION_TREE } from '@/lib/geo/asianLocationTree.generated';

export const ASIAN_COUNTRY_NAMES: readonly string[] = Object.keys(ASIAN_LOCATION_TREE).sort((a, b) =>
  a.localeCompare(b),
);

function treeForCountry(country: string) {
  return ASIAN_LOCATION_TREE[country.trim()];
}

export function getAsianCountryComboOptions(): ReadonlyArray<{ value: string; label: string }> {
  return ASIAN_COUNTRY_NAMES.map(c => ({ value: c, label: c }));
}

/** Province / state / region (first administrative level). */
export function getAsianProvinceComboOptions(
  country: string,
): ReadonlyArray<{ value: string; label: string }> {
  const node = treeForCountry(country);
  if (!node) return [];
  return Object.keys(node)
    .sort((a, b) => a.localeCompare(b))
    .map(p => ({ value: p, label: p }));
}

/** City / governorate / district within a province. */
export function getAsianLocalityComboOptions(
  country: string,
  province: string,
): ReadonlyArray<{ value: string; label: string }> {
  const node = treeForCountry(country);
  const list = node?.[province.trim()] ?? [];
  return list.map(c => ({ value: c, label: c }));
}

export function isAsianCountryName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return ASIAN_COUNTRY_NAMES.some(c => c.toLowerCase() === trimmed.toLowerCase());
}

export function isKnownAsianProvince(country: string, province: string): boolean {
  const trimmed = province.trim();
  if (!trimmed || !isAsianCountryName(country)) return false;
  const node = treeForCountry(country);
  if (!node) return false;
  return Object.keys(node).some(p => p.toLowerCase() === trimmed.toLowerCase());
}

export function isKnownAsianLocality(country: string, province: string, locality: string): boolean {
  const trimmed = locality.trim();
  if (!trimmed || !isKnownAsianProvince(country, province)) return false;
  const node = treeForCountry(country);
  const list = node?.[province.trim()] ?? [];
  return list.some(c => c.toLowerCase() === trimmed.toLowerCase());
}

/** @deprecated Use province + locality helpers. */
export function getAsianSubdivisionComboOptions(country: string) {
  return getAsianProvinceComboOptions(country);
}

/** @deprecated Validates province only. */
export function isKnownAsianSubdivision(country: string, subdivision: string): boolean {
  return isKnownAsianProvince(country, subdivision);
}
