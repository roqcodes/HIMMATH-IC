# Geographic seed data

Preseeded location pickers use **bundled TypeScript** (no runtime API calls in production).

## Primary source

[dr5hn/countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database) — Open Database License **1.0** (ODbL). Attribution required if you redistribute the dataset.

Regenerate the tree after updating the CSV:

1. Download `csv-cities.csv.gz` from the [latest release](https://github.com/dr5hn/countries-states-cities-database/releases).
2. Gunzip to `csv-cities.csv` in the repo root.
3. Run `node scripts/build-asian-location-tree.mjs`.

Output: `asianLocationTree.generated.ts` (Asian countries → province/state → cities).

## Manual overrides

GCC governorates and common India trade cities (e.g. Kozhikode/Calicut, Al Kharj, Al Dawadmi) are merged in `scripts/build-asian-location-tree.mjs` when missing from the export.

## Other public references (not bundled)

| Resource | Use |
|----------|-----|
| [ISO 3166-2 API](https://iso3166-2-api.vercel.app/api) | Province/region names (no city layer) |
| [api.countrystatecity.in](https://countrystatecity.in/) | Paid/free API; same CSC data |
| [geo-data-api](https://github.com/asterodigital/geo-data-api) | Static JSON CDN built from CSC |

Indian warehouse cities also live in `indiaLocations.ts` (aligned with generated India states where possible).
