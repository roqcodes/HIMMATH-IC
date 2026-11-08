export type AsicSectionId =
  | 'dashboard'
  | 'orders'
  | 'sales'
  | 'purchases'
  | 'warehouse'
  | 'counterparties'
  | 'customers'
  | 'regions'
  | 'suppliers'
  | 'payments'
  | 'receipts'
  | 'contra'
  | 'journal'
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
  'warehouse',
  'counterparties',
  'suppliers',
  'payments',
  'receipts',
  'contra',
  'journal',
  'capital',
  'pl',
  'entities',
  'reports',
  'rates',
];
