import 'server-only';

import { query } from '@/lib/db';

/**
 * Schema lives in supabase/migrations and src/data/schema.sql.
 * Never run CREATE/ALTER on the request path — serverless concurrency
 * takes ShareLock on branches and lock-storms the pool (57014 + connect timeouts).
 */

let icTransferSettingsEnsured = false;
let icTransferSettingsInflight: Promise<void> | null = null;

/** Seed the global settings row. Do not CREATE/ALTER the table here. */
export async function ensureIcTransferSettingsOnce(): Promise<void> {
  if (icTransferSettingsEnsured) return;
  if (!icTransferSettingsInflight) {
    icTransferSettingsInflight = query(
      `INSERT INTO ic_transfer_settings (id, sales_enabled, auto_rate_reset_enabled, warehouse_fulfillment_enabled)
       VALUES ('global', true, false, false)
       ON CONFLICT (id) DO NOTHING`,
    )
      .then(() => {
        icTransferSettingsEnsured = true;
      })
      .finally(() => {
        icTransferSettingsInflight = null;
      });
  }
  await icTransferSettingsInflight;
}
