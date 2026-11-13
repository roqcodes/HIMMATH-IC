import type { ICTransferTableColumn } from '@/components/ic-transfer/shared/ICTransferDataTableShell';

/** Money columns shared by purchase/sale list & detail tables (after Units / Metal). */
export const IC_DEAL_MONEY_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Metal (g)', label: 'Metal (g)', align: 'right' },
  { id: 'Total INR', label: 'Total INR', align: 'right' },
  { id: 'Rate (AED)', label: 'AED rate', align: 'right' },
  { id: 'Total AED', label: 'Total AED', align: 'right' },
  { id: 'INR paid', label: 'INR paid', align: 'right' },
  { id: 'AED paid', label: 'AED paid', align: 'right' },
  { id: 'Profit', label: 'Profit', align: 'right' },
];

export const IC_DEAL_ACTIONS_COLUMN: ICTransferTableColumn = {
  id: 'Actions',
  label: 'Actions',
  align: 'center',
  sortable: false,
};

export function icPurchaseMainTableColumns(): ICTransferTableColumn[] {
  const money = IC_DEAL_MONEY_COLUMNS.map(c =>
    c.id === 'Profit' ? { ...c, sortable: false } : c,
  );
  return [
    { id: 'Date', label: 'Date', align: 'left' },
    { id: 'Supplier', label: 'Supplier', align: 'left' },
    { id: 'Warehouse', label: 'Warehouse', align: 'left' },
    { id: 'Settlement', label: 'Settlement', align: 'left' },
    { id: 'Units', label: 'Units', align: 'right' },
    ...money,
    IC_DEAL_ACTIONS_COLUMN,
  ];
}

export function icSaleMainTableColumns(partyColumnId: string, partyLabel: string): ICTransferTableColumn[] {
  return [
    { id: 'Date', label: 'Date', align: 'left' },
    { id: partyColumnId, label: partyLabel, align: 'left' },
    { id: 'Warehouse', label: 'Warehouse', align: 'left' },
    { id: 'Settlement', label: 'Settlement', align: 'left' },
    { id: 'Units', label: 'Units', align: 'right' },
    ...IC_DEAL_MONEY_COLUMNS,
    IC_DEAL_ACTIONS_COLUMN,
  ];
}

/** Warehouse detail — purchases & sales tabs (party-centric). */
export function icWarehouseDealTableColumns(includeType: boolean): ICTransferTableColumn[] {
  const lead: ICTransferTableColumn[] = [
    { id: 'Date', label: 'Date', align: 'left' },
    ...(includeType ? [{ id: 'Type', label: 'Type', align: 'left' as const }] : []),
    { id: 'Party', label: 'Party', align: 'left' },
    { id: 'Settlement', label: 'Settlement', align: 'left' },
    { id: 'Units', label: 'Units', align: 'right' },
  ];
  return [...lead, ...IC_DEAL_MONEY_COLUMNS, IC_DEAL_ACTIONS_COLUMN];
}

/** Counterparty detail — deal rows (warehouse-centric). */
export function icCounterpartyDealTableColumns(includeType: boolean): ICTransferTableColumn[] {
  const lead: ICTransferTableColumn[] = [
    { id: 'Date', label: 'Date', align: 'left' },
    ...(includeType ? [{ id: 'Type', label: 'Type', align: 'left' as const }] : []),
    { id: 'Warehouse', label: 'Warehouse', align: 'left' },
    { id: 'Settlement', label: 'Settlement', align: 'left' },
    { id: 'Units', label: 'Units', align: 'right' },
  ];
  return [...lead, ...IC_DEAL_MONEY_COLUMNS, IC_DEAL_ACTIONS_COLUMN];
}
