import { ASIAN_LOCATION_TREE } from '@/lib/geo/asianLocationTree.generated';

const INDIA_TREE = ASIAN_LOCATION_TREE.India ?? {};

export type IndiaLocationPick = {
  value: string;
  label: string;
  state: string;
  city: string;
};

export function formatIndiaLocationDisplay(state: string, city: string): string {
  return [city, state].filter(Boolean).join(', ');
}

function scoreMatch(text: string, q: string): number {
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 50;
  return 0;
}

export function searchIndiaLocations(query: string, limit = 25): IndiaLocationPick[] {
  const q = query.trim().toLowerCase();
  const states = Object.keys(INDIA_TREE).sort((a, b) => a.localeCompare(b));

  if (!q) {
    return states.map(s => ({ value: s, label: s, state: s, city: '' }));
  }

  const scored: { pick: IndiaLocationPick; score: number }[] = [];

  for (const state of states) {
    const stateScore = scoreMatch(state, q);
    if (stateScore > 0) {
      scored.push({ pick: { value: state, label: state, state, city: '' }, score: stateScore + 5 });
    }
    for (const city of INDIA_TREE[state] ?? []) {
      const label = `${city}, ${state}`;
      const cityScore = Math.max(scoreMatch(city, q), scoreMatch(label, q));
      if (cityScore > 0) {
        scored.push({
          pick: { value: `${city}|${state}`, label, state, city },
          score: cityScore,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score || a.pick.label.localeCompare(b.pick.label));

  const seen = new Set<string>();
  const out: IndiaLocationPick[] = [];
  for (const { pick } of scored) {
    if (seen.has(pick.value)) continue;
    seen.add(pick.value);
    out.push(pick);
    if (out.length >= limit) break;
  }
  return out;
}

export function resolveIndiaLocationPick(value: string, label: string): IndiaLocationPick {
  if (!value.includes('|')) {
    return { value, label: label || value, state: value, city: '' };
  }
  const [city, state] = value.split('|');
  return { value, label, state, city };
}

export function isIndiaLocationSelectionValid(state: string, city: string): boolean {
  const s = state.trim();
  if (!s || !INDIA_TREE[s]) {
    const match = Object.keys(INDIA_TREE).find(k => k.toLowerCase() === s.toLowerCase());
    if (!match) return false;
  }
  const stateKey = Object.keys(INDIA_TREE).find(k => k.toLowerCase() === s.toLowerCase()) ?? s;
  if (city.trim()) {
    const cities = INDIA_TREE[stateKey] ?? [];
    return cities.some(c => c.toLowerCase() === city.trim().toLowerCase());
  }
  return true;
}
