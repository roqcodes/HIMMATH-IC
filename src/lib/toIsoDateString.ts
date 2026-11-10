import {
  parseCalendarDate,
  resolveBranchTimeZone,
  todayInTimeZone,
  toBusinessDate,
} from '@/lib/businessTime';

/**
 * Normalise PG `date`, text, or node-pg DATE `Date` to `YYYY-MM-DD`.
 * Never use UTC calendar parts — node-pg DATE is local midnight.
 */
export function toIsoDateString(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return parseCalendarDate(value);
  }
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return parseCalendarDate(new Date(parsed));
  }
  return raw.slice(0, 10);
}

/** Business voucher date for a purchase/sale/payment instant (`timestamptz`). */
export function ledgerVoucherDateFromInstant(
  value: unknown,
  timeZone?: string | null,
): string {
  const tz = resolveBranchTimeZone(timeZone);
  if (value == null || value === '') return todayInTimeZone(tz);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return todayInTimeZone(tz);
  return toBusinessDate(d, tz);
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
