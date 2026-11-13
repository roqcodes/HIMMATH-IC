import type { QueryResult } from 'pg';
import { resolveBranchTimeZone } from '@/lib/businessTime';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

/** True when `branches.timezone` must be rewritten for Postgres (e.g. `gmt+0530`). */
export function branchStoredTimeZoneNeedsFix(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  const trimmed = raw.trim();
  return resolveBranchTimeZone(trimmed) !== trimmed;
}

/**
 * Resolve IANA zone for a branch and persist when the stored label is legacy/invalid.
 * Same pattern as purchase/sale IC Funds sync (`loadBranchTimeZone`).
 */
export async function loadBranchTimeZoneInTx(client: DbClient, branchId: string): Promise<string> {
  const res = await client.query(`SELECT timezone FROM branches WHERE id = $1 LIMIT 1`, [branchId]);
  const raw = res.rows[0]?.timezone as string | undefined;
  const resolved = resolveBranchTimeZone(raw);
  if (branchStoredTimeZoneNeedsFix(raw)) {
    await client.query(`UPDATE branches SET timezone = $2 WHERE id = $1`, [branchId, resolved]);
  }
  return resolved;
}
