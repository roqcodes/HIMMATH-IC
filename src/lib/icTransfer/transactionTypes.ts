export const IC_SALE_TRANSACTION_TYPES = ['sdm', 'by_hand'] as const;

export type ICSaleTransactionType = (typeof IC_SALE_TRANSACTION_TYPES)[number];

/** Stored on older sales before SDM-only types. */
export const LEGACY_IC_SALE_TRANSACTION_TYPES = ['transfer', 'cdm', 'nre'] as const;

export type LegacyICSaleTransactionType = (typeof LEGACY_IC_SALE_TRANSACTION_TYPES)[number];

export const DEFAULT_IC_SALE_TRANSACTION_TYPE: ICSaleTransactionType = 'sdm';

export const IC_SALE_TRANSACTION_TYPE_OPTIONS: ReadonlyArray<{
  value: ICSaleTransactionType;
  label: string;
}> = [
  { value: 'sdm', label: 'SDM' },
  { value: 'by_hand', label: 'By Hand' },
];

const LEGACY_TYPE_LABELS: Record<string, string> = {
  transfer: 'Transfer',
  cdm: 'CDM',
  nre: 'NRE',
};

export function isICSaleTransactionType(value: string): value is ICSaleTransactionType {
  return (IC_SALE_TRANSACTION_TYPES as readonly string[]).includes(value);
}

/** Map legacy DB values to current types for new edits / rate lookup. */
export function normalizeICSaleTransactionType(value?: string | null): ICSaleTransactionType {
  if (value && isICSaleTransactionType(value)) return value;
  if (value === 'by_hand') return 'by_hand';
  if (value && (LEGACY_IC_SALE_TRANSACTION_TYPES as readonly string[]).includes(value)) {
    return 'sdm';
  }
  return DEFAULT_IC_SALE_TRANSACTION_TYPE;
}

export function formatICSaleTransactionTypeLabel(type?: string | null): string {
  const option = IC_SALE_TRANSACTION_TYPE_OPTIONS.find(o => o.value === type);
  if (option) return option.label;
  if (type && LEGACY_TYPE_LABELS[type]) return LEGACY_TYPE_LABELS[type];
  if (!type) return IC_SALE_TRANSACTION_TYPE_OPTIONS[0]?.label ?? 'SDM';
  return type.replace(/_/g, ' ');
}

/** Bank name is only collected for non–by-hand IC sale transaction types. */
export function transactionTypeRequiresBank(type?: string | null): boolean {
  return type !== 'by_hand';
}
