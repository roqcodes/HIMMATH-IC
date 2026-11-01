'use client';

import React from 'react';
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import { icSectionCardClass, icThSortableClass, icTdClass } from '@/components/ic-transfer/ui/tableStyles';
import type { TableCellAlign } from '@/lib/tableCellAlign';
import { SortIcon } from '@/components/ic-transfer/sales/sales-icons';
import { portalMobileCardListClass } from '@/lib/icTransfer/layoutConstants';

export type ICTransferTableColumn = {
  id: string;
  label: string;
  align?: TableCellAlign;
  sortable?: boolean;
};

export function ICTransferTableFilterSelect({
  value,
  onChange,
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={`h-9 min-w-[9rem] rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-sm outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-200 ${className}`}
    >
      {children}
    </select>
  );
}

function SortableHeader({
  column,
  sortField,
  sortOrder,
  onSort,
}: {
  column: ICTransferTableColumn;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const align = column.align ?? 'left';
  const sortable = column.sortable !== false && column.id !== 'Actions';
  const active = sortField === column.id;

  if (!sortable) {
    return <span className="sr-only">{column.label || 'Actions'}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onSort(column.id)}
      className={`inline-flex w-full items-center gap-1 ${
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
      }`}
    >
      <span>{column.label}</span>
      <SortIcon direction={active ? sortOrder : false} />
    </button>
  );
}

type Props = {
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  tabs?: React.ReactNode;
  columns: ICTransferTableColumn[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
  emptyMessage?: string;
  minWidth?: string;
  headerLeading?: React.ReactNode;
  children: React.ReactNode;
  mobileView?: React.ReactNode;
  className?: string;
  isEmpty?: boolean;
};

export default function ICTransferDataTableShell({
  title,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  toolbarEnd,
  tabs,
  columns,
  sortField,
  sortOrder,
  onSort,
  emptyMessage = 'No records found.',
  minWidth = '880px',
  headerLeading,
  children,
  mobileView,
  className = '',
  isEmpty = false,
}: Props) {
  const colSpan = columns.length + (headerLeading ? 1 : 0);

  return (
    <div
      className={`flex min-h-0 max-h-[calc(100dvh-14rem)] flex-col overflow-hidden ${icSectionCardClass} ${className}`}
    >
      {tabs ? <div className="shrink-0 border-b border-slate-200">{tabs}</div> : null}

      <div className="shrink-0 border-b border-slate-200 px-3 py-2.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="shrink-0 text-sm font-semibold text-slate-900">{title}</h3>
            {toolbarEnd ? <div className="shrink-0">{toolbarEnd}</div> : null}
          </div>
          <div className="flex w-full flex-row items-center gap-2">
            <SearchInput
              value={search}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1"
            />
            {filters ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{filters}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className={`hidden w-full border-collapse text-left text-sm md:table`} style={{ minWidth }}>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {headerLeading ? <th className={icThSortableClass('left')}>{headerLeading}</th> : null}
              {columns.map(col => (
                <th key={col.id} className={icThSortableClass(col.align ?? 'left')}>
                  <SortableHeader
                    column={col}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={onSort}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isEmpty ? (
              <tr>
                <td colSpan={colSpan} className={`${icTdClass('center')} py-10 text-slate-400`}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>

        {mobileView ? (
          <div className={`md:hidden ${portalMobileCardListClass}`}>{mobileView}</div>
        ) : null}
      </div>
    </div>
  );
}

export { icTdClass };
