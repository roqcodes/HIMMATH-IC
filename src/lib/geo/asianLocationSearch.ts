import { ASIAN_LOCATION_TREE } from '@/lib/geo/asianLocationTree.generated';
import { ASIAN_COUNTRY_NAMES } from '@/lib/geo/asianLocations';

export type LocationPick = {
  value: string;
  label: string;
  country: string;
  province: string;
  locality: string;
};

export function formatLocationDisplay(country: string, province: string, locality: string): string {
  return [locality, province, country].filter(Boolean).join(', ');
}

function pick(value: string, label: string, country: string, province: string, locality: string): LocationPick {
  return { value, label, country, province, locality };
}

function scoreMatch(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 50;
  return 0;
}

/** Search countries, provinces, and cities with readable labels (e.g. Kochi · Kerala · India). */
export function searchAsianLocations(query: string, limit = 25): LocationPick[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return ASIAN_COUNTRY_NAMES.map(c => pick(c, c, c, '', ''));
  }

  const scored: { pick: LocationPick; score: number }[] = [];

  for (const country of ASIAN_COUNTRY_NAMES) {
    const provinces = ASIAN_LOCATION_TREE[country];
    if (!provinces) continue;

    const countryScore = scoreMatch(country, q);
    if (countryScore > 0) {
      scored.push({ pick: pick(country, country, country, '', ''), score: countryScore + 10 });
    }

    for (const province of Object.keys(provinces)) {
      const provinceLabel = `${province}, ${country}`;
      const provinceScore = Math.max(scoreMatch(province, q), scoreMatch(provinceLabel, q));
      if (provinceScore > 0) {
        scored.push({
          pick: pick(`${province}|${country}`, provinceLabel, country, province, ''),
          score: provinceScore + 5,
        });
      }

      const cities = provinces[province] ?? [];
      for (const city of cities) {
        const cityLabel = `${city}, ${province}, ${country}`;
        const cityScore = Math.max(scoreMatch(city, q), scoreMatch(cityLabel, q));
        if (cityScore > 0) {
          scored.push({
            pick: pick(`${city}|${province}|${country}`, cityLabel, country, province, city),
            score: cityScore,
          });
        }
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.pick.label.localeCompare(b.pick.label));

  const seen = new Set<string>();
  const out: LocationPick[] = [];
  for (const { pick: p } of scored) {
    if (seen.has(p.value)) continue;
    seen.add(p.value);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export function resolveAsianLocationPick(value: string, label: string): LocationPick {
  if (!value.includes('|')) {
    const country = value.trim();
    return pick(country, label || country, country, '', '');
  }
  const parts = value.split('|');
  if (parts.length === 2) {
    const [province, country] = parts;
    return pick(value, label, country, province, '');
  }
  const [locality, province, country] = parts;
  return pick(value, label, country, province, locality);
}

export function isAsianLocationSelectionValid(country: string, province: string, locality: string): boolean {
  const c = country.trim();
  if (!c || !ASIAN_COUNTRY_NAMES.some(n => n.toLowerCase() === c.toLowerCase())) return false;
  if (province.trim()) {
    const provinces = ASIAN_LOCATION_TREE[c] ?? ASIAN_LOCATION_TREE[ASIAN_COUNTRY_NAMES.find(n => n.toLowerCase() === c.toLowerCase())!];
    if (!provinces || !Object.keys(provinces).some(p => p.toLowerCase() === province.trim().toLowerCase())) {
      return false;
    }
  }
  if (locality.trim() && province.trim()) {
    const provinces = ASIAN_LOCATION_TREE[c];
    const cities = provinces?.[province.trim()] ?? [];
    if (!cities.some(city => city.toLowerCase() === locality.trim().toLowerCase())) return false;
  }
  return true;
}
