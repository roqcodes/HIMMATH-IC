export type AsicSectionId =
  | 'dashboard'
  | 'orders'
  | 'sales'
  | 'purchases'
  | 'warehouse'
  | 'customers'
  | 'regions'
  | 'suppliers'
  | 'payments'
  | 'receipts'
  | 'contra'
  | 'journal'
  | 'pl'
  | 'accounts'
  | 'reports'
  | 'ic-finance'
  | 'rates'
  | 'agents'
  | 'fx-settlements'
  | 'commission'
  | 'global-settings'
  | 'branches'
  | 'users'
  | 'audit-log'
  | 'reconciliation'
  | 'delivery-agents'
  | 'settlement'
  | 'backup'
  | 'account'
  | 'wallet';

export const STAFF_MANAGED_SECTIONS: AsicSectionId[] = [
  'orders',
  'sales',
  'purchases',
  'warehouse',
  'suppliers',
  'payments',
  'receipts',
  'contra',
  'journal',
  'pl',
  'accounts',
  'reports',
  'rates',
  'fx-settlements',
];
