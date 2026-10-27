'use client';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { getLoadingBarCount, subscribeLoadingBar } from '@/lib/loadingBar';

export default function GlobalLoadingBar() {
  const manualCount = useSyncExternalStore(subscribeLoadingBar, getLoadingBarCount, () => 0);
  const queryFetching = useIsFetching();
  const queryMutating = useIsMutating();
  const active = manualCount > 0 || queryFetching > 0 || queryMutating > 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px] overflow-hidden"
      role="progressbar"
      aria-hidden={!active}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={active ? 'Loading' : undefined}
    >
      <div
        className={`h-full transition-opacity duration-200 ${active ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="relative h-full w-full bg-red-500/15">
          <div className="absolute inset-y-0 w-2/5 animate-loading-bar bg-red-600 shadow-[0_0_8px_rgb(220_38_38/0.45)]" />
        </div>
      </div>
    </div>
  );
}
