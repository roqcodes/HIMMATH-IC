import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type AdminGlobal = { __asicSupabaseAdmin?: SupabaseClient };

/** Service-role client. Server-only. Never import from client components. */
export function createSupabaseAdminClient(): SupabaseClient {
  const g = globalThis as AdminGlobal;
  if (g.__asicSupabaseAdmin) return g.__asicSupabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  g.__asicSupabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return g.__asicSupabaseAdmin;
}
