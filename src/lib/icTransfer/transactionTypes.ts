export const IC_SALE_TRANSACTION_TYPES = ['cdm', 'by_hand'] as const;

export type ICSaleTransactionType = (typeof IC_SALE_TRANSACTION_TYPES)[number];

/** Historical transaction values retained for existing sales. */
export const LEGACY_IC_SALE_TRANSACTION_TYPES = ['sdm', 'transfer', 'nre'] as const;

export type LegacyICSaleTransactionType = (typeof LEGACY_IC_SALE_TRANSACTION_TYPES)[number];

export const DEFAULT_IC_SALE_TRANSACTION_TYPE: ICSaleTransactionType = 'cdm';

export const IC_SALE_TRANSACTION_TYPE_OPTIONS: ReadonlyArray<{
  value: ICSaleTransactionType;
  label: string;
}> = [
  { value: 'cdm', label: 'CDM' },
  { value: 'by_hand', label: 'By Hand' },
];

const LEGACY_TYPE_LABELS: Record<string, string> = {
  sdm: 'CDM',
  transfer: 'Transfer',
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
    return 'cdm';
  }
  return DEFAULT_IC_SALE_TRANSACTION_TYPE;
}

export function formatICSaleTransactionTypeLabel(type?: string | null): string {
  const option = IC_SALE_TRANSACTION_TYPE_OPTIONS.find(o => o.value === type);
  if (option) return option.label;
  if (type && LEGACY_TYPE_LABELS[type]) return LEGACY_TYPE_LABELS[type];
  if (!type) return IC_SALE_TRANSACTION_TYPE_OPTIONS[0]?.label ?? 'CDM';
  return type.replace(/_/g, ' ');
}

/** Bank name is only collected for non–by-hand IC sale transaction types. */
export function transactionTypeRequiresBank(type?: string | null): boolean {
  return type !== 'by_hand';
}
