'use client';

import { useDateFilterState } from '@/hooks/useDateFilterState';

/** Date filter state for IC Transfer list pages — shared via session until tab closes. */
export function useICTransferFilters() {
  return useDateFilterState();
}
