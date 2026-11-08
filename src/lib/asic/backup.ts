import { getDateFilterLabel, resolveDateFilterRange, type DateFilterRange } from '@/lib/dateFilterRange';

export const ASIC_BACKUP_KIND = 'asic/app-backup' as const;
export const ASIC_BACKUP_VERSION = 1 as const;

export type BackupDestination = 'local' | 'db';
export type BackupMode = 'full' | 'custom';
export type BackupGroupId =
  | 'organization'
  | 'customers'
  | 'catalog'
  | 'purchases'
  | 'sales'
  | 'warehouse'
  | 'funds'
  | 'audit';

export type BackupTableId =
  | 'branches'
  | 'ic_counterparties'
  | 'user_page_permissions'
  | 'ic_regions'
  | 'ic_warehouses'
  | 'ic_rate_groups'
  | 'ic_rate_group_counterparties'
  | 'ic_rate_group_branches'
  | 'ic_warehouse_groups'
  | 'ic_delivery_agents'
  | 'ic_purchases'
  | 'ic_sales'
  | 'ic_warehouse_transactions'
  | 'ic_transfer_settings'
  | 'ic_fund_accounts'
  | 'ic_fund_voucher_counters'
  | 'ic_fund_vouchers'
  | 'profiles'
  | 'audit_log';

export type BackupTableDef = {
  id: BackupTableId;
  label: string;
  group: BackupGroupId;
  columns: readonly string[];
  pk: readonly string[];
  dateColumn?: string;
  dated: boolean;
  insertOrder: number;
  requireAuthUser?: boolean;
  selfRefColumn?: string;
};

export const BACKUP_GROUPS: { id: BackupGroupId; label: string; hint: string }[] = [
  { id: 'organization', label: 'Organization', hint: 'Branches, users, page permissions' },
  { id: 'customers', label: 'Counterparties', hint: 'Trading counterparties' },
  { id: 'catalog', label: 'Catalog & settings', hint: 'Regions, suppliers, warehouses, rates' },
  { id: 'purchases', label: 'Purchases', hint: 'Purchase rows (date filter applies)' },
  { id: 'sales', label: 'Sales', hint: 'Sales / orders (date filter applies)' },
  { id: 'warehouse', label: 'Warehouse movements', hint: 'Stock transactions (date filter applies)' },
  { id: 'funds', label: 'Funds', hint: 'Accounts, counters, vouchers' },
  { id: 'audit', label: 'Audit log', hint: 'Audit rows (date filter applies)' },
];

export const BACKUP_TABLES: readonly BackupTableDef[] = [
  {
    id: 'branches',
    label: 'Branches',
    group: 'organization',
    dated: false,
    insertOrder: 10,
    pk: ['id'],
    columns: [
      'id', 'slug', 'name', 'logo_url', 'address', 'city', 'country', 'trn', 'phone', 'email',
      'website', 'location', 'manager_name', 'cash_balance', 'gold_balance', 'opening_gold_balance',
      'current_balance', 'opening_balance', 'closing_balance', 'daily_pl', 'status', 'timezone',
      'hidden_pages', 'enabled_currencies', 'is_active', 'deleted_at', 'features', 'last_activity',
      'created_at',
    ],
  },
  {
    id: 'ic_counterparties',
    label: 'Counterparties',
    group: 'customers',
    dated: false,
    insertOrder: 20,
    pk: ['id'],
    columns: [
      'id', 'branch_id', 'name', 'code', 'phone', 'email', 'address', 'commission', 'region_id',
      'country', 'subdivision', 'locality', 'status', 'balance', 'opening_aed', 'opening_inr', 'created_at',
    ],
  },
  {
    id: 'user_page_permissions',
    label: 'Page permissions',
    group: 'organization',
    dated: false,
    insertOrder: 30,
    pk: ['user_id', 'branch_id', 'page_id'],
    columns: ['user_id', 'branch_id', 'page_id', 'access_level', 'updated_at', 'updated_by'],
  },
  {
    id: 'ic_regions',
    label: 'Regions',
    group: 'catalog',
    dated: false,
    insertOrder: 40,
    pk: ['id'],
    columns: ['id', 'name', 'country', 'created_at'],
  },
  {
    id: 'ic_warehouses',
    label: 'Warehouses',
    group: 'catalog',
    dated: false,
    insertOrder: 60,
    pk: ['id'],
    columns: [
      'id', 'name', 'phone', 'commission', 'region_id', 'email', 'address', 'current_stock',
      'current_metal_g', 'opening_stock', 'opening_metal_g', 'opening_aed', 'opening_inr',
      'send_delivery_proof_to_customer', 'branch_id', 'created_at',
    ],
  },
  {
    id: 'ic_rate_groups',
    label: 'Rate groups',
    group: 'catalog',
    dated: false,
    insertOrder: 70,
    pk: ['id'],
    columns: [
      'id', 'name', 'country', 'currency', 'sale_rate', 'conversion_rate', 'created_by_branch_id',
      'pricing_config', 'created_at', 'updated_at',
    ],
  },
  {
    id: 'ic_rate_group_counterparties',
    label: 'Rate group counterparties',
    group: 'catalog',
    dated: false,
    insertOrder: 80,
    pk: ['group_id', 'counterparty_id'],
    columns: ['group_id', 'counterparty_id'],
  },
  {
    id: 'ic_rate_group_branches',
    label: 'Rate group branches',
    group: 'catalog',
    dated: false,
    insertOrder: 90,
    pk: ['group_id', 'branch_id'],
    columns: ['group_id', 'branch_id'],
  },
  {
    id: 'ic_warehouse_groups',
    label: 'Warehouse groups',
    group: 'catalog',
    dated: false,
    insertOrder: 100,
    pk: ['id'],
    columns: ['id', 'warehouse_id', 'name', 'description', 'created_at'],
  },
  {
    id: 'ic_delivery_agents',
    label: 'Delivery agents',
    group: 'catalog',
    dated: false,
    insertOrder: 110,
    pk: ['id'],
    columns: [
      'id', 'warehouse_id', 'account_id', 'name', 'email', 'phone', 'region_id', 'group_id',
      'status', 'created_at',
    ],
  },
  {
    id: 'ic_purchases',
    label: 'Purchases',
    group: 'purchases',
    dated: true,
    dateColumn: 'created_at',
    insertOrder: 130,
    pk: ['id'],
    columns: [
      'id', 'supplier_id', 'location_id', 'warehouse_id', 'unit_rate', 'units', 'payment_method',
      'notes', 'aed_total', 'payment_status', 'settlement_mode', 'metal_weight_g',
      'metal_rate_inr_per_g', 'metal_rate_aed_per_g', 'inr_total', 'created_at',
      'lab_weight_g', 'lab_charge_inr_per_g', 'lab_total_inr',
    ],
  },
  {
    id: 'ic_sales',
    label: 'Sales',
    group: 'sales',
    dated: true,
    dateColumn: 'created_at',
    insertOrder: 140,
    pk: ['id'],
    selfRefColumn: 'derived_from_sale_id',
    columns: [
      'id', 'customer_name', 'order_customer_name', 'order_customer_id', 'sub_customer_id',
      'sub_customer_name', 'entered_by', 'entered_by_name', 'entered_by_user_id', 'warehouse_id',
      'delivery_agent_id', 'transaction_type', 'units', 'unit_rate',
      'aed_amount', 'bank', 'address', 'image_url', 'service_charge', 'collected_units',
      'priority', 'payment_status', 'order_status', 'rejection_remarks', 'status_updated_at',
      'status_updated_by', 'delivery_image_url', 'derived_from_sale_id', 'fulfillment_handler',
      'settlement_mode', 'metal_weight_g', 'metal_rate_inr_per_g', 'metal_rate_aed_per_g', 'inr_total',
      'lab_weight_g', 'lab_charge_inr_per_g', 'lab_total_inr',
      'version', 'idempotency_key', 'updated_at', 'created_at',
    ],
  },
  {
    id: 'ic_warehouse_transactions',
    label: 'Warehouse transactions',
    group: 'warehouse',
    dated: true,
    dateColumn: 'created_at',
    insertOrder: 150,
    pk: ['id'],
    columns: ['id', 'warehouse_id', 'transaction_type', 'units', 'reference_type', 'reference_id', 'created_at'],
  },
  {
    id: 'ic_transfer_settings',
    label: 'Transfer settings',
    group: 'catalog',
    dated: false,
    insertOrder: 160,
    pk: ['id'],
    columns: ['id', 'sales_enabled', 'auto_rate_reset_enabled', 'updated_at', 'updated_by'],
  },
  {
    id: 'ic_fund_accounts',
    label: 'Fund accounts',
    group: 'funds',
    dated: false,
    insertOrder: 170,
    pk: ['id'],
    columns: [
      'id', 'branch_id', 'name', 'account_type', 'status', 'opening_balance', 'notes', 'customer_id',
      'phone', 'source_type', 'source_id', 'created_at',
    ],
  },
  {
    id: 'ic_fund_voucher_counters',
    label: 'Voucher counters',
    group: 'funds',
    dated: false,
    insertOrder: 180,
    pk: ['branch_id'],
    columns: ['branch_id', 'last_no'],
  },
  {
    id: 'ic_fund_vouchers',
    label: 'Vouchers',
    group: 'funds',
    dated: true,
    dateColumn: 'voucher_date',
    insertOrder: 190,
    pk: ['id'],
    columns: [
      'id', 'branch_id', 'voucher_no', 'voucher_type', 'voucher_date', 'debit_account_id',
      'credit_account_id', 'amount', 'notes', 'created_by', 'created_by_name', 'created_by_user_id',
      'created_at', 'status', 'voided_at', 'voided_by_name', 'reference_type', 'reference_id',
      'version', 'idempotency_key',
    ],
  },
  {
    id: 'profiles',
    label: 'User profiles',
    group: 'organization',
    dated: false,
    insertOrder: 200,
    pk: ['id'],
    requireAuthUser: true,
    columns: [
      'id', 'role', 'name', 'email', 'branch_id', 'customer_id', 'warehouse_id', 'delivery_agent_id',
      'created_at',
    ],
  },
  {
    id: 'audit_log',
    label: 'Audit log',
    group: 'audit',
    dated: true,
    dateColumn: 'created_at',
    insertOrder: 210,
    pk: ['id'],
    columns: [
      'id', 'created_at', 'actor_id', 'actor_email', 'actor_role', 'action', 'entity_type',
      'entity_id', 'branch_id', 'before_json', 'after_json',
    ],
  },
];

export const BACKUP_TABLE_BY_ID = Object.fromEntries(BACKUP_TABLES.map(t => [t.id, t])) as Record<
  BackupTableId,
  BackupTableDef
>;

export type AsicBackupFile = {
  formatVersion: typeof ASIC_BACKUP_VERSION;
  kind: typeof ASIC_BACKUP_KIND;
  createdAt: string;
  destination: BackupDestination;
  mode: BackupMode;
  scope: {
    dateFilter: string;
    dateRangeLabel: string;
    startDate: string | null;
    endDate: string | null;
    tables: BackupTableId[];
  };
  tables: Partial<Record<BackupTableId, Record<string, unknown>[]>>;
  counts: Partial<Record<BackupTableId, number>>;
};

export type BackupHistoryRow = {
  id: string;
  createdAt: string;
  createdByEmail: string | null;
  destination: BackupDestination;
  mode: BackupMode;
  dateFilter: string;
  startDate: string | null;
  endDate: string | null;
  tables: BackupTableId[];
  rowCounts: Partial<Record<BackupTableId, number>>;
  fileSizeBytes: number;
  filename: string;
  hasPayload: boolean;
};

export function isBackupTableId(value: string): value is BackupTableId {
  return value in BACKUP_TABLE_BY_ID;
}

export function tablesForMode(mode: BackupMode, selected: string[] = []): BackupTableDef[] {
  if (mode === 'full') return [...BACKUP_TABLES];
  const ids = new Set(selected.filter(isBackupTableId));
  return BACKUP_TABLES.filter(t => ids.has(t.id));
}

export function tablesForGroups(groupIds: BackupGroupId[]): BackupTableDef[] {
  const set = new Set(groupIds);
  return BACKUP_TABLES.filter(t => set.has(t.group));
}

export function resolveBackupRange(
  dateFilter: string,
  customStartDate = '',
  customEndDate = '',
): DateFilterRange {
  return resolveDateFilterRange(dateFilter, customStartDate, customEndDate);
}

export function backupFilename(input: {
  mode: BackupMode;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}): string {
  const start = input.startDate || 'all-time';
  const end = input.endDate || 'all-time';
  const ts = input.createdAt.slice(0, 19).replace(/[:T]/g, '-');
  return `asic-backup_${input.mode}_${start}_${end}_${ts}.json`;
}

export function buildBackupEnvelope(input: {
  destination: BackupDestination;
  mode: BackupMode;
  dateFilter: string;
  customStartDate?: string;
  customEndDate?: string;
  tables: BackupTableId[];
  rows: Partial<Record<BackupTableId, Record<string, unknown>[]>>;
}): AsicBackupFile {
  const range = resolveBackupRange(input.dateFilter, input.customStartDate, input.customEndDate);
  const createdAt = new Date().toISOString();
  const counts: Partial<Record<BackupTableId, number>> = {};
  for (const id of input.tables) {
    counts[id] = input.rows[id]?.length ?? 0;
  }
  return {
    formatVersion: ASIC_BACKUP_VERSION,
    kind: ASIC_BACKUP_KIND,
    createdAt,
    destination: input.destination,
    mode: input.mode,
    scope: {
      dateFilter: input.dateFilter,
      dateRangeLabel: getDateFilterLabel(input.dateFilter, input.customStartDate, input.customEndDate),
      startDate: range.startDate,
      endDate: range.endDate,
      tables: input.tables,
    },
    tables: input.rows,
    counts,
  };
}

export function validateAsicBackup(data: unknown): data is AsicBackupFile {
  if (!data || typeof data !== 'object') return false;
  const b = data as AsicBackupFile;
  if (b.formatVersion !== ASIC_BACKUP_VERSION || b.kind !== ASIC_BACKUP_KIND) return false;
  if (!b.scope || !b.tables || typeof b.tables !== 'object') return false;
  if (!Array.isArray(b.scope.tables) || b.scope.tables.length === 0) return false;
  return b.scope.tables.every(id => isBackupTableId(id) && Array.isArray(b.tables[id] ?? []));
}

export function totalBackupRows(counts: Partial<Record<string, number>> | null | undefined): number {
  if (!counts) return 0;
  let total = 0;
  for (const n of Object.values(counts)) {
    if (typeof n === 'number') total += n;
  }
  return total;
}

export function formatBackupBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadBackupJson(backup: AsicBackupFile, filename?: string): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || backupFilename({
    mode: backup.mode,
    startDate: backup.scope.startDate,
    endDate: backup.scope.endDate,
    createdAt: backup.createdAt,
  });
  a.click();
  URL.revokeObjectURL(url);
}

export function pickKnownColumns(
  row: Record<string, unknown>,
  columns: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (col in row) out[col] = serializeBackupValue(row[col]);
  }
  return out;
}

export function serializeBackupValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return Number(value);
  return value;
}
