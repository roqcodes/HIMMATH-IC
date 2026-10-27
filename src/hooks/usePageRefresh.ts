import { useEffect, useRef } from 'react';
import { useApp } from '@/context/AppContext';

/** Register the current page's data reload with the header refresh button. */
export function usePageRefresh(refetch: () => void | Promise<void>) {
  const { registerPageRefresh } = useApp();
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    return registerPageRefresh(() => refetchRef.current());
  }, [registerPageRefresh]);
}
