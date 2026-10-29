'use client';

import React from 'react';
import { icfTableWrap } from '@/components/ic-funds/ui';
import { icThClass, icRowLabelClass, icTdClass, inferTableColumnAligns } from './tableStyles';
import type { TableCellAlign } from '@/lib/tableCellAlign';
import SectionCard from './SectionCard';
import SearchInput from './SearchInput';
import {
  portalMobileCardListClass,
} from '@/lib/icTransfer/layoutConstants';

type Props = {
  title: string;
  columns: string[];
  data?: any[][];
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  minWidth?: string;
  children?: React.ReactNode;
  onHeaderClick?: (column: string) => void;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  mobileView?: React.ReactNode;
  headerCellContent?: Partial<Record<string, React.ReactNode>>;
  /** Per-column alignment; defaults inferred from header labels. */
  columnAlign?: TableCellAlign[];
};

export default function DataTableSection({
  title,
  columns,
  data,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  toolbar,
  emptyMessage = 'No records yet.',
  minWidth = '900px',
  children,
  onHeaderClick,
  sortField,
  sortOrder,
  mobileView,
  headerCellContent,
  columnAlign,
}: Props) {
  const showSearch = searchValue !== undefined && onSearchChange !== undefined;
  const tableVisibility = mobileView ? 'hidden md:block' : '';
  const aligns = columnAlign ?? inferTableColumnAligns(columns);

  return (
    <SectionCard>
      <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between md:px-3 md:py-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h3 className="shrink-0 text-sm font-medium text-slate-900">{title}</h3>
          {showSearch && (
            <SearchInput
              value={searchValue}
              onChange={onSearchChange}
              placeholder={searchPlaceholder}
              className="min-w-0 max-sm:w-full flex-1 sm:max-w-xs"
            />
          )}
        </div>
        {toolbar ? <div className="ml-auto shrink-0">{toolbar}</div> : null}
      </div>
      <div className="pb-1">
        <div className={`${icfTableWrap} ${tableVisibility}`}>
          <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                {columns.map((col, colIndex) => {
                  const isSorted = sortField && col.toLowerCase().replace(/\s/g, '') === sortField.toLowerCase().replace(/\s/g, '');
                  const align = aligns[colIndex] ?? 'left';
                  return (
                    <th
                      key={col}
                      className={`${icThClass(align)} ${onHeaderClick ? 'cursor-pointer select-none hover:text-slate-800' : ''}`}
                      onClick={() => onHeaderClick?.(col)}
                    >
                      {headerCellContent?.[col] ?? (
                        <div
                          className={`flex items-center gap-1 ${
                            align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
                          }`}
                        >
                          <span>{col}</span>
                          {isSorted && (
                            <span className="text-[10px] text-slate-400">
                              {sortOrder === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {children || (data && data.length > 0 ? (
                data.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                    {row.map((cell, j) => (
                      <td key={j} className={icTdClass(aligns[j] ?? 'left')}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="py-6 text-center text-sm text-slate-500">
                    {emptyMessage}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mobileView ? <div className={portalMobileCardListClass}>{mobileView}</div> : null}
      </div>
    </SectionCard>
  );
}

export { icRowLabelClass, icTdClass, inferTableColumnAligns };
