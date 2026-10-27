'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Branch, ICSale } from '@/types';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { getAdminSaleCustomerName } from '@/lib/icTransfer/branchOrderOwnership';
import { isBranchHandledSale } from '@/lib/icTransfer/fulfillmentHandler';
import { canAdminAccept, getAdminRowAccentClass } from '@/lib/icTransfer/orderStatus';
import { highPriorityRowClass } from '@/lib/icTransfer/orderPriority';
import { getDeliveredUnits, getRemainingUnits } from '@/lib/icTransfer/saleUnits';
import { AdminOrderStatusCard, AdminOrderWorkflowActions } from '../shared/AdminOrderWorkflowPanel';
import FulfillmentHandlerControl, { FulfillmentHandlerBadge } from '../shared/FulfillmentHandlerControl';
import SalePriorityControl from '../shared/SalePriorityControl';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { SortIcon } from '@/components/ic-transfer/sales/sales-icons';

export type SalesTab = 'needs_action' | 'all' | 'awaiting_verification';

type ColumnId =
  | 'select'
  | 'date'
  | 'customer'
  | 'handling'
  | 'units'
  | 'totalAed'
  | 'delivered'
  | 'remaining'
  | 'warehouse'
  | 'priority'
  | 'status'
  | 'actions';

type ColumnVisibility = Record<Exclude<ColumnId, 'select' | 'actions'>, boolean>;

const DEFAULT_VISIBILITY: ColumnVisibility = {
  date: true,
  customer: true,
  handling: true,
  units: true,
  totalAed: true,
  delivered: true,
  remaining: true,
  warehouse: true,
  priority: true,
  status: true,
};

const HIDEABLE_COLUMNS: { id: keyof ColumnVisibility; label: string }[] = [
  { id: 'handling', label: 'Handling' },
  { id: 'priority', label: 'Priority' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'remaining', label: 'Remaining' },
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
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  filterWarehouse: string;
  onFilterWarehouseChange: (value: string) => void;
  statusOptions: { value: string; label: string }[];
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
  branchName: string;
  branches: Branch[];
  txnBranchName?: string;
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
    filterStatus,
    onFilterStatusChange,
    filterWarehouse,
    onFilterWarehouseChange,
    statusOptions,
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
    branchName,
    branches,
    txnBranchName,
  } = props;

  const isVerificationTab = tab === 'awaiting_verification';
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_VISIBILITY);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const tabs: { id: SalesTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Sales', count: tabCounts.all },
    { id: 'needs_action', label: 'Needs Action', count: tabCounts.needsAction },
    { id: 'awaiting_verification', label: 'Awaiting Verification', count: tabCounts.awaitingVerification },
  ];

  const emptyMessage =
    tab === 'needs_action'
      ? 'No orders need admin action right now.'
      : tab === 'awaiting_verification'
        ? 'No orders awaiting delivery verification.'
        : 'No sales found.';

  const visibleColumnCount = useMemo(() => {
    let count = 2; // status + actions always visible
    if (isVerificationTab) count += 1;
    for (const key of Object.keys(columnVisibility) as (keyof ColumnVisibility)[]) {
      if (columnVisibility[key]) count += 1;
    }
    return count;
  }, [columnVisibility, isVerificationTab]);

  return (
    <div className="flex min-h-0 max-h-[calc(100dvh-14rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="shrink-0">
        <AsicTabBar
          tabs={tabs}
          activeTab={tab}
          onTabChange={id => onTabChange(id as SalesTab)}
          ariaLabel="Sales views"
        />

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search sales…"
          className="h-8 min-w-[160px] flex-1 rounded-md border border-slate-200 px-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
        />
        <select
          value={filterStatus}
          onChange={e => onFilterStatusChange(e.target.value)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="All">All statuses</option>
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={filterWarehouse}
          onChange={e => onFilterWarehouseChange(e.target.value)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="All">All warehouses</option>
          <option value="None">No warehouse</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        {isVerificationTab && selectedVerifyCount > 0 && (
          <button
            type="button"
            onClick={onBulkVerify}
            className="h-8 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white hover:bg-slate-800"
          >
            Verify selected ({selectedVerifyCount})
          </button>
        )}

        <div ref={columnsRef} className="relative ml-auto">
          <button
            type="button"
            onClick={() => setColumnsOpen(prev => !prev)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Columns
          </button>
          {columnsOpen && (
            <div className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[160px] rounded-md border border-slate-200 bg-white p-2 shadow-lg">
              {HIDEABLE_COLUMNS.map(col => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={columnVisibility[col.id]}
                    onChange={e =>
                      setColumnVisibility(prev => ({ ...prev, [col.id]: e.target.checked }))
                    }
                    className="size-3.5 rounded border-slate-300"
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {isVerificationTab && (
                <th className="px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={allVerifySelected}
                    onChange={onToggleSelectAllVerify}
                    className={verifyCheckboxClass}
                    aria-label="Select all orders for verification"
                  />
                </th>
              )}
              {columnVisibility.date && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Date" field="Date" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                </th>
              )}
              {columnVisibility.customer && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Customer" field="Customer" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                </th>
              )}
              {columnVisibility.handling && (
                <th className="px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Handling</th>
              )}
              {columnVisibility.units && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Units" field="Units" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="right" />
                </th>
              )}
              {columnVisibility.totalAed && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Total AED" field="Total AED" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="right" />
                </th>
              )}
              {columnVisibility.delivered && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Delivered" field="Delivered Units" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="right" />
                </th>
              )}
              {columnVisibility.remaining && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Remaining" field="Remaining Units" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="right" />
                </th>
              )}
              {columnVisibility.warehouse && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Warehouse" field="Warehouse" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                </th>
              )}
              {columnVisibility.priority && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Priority" field="Priority" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="center" />
                </th>
              )}
              {columnVisibility.status && (
                <th className="px-2.5 py-2">
                  <SortHeader label="Status" field="Status" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="center" />
                </th>
              )}
              <th className="px-2.5 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} className="px-3 py-10 text-center text-sm text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sales.map(s => (
                <SaleRow
                  key={s.id}
                  sale={s}
                  isVerificationTab={isVerificationTab}
                  columnVisibility={columnVisibility}
                  selectedVerifyIds={selectedVerifyIds}
                  onToggleVerify={onToggleVerify}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  getWarehouseName={getWarehouseName}
                  branchName={branchName}
                  branches={branches}
                  txnBranchName={txnBranchName}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SaleRow({
  sale: s,
  isVerificationTab,
  columnVisibility,
  selectedVerifyIds,
  onToggleVerify,
  onView,
  onEdit,
  onDelete,
  getWarehouseName,
  branchName,
  branches,
  txnBranchName,
}: {
  sale: ICSale;
  isVerificationTab: boolean;
  columnVisibility: ColumnVisibility;
  selectedVerifyIds: Set<string>;
  onToggleVerify: (id: string) => void;
  onView: (sale: ICSale) => void;
  onEdit: (sale: ICSale) => void;
  onDelete: (e: React.MouseEvent, sale: ICSale) => void;
  getWarehouseName: (id?: string) => string;
  branchName: string;
  branches: Branch[];
  txnBranchName?: string;
}) {
  const customerLabel = getAdminSaleCustomerName(s, branchName, branches);
  const branchHandled = isBranchHandledSale(s);
  const delivered = getDeliveredUnits(s.units, s.collectedUnits, s.orderStatus);
  const remaining = getRemainingUnits(s.units, s.collectedUnits, s.orderStatus);
  const accent =
    getAdminRowAccentClass(s.orderStatus, s.transactionType) ?? highPriorityRowClass(s.priority);

  return (
    <tr
      onClick={() => onView(s)}
      className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${accent}`}
    >
      {isVerificationTab && (
        <td className="px-2.5 py-2.5" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={selectedVerifyIds.has(s.id)}
            onChange={() => onToggleVerify(s.id)}
            className={verifyCheckboxClass}
            aria-label={`Select ${customerLabel} for verification`}
          />
        </td>
      )}
      {columnVisibility.date && (
        <td className="px-2.5 py-2.5">
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
      )}
      {columnVisibility.customer && (
        <td className="px-2.5 py-2.5">
          <div className="min-w-[120px]">
            <span className="text-sm font-medium text-slate-900">{customerLabel}</span>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <FulfillmentHandlerBadge sale={s} />
              {s.transactionType === 'by_hand' && <OutlineBadge tone="violet">By Hand</OutlineBadge>}
              {s.derivedFromSaleId && (
                <OutlineBadge tone="indigo">
                  Split · {getFormattedTxnId(s.derivedFromSaleId, 'sale', null, branches, txnBranchName)}
                </OutlineBadge>
              )}
            </div>
          </div>
        </td>
      )}
      {columnVisibility.handling && (
        <td className="px-2.5 py-2.5" onClick={e => e.stopPropagation()}>
          <FulfillmentHandlerControl sale={s} />
        </td>
      )}
      {columnVisibility.units && (
        <td className="px-2.5 py-2.5 text-right">
          <span className="font-mono text-sm text-slate-700">{s.units.toLocaleString()}</span>
        </td>
      )}
      {columnVisibility.totalAed && (
        <td className="px-2.5 py-2.5 text-right">
          <span className="font-mono text-sm font-medium text-slate-900">
            {(s.aedAmount || 0).toLocaleString()}
          </span>
        </td>
      )}
      {columnVisibility.delivered && (
        <td className="px-2.5 py-2.5 text-right">
          <span className="font-mono text-sm text-emerald-700">{delivered.toLocaleString()}</span>
        </td>
      )}
      {columnVisibility.remaining && (
        <td className="px-2.5 py-2.5 text-right">
          <span className={`font-mono text-sm ${remaining > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
            {remaining.toLocaleString()}
          </span>
        </td>
      )}
      {columnVisibility.warehouse && (
        <td className="px-2.5 py-2.5">
          <WarehouseCell sale={s} getWarehouseName={getWarehouseName} onEdit={onEdit} />
        </td>
      )}
      {columnVisibility.priority && (
        <td className="px-2.5 py-2.5 text-center" onClick={e => e.stopPropagation()}>
          {branchHandled ? (
            <span className="text-xs text-slate-500">{s.priority || 'Normal'}</span>
          ) : (
            <SalePriorityControl saleId={s.id} priority={s.priority} compact />
          )}
        </td>
      )}
      {columnVisibility.status && (
        <td className="px-2.5 py-2.5 text-center" onClick={e => e.stopPropagation()}>
          <AdminOrderStatusCard sale={s} />
        </td>
      )}
      <td className="px-2.5 py-2.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5">
          {!branchHandled && <AdminOrderWorkflowActions sale={s} />}
          <RowIconButton title="View" onClick={() => onView(s)}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </RowIconButton>
          {!branchHandled && (
            <>
              <RowIconButton title="Edit" onClick={() => onEdit(s)}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </RowIconButton>
              <RowIconButton title="Delete" onClick={e => onDelete(e, s)} danger>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </RowIconButton>
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
  onEdit,
}: {
  sale: ICSale;
  getWarehouseName: (id?: string) => string;
  onEdit: (sale: ICSale) => void;
}) {
  const branchHandled = isBranchHandledSale(s);
  if (s.warehouseId) {
    return <span className="text-sm text-slate-700">{getWarehouseName(s.warehouseId)}</span>;
  }
  if (branchHandled) {
    return <span className="text-xs italic text-teal-700">Branch managed</span>;
  }
  if (canAdminAccept(s.orderStatus)) {
    return <span className="text-xs text-slate-400">Awaiting acceptance</span>;
  }
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onEdit(s);
      }}
      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
    >
      Assign warehouse
    </button>
  );
}

function SortHeader({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  align = 'left',
}: {
  label: string;
  field: string;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex w-full items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500 hover:text-slate-800 ${
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      {label}
      <SortIcon direction={active ? sortOrder : false} />
    </button>
  );
}

function RowIconButton({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 ${
        danger ? 'hover:text-red-600' : 'hover:text-slate-700'
      }`}
    >
      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
        {children}
      </svg>
    </button>
  );
}
