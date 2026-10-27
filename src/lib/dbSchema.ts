import 'server-only';

/** Schema is applied via supabase/migrations — do not bootstrap leftover ERP tables at runtime. */
export function ensureDbSchema(): Promise<void> {
  return Promise.resolve();
}
