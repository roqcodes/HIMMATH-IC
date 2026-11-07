import 'server-only';

import { query } from '@/lib/db';
import {
  HQ_IC_FUNDS_BRANCH_ID,
  HQ_IC_FUNDS_BRANCH_NAME,
  HQ_IC_FUNDS_BRANCH_SLUG,
} from '@/lib/icFunds/hqBranch';

let hqReady = false;
let hqInflight: Promise<void> | null = null;

/** Idempotent: HQ admin IC Funds ledger row in branches + voucher counter. */
export async function ensureHqIcFundsBranch(): Promise<void> {
  if (hqReady) return;
  if (!hqInflight) {
    hqInflight = (async () => {
      await query(
        `INSERT INTO branches (
           id, slug, name, location, manager_name, status, timezone, hidden_pages, features
         ) VALUES ($1, $2, $3, 'Head office', 'HQ Admin', 'active', 'Asia/Dubai', '{}', '{"warehousePortal":false,"customerPortal":false,"isHqLedger":true}'::jsonb)
         ON CONFLICT (id) DO NOTHING`,
        [HQ_IC_FUNDS_BRANCH_ID, HQ_IC_FUNDS_BRANCH_SLUG, HQ_IC_FUNDS_BRANCH_NAME],
      );

      await query(
        `INSERT INTO ic_fund_voucher_counters (branch_id, last_no)
         VALUES ($1, 0)
         ON CONFLICT (branch_id) DO NOTHING`,
        [HQ_IC_FUNDS_BRANCH_ID],
      );
      hqReady = true;
    })().finally(() => {
      hqInflight = null;
    });
  }
  await hqInflight;
}
