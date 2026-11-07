/**
 * Pauses **silent** `refetchData` (e.g. 60s polling) while long IC forms are open so
 * `icPurchases` / `icSales` are not replaced mid-edit.
 *
 * Use with `useSyncExternalStore` in AppProvider for `useAutoRefreshData.enabled`.
 */
let pauseDepth = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getTransactionalRefetchPauseDepth(): number {
  return pauseDepth;
}

export function subscribeTransactionalRefetchPause(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** Increment pause; call returned function on unmount / modal close. */
export function pauseTransactionalRefetchForModal(): () => void {
  pauseDepth += 1;
  emit();
  return () => {
    pauseDepth = Math.max(0, pauseDepth - 1);
    emit();
  };
}

export function isTransactionalRefetchPaused(): boolean {
  return pauseDepth > 0;
}
