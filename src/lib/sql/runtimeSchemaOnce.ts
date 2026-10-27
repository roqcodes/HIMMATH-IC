import 'server-only';

import { query } from '@/lib/db';
import { SQL_ENSURE_IC_FUNDS_SCHEMA } from '@/lib/sql/icFundsSchemaSql';
import { SQL_ENSURE_IC_TRANSFER_SETTINGS } from '@/lib/sql/icTransferSettingsSql';

let icFundsSchemaEnsured = false;
let icTransferSettingsEnsured = false;

/** Run IC Funds DDL at most once per server process (migrations are source of truth). */
export async function ensureIcFundsSchemaOnce(): Promise<void> {
  if (icFundsSchemaEnsured) return;
  await query(SQL_ENSURE_IC_FUNDS_SCHEMA);
  icFundsSchemaEnsured = true;
}

/** Run IC Transfer settings DDL at most once per server process. */
export async function ensureIcTransferSettingsOnce(): Promise<void> {
  if (icTransferSettingsEnsured) return;
  await query(SQL_ENSURE_IC_TRANSFER_SETTINGS);
  icTransferSettingsEnsured = true;
}
