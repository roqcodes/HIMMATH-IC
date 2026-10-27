type Listener = () => void;

let pendingCount = 0;
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function getLoadingBarCount(): number {
  return pendingCount;
}

export function subscribeLoadingBar(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function beginLoadingBar(): void {
  pendingCount += 1;
  notify();
}

export function endLoadingBar(): void {
  pendingCount = Math.max(0, pendingCount - 1);
  notify();
}

/** Track an async DB / server-action call in the global top loading bar. */
export async function trackLoading<T>(work: () => Promise<T>): Promise<T> {
  beginLoadingBar();
  try {
    return await work();
  } finally {
    endLoadingBar();
  }
}

/** Run a fetch with optional global loading bar (off for header / inline refresh). */
export async function maybeTrackLoading<T>(work: () => Promise<T>, track: boolean): Promise<T> {
  return track ? trackLoading(work) : work();
}
