'use server';

import { z } from 'zod';
import { query, pool } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { writeAuditLog, type AuditAction } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { PRODUCT_NAME } from '@/lib/brand';
import { SQL_ENSURE_ASIC_BACKUPS_INDEX, SQL_ENSURE_ASIC_BACKUPS_TABLE } from '@/lib/sql/asicBackupSql';
import {
  BACKUP_TABLE_BY_ID,
  backupFilename,
  buildBackupEnvelope,
  isBackupTableId,
  pickKnownColumns,
  serializeBackupValue,
  resolveBackupRange,
  tablesForMode,
  validateAsicBackup,
  type AsicBackupFile,
  type BackupDestination,
  type BackupHistoryRow,
  type BackupMode,
  type BackupTableDef,
  type BackupTableId,
} from '@/lib/asic/backup';
import type { User } from '@/types';

type ActionOk<T> = { success: true; data: T };
type ActionErr = { success: false; error: string };
type ActionResult<T> = ActionOk<T> | ActionErr;

const createSchema = z.object({
  destination: z.enum(['local', 'db']),
  mode: z.enum(['full', 'custom']),
  tableIds: z.array(z.string()).optional(),
  dateFilter: z.string().min(1),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
});

const restoreSchema = z.object({
  replaceDated: z.boolean(),
  source: z.enum(['file', 'history']),
  historyId: z.string().uuid().optional(),
  payload: z.unknown().optional(),
});

let ensured = false;

async function ensureBackupTable() {
  if (ensured) return;
  await query(SQL_ENSURE_ASIC_BACKUPS_TABLE);
  await query(SQL_ENSURE_ASIC_BACKUPS_INDEX);
  ensured = true;
}

async function requireBackupUser(write: boolean): Promise<User | ActionErr> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: 'You must be signed in.' };
  if (write) {
    if (user.role !== 'admin') return { success: false, error: 'Admin access required.' };
    return user;
  }
  if (user.role !== 'admin' && user.role !== 'auditor') {
    return { success: false, error: 'Admin access required.' };
  }
  return user;
}

function isUser(value: User | ActionErr): value is User {
  return !('success' in value);
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

function mapHistoryRow(r: Record<string, unknown>): BackupHistoryRow {
  const tables = Array.isArray(r.tables)
    ? (r.tables as string[]).filter(isBackupTableId)
    : [];
  return {
    id: String(r.id),
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString(),
    createdByEmail: r.created_by_email ? String(r.created_by_email) : null,
    destination: r.destination === 'local' ? 'local' : 'db',
    mode: r.mode === 'custom' ? 'custom' : 'full',
    dateFilter: String(r.date_filter || 'all-time'),
    startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
    endDate: r.end_date ? String(r.end_date).slice(0, 10) : null,
    tables,
    rowCounts: (r.row_counts && typeof r.row_counts === 'object' ? r.row_counts : {}) as BackupHistoryRow['rowCounts'],
    fileSizeBytes: Number(r.file_size_bytes || 0),
    filename: String(r.filename || 'asic-backup.json'),
    hasPayload: r.has_payload === true,
  };
}

function dumpRow(row: Record<string, unknown>, def: BackupTableDef): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    raw[key] = serializeBackupValue(value);
  }
  return pickKnownColumns(raw, def.columns);
}

async function dumpTable(
  def: BackupTableDef,
  range: { startDate: string | null; endDate: string | null },
): Promise<Record<string, unknown>[]> {
  const cols = def.columns.map(quoteIdent).join(', ');
  const table = quoteIdent(def.id);
  const params: unknown[] = [];
  let where = '';
  if (def.dated && def.dateColumn && (range.startDate || range.endDate)) {
    const col = quoteIdent(def.dateColumn);
    if (range.startDate) {
      params.push(range.startDate);
      where += `${where ? ' AND ' : ' WHERE '}${col}::date >= $${params.length}::date`;
    }
    if (range.endDate) {
      params.push(range.endDate);
      where += `${where ? ' AND ' : ' WHERE '}${col}::date <= $${params.length}::date`;
    }
  }
  const res = await query(`SELECT ${cols} FROM ${table}${where}`, params);
  return res.rows.map(row => dumpRow(row, def));
}

function upsertSql(def: BackupTableDef, clearSelfRef = false): string {
  const cols = def.columns.map(quoteIdent);
  const selectCols = def.columns.map(col => {
    const ident = quoteIdent(col);
    if (clearSelfRef && col === def.selfRefColumn) return `NULL AS ${ident}`;
    return ident;
  });
  const pk = def.pk.map(quoteIdent);
  const updates = def.columns
    .filter(c => !def.pk.includes(c) && !(clearSelfRef && c === def.selfRefColumn))
    .map(c => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`);
  const table = quoteIdent(def.id);
  const conflict = updates.length
    ? `ON CONFLICT (${pk.join(', ')}) DO UPDATE SET ${updates.join(', ')}`
    : `ON CONFLICT (${pk.join(', ')}) DO NOTHING`;
  const authGuard = def.requireAuthUser
    ? ` WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.id)`
    : '';
  return `
    INSERT INTO ${table} (${cols.join(', ')})
    SELECT ${selectCols.join(', ')}
    FROM jsonb_populate_record(NULL::${table}, $1::jsonb) r
    ${authGuard}
    ${conflict}
  `;
}

async function restoreTable(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rowCount?: number | null }> },
  def: BackupTableDef,
  rows: Record<string, unknown>[],
  replaceDated: boolean,
  range: { startDate: string | null; endDate: string | null },
): Promise<number> {
  if (replaceDated && def.dated && def.dateColumn) {
    const table = quoteIdent(def.id);
    const col = quoteIdent(def.dateColumn);
    const params: unknown[] = [];
    let where = '';
    if (range.startDate) {
      params.push(range.startDate);
      where += `${where ? ' AND ' : ' WHERE '}${col}::date >= $${params.length}::date`;
    }
    if (range.endDate) {
      params.push(range.endDate);
      where += `${where ? ' AND ' : ' WHERE '}${col}::date <= $${params.length}::date`;
    }
    if (!where) {
      await client.query(`DELETE FROM ${table}`);
    } else {
      await client.query(`DELETE FROM ${table}${where}`, params);
    }
  }

  const insert = upsertSql(def, Boolean(def.selfRefColumn));
  let count = 0;
  for (const row of rows) {
    const payload = pickKnownColumns(row, def.columns);
    const res = await client.query(insert, [JSON.stringify(payload)]);
    count += res.rowCount ?? 0;
  }

  if (def.selfRefColumn) {
    const table = quoteIdent(def.id);
    const ref = quoteIdent(def.selfRefColumn);
    for (const row of rows) {
      const id = row.id;
      const parent = row[def.selfRefColumn];
      if (!id || !parent) continue;
      await client.query(
        `UPDATE ${table} SET ${ref} = $2
         WHERE id = $1 AND EXISTS (SELECT 1 FROM ${table} p WHERE p.id = $2)`,
        [id, parent],
      );
    }
  }

  if (def.id === 'audit_log') {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence('audit_log', 'id'),
         COALESCE((SELECT MAX(id) FROM audit_log), 1),
         true
       )`,
    );
  }

  return count;
}

export async function createAppBackupAction(input: {
  destination: BackupDestination;
  mode: BackupMode;
  tableIds?: string[];
  dateFilter: string;
  customStartDate?: string;
  customEndDate?: string;
}): Promise<ActionResult<{
  history: BackupHistoryRow;
  payload?: AsicBackupFile;
}>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid backup request.' };

  const user = await requireBackupUser(false);
  if (!isUser(user)) return user;

  const defs = tablesForMode(parsed.data.mode, parsed.data.tableIds);
  if (defs.length === 0) return { success: false, error: 'Select at least one data group.' };

  try {
    await ensureBackupTable();
    const range = resolveBackupRange(
      parsed.data.dateFilter,
      parsed.data.customStartDate,
      parsed.data.customEndDate,
    );
    const rows: Partial<Record<BackupTableId, Record<string, unknown>[]>> = {};
    const dumped = await Promise.all(defs.map(async def => ({ id: def.id, rows: await dumpTable(def, range) })));
    for (const item of dumped) rows[item.id] = item.rows;

    const backup = buildBackupEnvelope({
      destination: parsed.data.destination,
      mode: parsed.data.mode,
      dateFilter: parsed.data.dateFilter,
      customStartDate: parsed.data.customStartDate,
      customEndDate: parsed.data.customEndDate,
      tables: defs.map(d => d.id),
      rows,
    });

    const filename = backupFilename({
      mode: backup.mode,
      startDate: backup.scope.startDate,
      endDate: backup.scope.endDate,
      createdAt: backup.createdAt,
    });
    const json = JSON.stringify(backup);
    const fileSizeBytes = Buffer.byteLength(json, 'utf8');
    if (fileSizeBytes > 32 * 1024 * 1024) {
      return { success: false, error: 'Backup is larger than 32 MB. Narrow the date range or choose fewer tables.' };
    }

    const inserted = await query(
      `INSERT INTO asic_backups (
         created_by, created_by_email, destination, mode, date_filter, start_date, end_date,
         tables, row_counts, file_size_bytes, filename, payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb)
       RETURNING id, created_at, created_by_email, destination, mode, date_filter, start_date,
                 end_date, tables, row_counts, file_size_bytes, filename, (payload IS NOT NULL) AS has_payload`,
      [
        user.id,
        user.email,
        backup.destination,
        backup.mode,
        backup.scope.dateFilter,
        backup.scope.startDate,
        backup.scope.endDate,
        backup.scope.tables,
        JSON.stringify(backup.counts),
        fileSizeBytes,
        filename,
        json,
      ],
    );

    await writeAuditLog({
      actor: user,
      action: 'export' as AuditAction,
      entityType: 'asic_backup',
      entityId: String(inserted.rows[0]?.id ?? ''),
      after: {
        destination: backup.destination,
        mode: backup.mode,
        tables: backup.scope.tables,
        counts: backup.counts,
      },
    });

    return {
      success: true,
      data: {
        history: mapHistoryRow(inserted.rows[0]),
        payload: parsed.data.destination === 'local' ? backup : undefined,
      },
    };
  } catch (error) {
    logger.error({ error }, 'createAppBackupAction failed');
    return { success: false, error: 'Failed to create backup.' };
  }
}

export async function listAppBackupsAction(): Promise<ActionResult<BackupHistoryRow[]>> {
  const user = await requireBackupUser(false);
  if (!isUser(user)) return user;
  try {
    await ensureBackupTable();
    const res = await query(
      `SELECT id, created_at, created_by_email, destination, mode, date_filter, start_date, end_date,
              tables, row_counts, file_size_bytes, filename, (payload IS NOT NULL) AS has_payload
       FROM asic_backups
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return { success: true, data: res.rows.map(mapHistoryRow) };
  } catch (error) {
    logger.error({ error }, 'listAppBackupsAction failed');
    return { success: false, error: 'Failed to load backup history.' };
  }
}

export async function getAppBackupPayloadAction(
  id: string,
): Promise<ActionResult<{ filename: string; payload: AsicBackupFile }>> {
  const user = await requireBackupUser(false);
  if (!isUser(user)) return user;
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: 'Invalid backup id.' };
  try {
    await ensureBackupTable();
    const res = await query(`SELECT filename, payload FROM asic_backups WHERE id = $1 LIMIT 1`, [id]);
    const row = res.rows[0];
    if (!row) return { success: false, error: 'Backup not found.' };
    if (!row.payload) {
      return { success: false, error: 'This history row has no stored JSON. Restore from the original file.' };
    }
    if (!validateAsicBackup(row.payload)) {
      return { success: false, error: 'Stored backup is invalid.' };
    }
    return { success: true, data: { filename: String(row.filename), payload: row.payload as AsicBackupFile } };
  } catch (error) {
    logger.error({ error }, 'getAppBackupPayloadAction failed');
    return { success: false, error: 'Failed to load backup.' };
  }
}

export async function restoreAppBackupAction(input: {
  replaceDated: boolean;
  source: 'file' | 'history';
  historyId?: string;
  payload?: unknown;
}): Promise<ActionResult<{ restored: Record<string, number> }>> {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid restore request.' };

  const user = await requireBackupUser(true);
  if (!isUser(user)) return user;

  try {
    await ensureBackupTable();
    let backup: AsicBackupFile | null = null;
    if (parsed.data.source === 'history') {
      if (!parsed.data.historyId) return { success: false, error: 'Select a backup from history.' };
      const stored = await getAppBackupPayloadAction(parsed.data.historyId);
      if (!stored.success) return stored;
      backup = stored.data.payload;
    } else {
      if (!validateAsicBackup(parsed.data.payload)) {
        return { success: false, error: `Invalid backup file. Use a ${PRODUCT_NAME} JSON backup.` };
      }
      backup = parsed.data.payload;
    }

    const defs = backup.scope.tables
      .map(id => BACKUP_TABLE_BY_ID[id])
      .filter(Boolean)
      .sort((a, b) => a.insertOrder - b.insertOrder);

    const range = { startDate: backup.scope.startDate, endDate: backup.scope.endDate };
    const restored: Record<string, number> = {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const def of defs) {
        const rows = (backup.tables[def.id] ?? []).filter(r => r && typeof r === 'object') as Record<string, unknown>[];
        restored[def.id] = await restoreTable(client, def, rows, parsed.data.replaceDated, range);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await writeAuditLog({
      actor: user,
      action: 'update',
      entityType: 'asic_backup_restore',
      entityId: parsed.data.historyId ?? 'file',
      after: { replaceDated: parsed.data.replaceDated, restored, tables: backup.scope.tables },
    });

    return { success: true, data: { restored } };
  } catch (error) {
    logger.error({ error }, 'restoreAppBackupAction failed');
    return { success: false, error: 'Restore failed. No partial write was kept.' };
  }
}

export async function deleteAppBackupAction(id: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireBackupUser(true);
  if (!isUser(user)) return user;
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: 'Invalid backup id.' };
  try {
    await ensureBackupTable();
    const res = await query(`DELETE FROM asic_backups WHERE id = $1 RETURNING id`, [id]);
    if (!res.rows[0]) return { success: false, error: 'Backup not found.' };
    await writeAuditLog({
      actor: user,
      action: 'delete',
      entityType: 'asic_backup',
      entityId: id,
    });
    return { success: true, data: { id } };
  } catch (error) {
    logger.error({ error }, 'deleteAppBackupAction failed');
    return { success: false, error: 'Failed to delete backup.' };
  }
}
