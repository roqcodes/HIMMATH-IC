import { useCallback, type DependencyList } from 'react';
import { trackLoading } from '@/lib/loadingBar';

/** Like useCallback, but shows the global top loading bar while the promise runs. */
export function useTrackedCallback<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  deps: DependencyList,
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: Parameters<T>) => trackLoading(() => fn(...args))) as T, deps);
}
