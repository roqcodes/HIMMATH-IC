'use client';

import React from 'react';
import type { Branch, ICSale } from '@/types';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { getAdminSaleCustomerName } from '@/lib/icTransfer/branchOrderOwnership';
import { effectiveSaleCounterpartyId } from '@/lib/counterparties/effectiveId';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';
import { isBranchHandledSale } from '@/lib/icTransfer/fulfillmentHandler';
import { getAdminRowAccentClass } from '@/lib/icTransfer/orderStatus';
import { highPriorityRowClass } from '@/lib/icTransfer/orderPriority';
import { fmtLedgerAed } from '@/lib/icFunds/format';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import ICTransferDataTableShell, {
  ICTransferTableFilterSelect,
  type ICTransferTableColumn,
  icTdClass,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import AsicTabBar from '@/components/asic/AsicTabBar';
import {
  ICTransferDeleteIconButton,
  ICTransferEditIconButton,
  ICTransferViewIconButton,
} from '@/components/ic-transfer/shared/ICTransferTableActions';

export type SalesTab = 'needs_action' | 'all' | 'awaiting_verification';

const SALES_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'Customer', label: 'Customer', align: 'left' },
  { id: 'Warehouse', label: 'Warehouse', align: 'left' },
  { id: 'Settlement', label: 'Settlement', align: 'left' },
  { id: 'Units', label: 'Units', align: 'right' },
  { id: 'Metal (g)', label: 'Metal (g)', align: 'right' },
  { id: 'Total AED', label: 'AED', align: 'right' },
  { id: 'Actions', label: 'Actions', align: 'center', sortable: false },
];

const verifyCheckboxClass =
  'size-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer';

type SalesDataTableProps = {
  tab: SalesTab;
  onTabChange: (tab: SalesTab) => void;
  tabCounts: { needsAction: number; all: number; awaitingVerification: number };
  sales: ICSale[];
  search: string;
  onSearchChange: (value: string) => void;
  filterCustomer: string;
  onFilterCustomerChange: (value: string) => void;
  customerOptions: { id: string; name: string }[];
  filterWarehouse: string;
  onFilterWarehouseChange: (value: string) => void;
  filterSettlement: 'All' | 'cash' | 'metal';
  onFilterSettlementChange: (value: 'All' | 'cash' | 'metal') => void;
  warehouses: { id: string; name: string }[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  selectedVerifyIds: Set<string>;
  onToggleVerify: (id: string) => void;
  onToggleSelectAllVerify: () => void;
  allVerifySelected: boolean;
  selectedVerifyCount: number;
  onBulkVerify: () => void;
  onView: (sale: ICSale) => void;
  onEdit: (sale: ICSale) => void;
  onDelete: (e: React.MouseEvent, sale: ICSale) => void;
  getWarehouseName: (id?: string) => string;
  branchSlug?: string;
  branchName: string;
  branches: Branch[];
  txnBranchName?: string;
  warehouseFulfillmentEnabled?: boolean;
};

function OutlineBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'violet' | 'indigo' | 'teal' | 'urgent';
}) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-600',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    teal: 'border-teal-200 bg-teal-50 text-teal-700',
    urgent: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export default function SalesDataTable(props: SalesDataTableProps) {
  const {
    tab,
    onTabChange,
    tabCounts,
    sales,
    search,
    onSearchChange,
    filterCustomer,
    onFilterCustomerChange,
    customerOptions,
    filterWarehouse,
    onFilterWarehouseChange,
    filterSettlement,
    onFilterSettlementChange,
    warehouses,
    sortField,
    sortOrder,
    onSort,
    selectedVerifyIds,
    onToggleVerify,
    onToggleSelectAllVerify,
    allVerifySelected,
    selectedVerifyCount,
    onBulkVerify,
    onView,
    onEdit,
    onDelete,
    getWarehouseName,
    branchSlug,
    branchName,
    branches,
    txnBranchName,
    warehouseFulfillmentEnabled = true,
  } = props;

  const isVerificationTab = warehouseFulfillmentEnabled && tab === 'awaiting_verification';

  const tabs: { id: SalesTab; label: string; count: number }[] = warehouseFulfillmentEnabled
    ? [
        { id: 'all', label: 'All Sales', count: tabCounts.all },
        { id: 'needs_action', label: 'Needs Action', count: tabCounts.needsAction },
        { id: 'awaiting_verification', label: 'Awaiting Verification', count: tabCounts.awaitingVerification },
      ]
    : [{ id: 'all', label: 'All Sales', count: tabCounts.all }];

  const emptyMessage =
    tab === 'needs_action'
      ? 'No orders need admin action right now.'
      : tab === 'awaiting_verification'
        ? 'No orders awaiting delivery verification.'
        : 'No sales found.';

  const tableFilters = (
    <>
      <ICTransferTableFilterSelect
        value={filterCustomer}
        onChange={onFilterCustomerChange}
        aria-label="Filter by customer"
        className="min-w-[9.5rem]"
      >
        <option value="All">All customers</option>
        {customerOptions.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </ICTransferTableFilterSelect>
      <ICTransferTableFilterSelect
        value={filterWarehouse}
        onChange={onFilterWarehouseChange}
        aria-label="Filter by warehouse"
        className="min-w-[9.5rem]"
      >
        <option value="All">All warehouses</option>
        <option value="None">No warehouse</option>
        {warehouses.map(w => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </ICTransferTableFilterSelect>
      <ICTransferTableFilterSelect
        value={filterSettlement}
        onChange={v => onFilterSettlementChange(v as 'All' | 'cash' | 'metal')}
        aria-label="Filter by settlement"
        className="min-w-[8rem]"
      >
        <option value="All">All settlement</option>
        <option value="cash">Cash</option>
        <option value="metal">Metal</option>
      </ICTransferTableFilterSelect>
    </>
  );

  const toolbarEnd =
    isVerificationTab && selectedVerifyCount > 0 ? (
      <button
        type="button"
        onClick={onBulkVerify}
        className="h-9 rounded-md bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800"
      >
        Verify selected ({selectedVerifyCount})
      </button>
    ) : null;

  const headerLeading = isVerificationTab ? (
    <input
      type="checkbox"
      checked={allVerifySelected}
      onChange={onToggleSelectAllVerify}
      className={verifyCheckboxClass}
      aria-label="Select all orders for verification"
    />
  ) : undefined;

  return (
    <ICTransferDataTableShell
      title="All Sales"
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search sales…"
      filters={tableFilters}
      toolbarEnd={toolbarEnd}
      tabs={
        tabs.length > 1 ? (
          <AsicTabBar
            tabs={tabs}
            activeTab={tab}
            onTabChange={id => onTabChange(id as SalesTab)}
            ariaLabel="Sales views"
          />
        ) : undefined
      }
      columns={SALES_COLUMNS}
      sortField={sortField}
      sortOrder={sortOrder}
      onSort={onSort}
      emptyMessage={emptyMessage}
      isEmpty={sales.length === 0}
      headerLeading={headerLeading}
    >
      {sales.map(s => (
        <SaleRow
          key={s.id}
          sale={s}
          isVerificationTab={isVerificationTab}
          selectedVerifyIds={selectedVerifyIds}
          onToggleVerify={onToggleVerify}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          getWarehouseName={getWarehouseName}
          branchSlug={branchSlug}
          branchName={branchName}
          branches={branches}
          txnBranchName={txnBranchName}
        />
      ))}
    </ICTransferDataTableShell>
  );
}

function SaleRow({
  sale: s,
  isVerificationTab,
  selectedVerifyIds,
  onToggleVerify,
  onView,
  onEdit,
  onDelete,
  getWarehouseName,
  branchSlug,
  branchName,
  branches,
  txnBranchName,
}: {
  sale: ICSale;
  isVerificationTab: boolean;
  selectedVerifyIds: Set<string>;
  onToggleVerify: (id: string) => void;
  onView: (sale: ICSale) => void;
  onEdit: (sale: ICSale) => void;
  onDelete: (e: React.MouseEvent, sale: ICSale) => void;
  getWarehouseName: (id?: string) => string;
  branchSlug?: string;
  branchName: string;
  branches: Branch[];
  txnBranchName?: string;
}) {
  const customerLabel = getAdminSaleCustomerName(s, branchName, branches);
  const counterpartyId = effectiveSaleCounterpartyId(s) || s.orderCustomerId;
  const branchHandled = isBranchHandledSale(s);
  const isMetal = s.settlementMode === 'metal';
  const accent =
    getAdminRowAccentClass(s.orderStatus, s.transactionType) ?? highPriorityRowClass(s.priority);

  return (
    <tr
      onClick={() => onView(s)}
      className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${accent}`}
    >
      {isVerificationTab && (
        <td className={icTdClass('left')} onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedVerifyIds.has(s.id)}
            onChange={() => onToggleVerify(s.id)}
            className={verifyCheckboxClass}
            aria-label={`Select ${customerLabel} for verification`}
          />
        </td>
      )}
      <td className={icTdClass('left')}>
        <div className="leading-tight">
          <div className="text-xs font-medium text-slate-800">
            {new Date(s.createdAt || '').toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          <div className="text-[10px] text-slate-400">
            {new Date(s.createdAt || '').toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </td>
      <td className={icTdClass('left')}>
        <div className="min-w-[120px]">
          <CounterpartyLink
            counterpartyId={counterpartyId}
            name={customerLabel}
            branchSlug={branchSlug}
            stopPropagation
          />
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {s.transactionType === 'by_hand' && <OutlineBadge tone="violet">By Hand</OutlineBadge>}
            {s.derivedFromSaleId && (
              <OutlineBadge tone="indigo">
                Split · {getFormattedTxnId(s.derivedFromSaleId, 'sale', null, branches, txnBranchName)}
              </OutlineBadge>
            )}
          </div>
        </div>
      </td>
      <td className={icTdClass('left')}>
        <WarehouseCell sale={s} getWarehouseName={getWarehouseName} branchSlug={branchSlug} />
      </td>
      <td className={icTdClass('left')}>
        <span className="text-xs font-medium text-slate-700">
          {formatSettlementModeLabel(s.settlementMode)}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-slate-700">
          {isMetal ? '—' : s.units.toLocaleString()}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-amber-800">
          {isMetal
            ? (s.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
            : '—'}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">
          {fmtLedgerAed(s.aedAmount || 0)}
        </span>
      </td>
      <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-0.5">
          <ICTransferViewIconButton onClick={() => onView(s)} />
          {!branchHandled && (
            <>
              <ICTransferEditIconButton onClick={() => onEdit(s)} />
              <ICTransferDeleteIconButton onClick={e => onDelete(e, s)} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function WarehouseCell({
  sale: s,
  getWarehouseName,
  branchSlug,
}: {
  sale: ICSale;
  getWarehouseName: (id?: string) => string;
  branchSlug?: string;
}) {
  if (s.warehouseId) {
    return (
      <WarehouseLink
        warehouseId={s.warehouseId}
        name={getWarehouseName(s.warehouseId)}
        branchSlug={branchSlug ?? ''}
        stopPropagation
      />
    );
  }
  if (isBranchHandledSale(s)) {
    return <span className="text-xs italic text-teal-700">Branch managed</span>;
  }
  return <span className="text-slate-400">—</span>;
}
