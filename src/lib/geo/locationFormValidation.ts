import { isAsianCountryName, isKnownAsianLocality, isKnownAsianProvince } from '@/lib/geo/asianLocations';
import { isKnownIndianCity, isKnownIndianState } from '@/lib/geo/indiaLocations';

/** Supplier/customer: country required; province & city optional if valid when set. */
export function isAsianLocationFormValid(
  country: string,
  province: string,
  locality: string,
  options: { requireCountry: boolean },
): boolean {
  const c = country.trim();
  const p = province.trim();
  const l = locality.trim();

  if (options.requireCountry && !c) return false;
  if (c && !isAsianCountryName(c)) return false;
  if (p && (!c || !isKnownAsianProvince(c, p))) return false;
  if (l && (!p || !isKnownAsianLocality(c, p, l))) return false;
  return true;
}

/** Warehouse: Indian state required (city optional). */
export function isIndiaWarehouseLocationValid(state: string, city: string): boolean {
  const s = state.trim();
  if (!s || !isKnownIndianState(s)) return false;
  const c = city.trim();
  if (c && !isKnownIndianCity(s, c)) return false;
  return true;
}
