import type { DateFilterId } from '@/lib/dateFilterRange';

export const DATE_FILTER_SESSION_KEY = 'asic-date-filter';

export type DateFilterSessionState = {
  dateFilter: string;
  customStartDate: string;
  customEndDate: string;
};

const VALID_FILTERS = new Set<string>([
  'all-time',
  'today',
  'yesterday',
  'this-week',
  'last-week',
  'this-month',
  'last-month',
  'last-3-months',
  'this-year',
  'custom',
]);

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function readDateFilterSession(): DateFilterSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DATE_FILTER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DateFilterSessionState>;
    if (!parsed || typeof parsed.dateFilter !== 'string' || !VALID_FILTERS.has(parsed.dateFilter)) {
      return null;
    }
    return {
      dateFilter: parsed.dateFilter,
      customStartDate: isIsoDate(parsed.customStartDate) ? parsed.customStartDate : '',
      customEndDate: isIsoDate(parsed.customEndDate) ? parsed.customEndDate : '',
    };
  } catch {
    return null;
  }
}

export function writeDateFilterSession(state: DateFilterSessionState) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DATE_FILTER_SESSION_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

export function resolveInitialDateFilterState(
  today: string,
  defaultFilter: DateFilterId | string = 'today',
): DateFilterSessionState {
  const stored = readDateFilterSession();
  if (stored) {
    return {
      dateFilter: stored.dateFilter,
      customStartDate: stored.customStartDate || today,
      customEndDate: stored.customEndDate || today,
    };
  }
  return {
    dateFilter: defaultFilter,
    customStartDate: today,
    customEndDate: today,
  };
}
