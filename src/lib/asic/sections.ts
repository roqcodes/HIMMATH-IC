export type AsicSectionId =
  | 'dashboard'
  | 'orders'
  | 'sales'
  | 'purchases'
  | 'branches'
  | 'warehouse'
  | 'counterparties'
  | 'customers'
  | 'regions'
  | 'suppliers'
  | 'payments'
  | 'receipts'
  | 'contra'
  | 'journal'
  | 'fx'
  | 'capital'
  | 'pl'
  | 'accounts'
  | 'entities'
  | 'reports'
  | 'ic-finance'
  | 'rates'
  | 'agents'
  | 'commission'
  | 'global-settings'
  | 'users'
  | 'audit-log'
  | 'reconciliation'
  | 'delivery-agents'
  | 'settlement'
  | 'backup'
  | 'account';

export const STAFF_MANAGED_SECTIONS: AsicSectionId[] = [
  'orders',
  'sales',
  'purchases',
  'branches',
  'warehouse',
  'counterparties',
  'suppliers',
  'payments',
  'receipts',
  'contra',
  'journal',
  'fx',
  'capital',
  'pl',
  'entities',
  'reports',
  'rates',
];
