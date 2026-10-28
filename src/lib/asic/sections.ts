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
  'warehouse',
  'suppliers',
  'payments',
  'receipts',
  'contra',
  'journal',
  'pl',
  'entities',
  'reports',
  'rates',
];
