/** Asian-only country list for supplier/customer location pickers. */

export {
  ASIAN_COUNTRY_NAMES,
  getAsianCountryComboOptions,
  getAsianProvinceComboOptions,
  getAsianLocalityComboOptions,
  isAsianCountryName,
  isKnownAsianProvince,
  isKnownAsianLocality,
  getAsianSubdivisionComboOptions,
  isKnownAsianSubdivision,
} from '@/lib/geo/asianLocations';

import {
  getAsianCountryComboOptions,
  isAsianCountryName,
} from '@/lib/geo/asianLocations';

export function getCountryComboOptions() {
  return getAsianCountryComboOptions();
}

export function isKnownCountryName(name: string): boolean {
  return isAsianCountryName(name);
}
