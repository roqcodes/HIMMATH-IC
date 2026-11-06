'use client';

import React, { useMemo } from 'react';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import type { EntitySearchOption } from '@/lib/icTransfer/entitySearchOptions';
import {
  DEFAULT_REPORT_FILTERS,
  type ReportExpenseKindFilter,
  type ReportFilterState,
  type ReportOrderStatusFilter,
  type ReportTradeTypeFilter,
  type ReportVoucherStatusFilter,
} from '@/lib/icFunds/reportFilters';
import type { ICFundsReportId } from '@/lib/icFunds/nav';
import { icfBtnGhost, icfInput, icfLabel } from '@/components/ic-funds/ui';
import { ReportSegmentTabs } from './reportShared';

export type ReportFilterBarProps = {
  reportView: ICFundsReportId;
  filters: ReportFilterState;
  onChange: (next: ReportFilterState) => void;
  accountOptions?: EntitySearchOption[];
  accountId?: string;
  onAccountId?: (id: string) => void;
  warehouseOptions?: EntitySearchOption[];
  counterpartyOptions?: EntitySearchOption[];
  statementBook?: 'aed' | 'inr';
  onStatementBook?: (book: 'aed' | 'inr') => void;
  showInrBookTab?: boolean;
};

const fieldCell = 'flex min-w-0 flex-col justify-end gap-1';

function SelectFilter<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`${fieldCell} ${className}`}>
      <label className={icfLabel} htmlFor={id}>
        {label}
      </label>
      <select id={id} className={icfInput} value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function countActiveFilters(filters: ReportFilterState): number {
  let n = 0;
  if (filters.search.trim()) n += 1;
  if (filters.warehouseId) n += 1;
  if (filters.counterpartyId) n += 1;
  if (filters.voucherStatus !== 'all') n += 1;
  if (filters.expenseKind !== 'all') n += 1;
  if (filters.tradeType !== 'all') n += 1;
  if (filters.orderStatus !== 'all') n += 1;
  if (filters.includeVoidOrders) n += 1;
  return n;
}

export default function ReportFilterBar({
  reportView,
  filters,
  onChange,
  accountOptions,
  accountId,
  onAccountId,
  warehouseOptions,
  counterpartyOptions,
  statementBook,
  onStatementBook,
  showInrBookTab,
}: ReportFilterBarProps) {
  const patch = (partial: Partial<ReportFilterState>) => onChange({ ...filters, ...partial });

  const showVoucherStatus =
    reportView === 'all-vouchers' || reportView === 'd-expenses' || reportView === 'statement';
  const showExpenseKind = reportView === 'd-expenses';
  const showTradeFilters = reportView === 'fund-trades' || reportView === 'metal-trades';
  const showWarehouseFilter =
    reportView === 'warehouse-pl' || reportView === 'fund-trades' || reportView === 'metal-trades';
  const showPartyFilter =
    reportView === 'statement' || reportView === 'fund-trades' || reportView === 'metal-trades';

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);
  const showClear = activeCount > 0;

  const bookToggle =
    reportView === 'statement' && showInrBookTab && onStatementBook ? (
      <ReportSegmentTabs
        label="Ledger book"
        value={statementBook ?? 'aed'}
        onChange={onStatementBook}
        options={[
          { id: 'aed', label: 'AED' },
          { id: 'inr', label: 'INR' },
        ]}
      />
    ) : null;

  const selectedAccountDetail =
    accountOptions?.find(o => o.value === (accountId ?? ''))?.detail?.trim() || '';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-nowrap items-end gap-3">
        <div className={`${fieldCell} min-w-[8rem] flex-1`}>
          <label className={icfLabel} htmlFor="icf-report-search">
            Search
          </label>
          <div className="relative min-w-0">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              id="icf-report-search"
              type="search"
              value={filters.search}
              onChange={e => patch({ search: e.target.value })}
              placeholder="Voucher, party, remark…"
              className={`${icfInput} !pl-9`}
              autoComplete="off"
            />
          </div>
        </div>

        {reportView === 'statement' && accountOptions && onAccountId ? (
          <div className={`${fieldCell} min-w-[10rem] flex-[1.5]`}>
            <span className={icfLabel}>Account</span>
            <div className="flex min-w-0 items-center gap-2">
              <EntitySearchSelect
                className="min-w-0 flex-1"
                selectedId={accountId ?? ''}
                onSelectId={id => onAccountId(id)}
                options={accountOptions}
                placeholder="Search account…"
                inputClassName={icfInput}
                showDetailLine={false}
              />
              {selectedAccountDetail ? (
                <span className="shrink-0 text-[11px] font-medium text-slate-500 dark:text-[var(--theme-text-secondary)]">
                  {selectedAccountDetail}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {showWarehouseFilter && warehouseOptions && warehouseOptions.length > 0 ? (
          <div className={`${fieldCell} w-44 min-w-[10rem] shrink-0`}>
            <span className={icfLabel}>Warehouse</span>
            <EntitySearchSelect
              selectedId={filters.warehouseId}
              onSelectId={id => patch({ warehouseId: id })}
              options={[{ value: '', label: 'All warehouses', detail: '' }, ...warehouseOptions]}
              placeholder="All"
              inputClassName={icfInput}
              showDetailLine={false}
            />
          </div>
        ) : null}

        {showPartyFilter && counterpartyOptions && counterpartyOptions.length > 0 ? (
          <div className={`${fieldCell} w-40 shrink-0`}>
            <span className={icfLabel}>Party</span>
            <EntitySearchSelect
              selectedId={filters.counterpartyId}
              onSelectId={id => patch({ counterpartyId: id })}
              options={[{ value: '', label: 'All parties', detail: '' }, ...counterpartyOptions]}
              placeholder="All"
              inputClassName={icfInput}
              showDetailLine={false}
            />
          </div>
        ) : null}

        {showVoucherStatus ? (
          <SelectFilter<ReportVoucherStatusFilter>
            id="icf-voucher-status"
            label="Voucher status"
            value={filters.voucherStatus}
            onChange={v => patch({ voucherStatus: v })}
            className="w-40 shrink-0"
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'posted', label: 'Posted' },
              { value: 'pending', label: 'Pending' },
              { value: 'void', label: 'Void / reversed' },
            ]}
          />
        ) : null}

        {showExpenseKind ? (
          <SelectFilter<ReportExpenseKindFilter>
            id="icf-expense-kind"
            label="Expense type"
            value={filters.expenseKind}
            onChange={v => patch({ expenseKind: v })}
            className="w-44 min-w-[10rem] shrink-0"
            options={[
              { value: 'all', label: 'All expenses' },
              { value: 'direct', label: 'Direct (COGS)' },
              { value: 'operating', label: 'Operating' },
            ]}
          />
        ) : null}

        {showTradeFilters ? (
          <>
            <SelectFilter<ReportTradeTypeFilter>
              id="icf-trade-type"
              label="Transaction"
              value={filters.tradeType}
              onChange={v => patch({ tradeType: v })}
              className="w-48 min-w-[11rem] shrink-0"
              options={[
                { value: 'all', label: 'Purchases & sales' },
                { value: 'purchase', label: 'Purchases only' },
                { value: 'sale', label: 'Sales / orders' },
              ]}
            />
            <SelectFilter<ReportOrderStatusFilter>
              id="icf-order-status"
              label="Order status"
              value={filters.orderStatus}
              onChange={v => patch({ orderStatus: v })}
              className="w-44 min-w-[10rem] shrink-0"
              options={[
                { value: 'all', label: 'All order states' },
                { value: 'open', label: 'Open orders' },
                { value: 'in_progress', label: 'In process' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
            <div className={`${fieldCell} w-44 min-w-[10rem] shrink-0`}>
              <span className={icfLabel} id="icf-include-void-label">
                Options
              </span>
              <label
                htmlFor="icf-include-void"
                className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-[var(--theme-border-field)] bg-white px-2.5 text-sm text-slate-700 dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)]"
              >
                <input
                  id="icf-include-void"
                  type="checkbox"
                  className="size-3.5 rounded border-slate-300"
                  checked={filters.includeVoidOrders}
                  onChange={e => patch({ includeVoidOrders: e.target.checked })}
                  aria-labelledby="icf-include-void-label"
                />
                <span className="truncate text-xs font-medium">Include cancelled</span>
              </label>
            </div>
          </>
        ) : null}

        {bookToggle ? <div className="flex h-8 shrink-0 items-center">{bookToggle}</div> : null}

        <div className="ml-auto flex h-8 shrink-0 items-center gap-2">
          {activeCount > 0 ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-secondary)]">
              {activeCount} active
            </span>
          ) : null}
          {showClear ? (
            <button
              type="button"
              className={icfBtnGhost}
              onClick={() => onChange({ ...DEFAULT_REPORT_FILTERS })}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
