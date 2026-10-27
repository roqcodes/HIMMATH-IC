/** Thrown from server actions when a user-facing failure should surface in the UI. */
export class ActionError extends Error {
  readonly debug: Record<string, unknown>;

  constructor(userMessage: string, debug: Record<string, unknown> = {}) {
    super(userMessage);
    this.name = 'ActionError';
    this.debug = debug;
  }
}

export function logClientActionError(scope: string, err: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    console.error(`[${scope}]`, err instanceof Error ? err.message : err);
    return;
  }
  if (err instanceof ActionError) {
    console.error(`[${scope}]`, err.message, err.debug);
    return;
  }
  console.error(`[${scope}]`, err);
}
