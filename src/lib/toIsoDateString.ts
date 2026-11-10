/** Normalise DB/driver values to `YYYY-MM-DD` for Postgres `date` parameters. */
export function toIsoDateString(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/** Normalise DB/driver values to ISO-8601 UTC for `timestamptz` parameters. */
export function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const raw = String(value ?? '').trim();
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return new Date().toISOString();
}
