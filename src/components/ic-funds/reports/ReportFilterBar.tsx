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
  statementMode?: 'account' | 'manager';
  warehouseOptions?: EntitySearchOption[];
  counterpartyOptions?: EntitySearchOption[];
  statementBook?: 'aed' | 'inr';
  onStatementBook?: (book: 'aed' | 'inr') => void;
  showInrBookTab?: boolean;
  fundLedgerBook?: 'aed' | 'inr';
  onFundLedgerBook?: (book: 'aed' | 'inr') => void;
  showFundLedgerBookTab?: boolean;
};

const fieldCell = 'flex min-w-0 flex-col gap-1';
const controlSlot = 'min-h-8';

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
      <select id={id} className={`${icfInput} ${controlSlot}`} value={value} onChange={e => onChange(e.target.value as T)}>
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
  fundLedgerBook,
  onFundLedgerBook,
  showFundLedgerBookTab,
  statementMode = 'account',
}: ReportFilterBarProps) {
  const patch = (partial: Partial<ReportFilterState>) => onChange({ ...filters, ...partial });

  const showVoucherStatus =
    reportView === 'all-vouchers' || reportView === 'd-expenses' || (reportView === 'statement' && statementMode === 'account');
  const showExpenseKind = reportView === 'd-expenses';
  const showTradeFilters = reportView === 'fund-trades' || reportView === 'metal-trades';
  const showWarehouseFilter =
    reportView === 'warehouse-pl' || reportView === 'fund-trades' || reportView === 'metal-trades';
  const showPartyFilter =
    (reportView === 'statement' && statementMode === 'account') || reportView === 'fund-trades' || reportView === 'metal-trades';

  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);
  const showClear = activeCount > 0;

  const statementBookToggle =
    reportView === 'statement' && statementMode === 'account' && showInrBookTab && onStatementBook ? (
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

  const fundBookToggle =
    showFundLedgerBookTab && onFundLedgerBook ? (
      <ReportSegmentTabs
        label="Ledger book"
        value={fundLedgerBook ?? 'aed'}
        onChange={onFundLedgerBook}
        options={[
          { id: 'aed', label: 'AED' },
          { id: 'inr', label: 'INR' },
        ]}
      />
    ) : null;

  const bookToggle = statementBookToggle ?? fundBookToggle;

  const selectedAccountDetail =
    accountOptions?.find(o => o.value === (accountId ?? ''))?.detail?.trim() || '';

  const statementAccount =
    reportView === 'statement' && statementMode === 'account';

  const filterGridClass = statementAccount
    ? 'grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-12 xl:gap-x-3 xl:gap-y-3'
    : 'grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

  const showToolbar = Boolean(bookToggle || showClear || statementAccount);

  return (
    <div className="flex min-w-0 flex-col gap-0">
      <div className={filterGridClass}>
        <div className={`${fieldCell} ${statementAccount ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
          <label className={icfLabel} htmlFor="icf-report-search">
            Search
          </label>
          <div className={`relative min-w-0 ${controlSlot}`}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
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
          <div className={`${fieldCell} ${statementAccount ? 'sm:col-span-2 xl:col-span-4' : 'sm:col-span-2'}`}>
            <span className={icfLabel} id="icf-statement-account-label">
              Account or manager
            </span>
            <div className={controlSlot}>
              <EntitySearchSelect
                className="min-w-0 w-full"
                selectedId={accountId ?? ''}
                onSelectId={id => onAccountId(id)}
                options={accountOptions}
                placeholder="Search account or manager…"
                inputClassName={icfInput}
                showDetailLine={false}
              />
            </div>
            {statementAccount ? (
              <p
                className="min-h-[1.125rem] truncate text-[11px] text-slate-500 dark:text-[var(--theme-text-secondary)]"
                title={selectedAccountDetail || undefined}
                aria-live="polite"
              >
                {selectedAccountDetail || '\u00a0'}
              </p>
            ) : selectedAccountDetail ? (
              <p className="min-h-[1.125rem] truncate text-[11px] text-slate-500">{selectedAccountDetail}</p>
            ) : (
              <p className="min-h-[1.125rem]" aria-hidden>
                {'\u00a0'}
              </p>
            )}
          </div>
        ) : null}

        {showWarehouseFilter && warehouseOptions && warehouseOptions.length > 0 ? (
          <div className={fieldCell}>
            <span className={icfLabel}>Warehouse</span>
            <div className={controlSlot}>
              <EntitySearchSelect
                selectedId={filters.warehouseId}
                onSelectId={id => patch({ warehouseId: id })}
                options={[{ value: '', label: 'All warehouses', detail: '' }, ...warehouseOptions]}
                placeholder="All warehouses"
                inputClassName={icfInput}
                showDetailLine={false}
                className="w-full"
              />
            </div>
          </div>
        ) : null}

        {showPartyFilter && counterpartyOptions && counterpartyOptions.length > 0 ? (
          <div className={`${fieldCell} ${statementAccount ? 'xl:col-span-2' : ''}`}>
            <span className={icfLabel}>Party</span>
            <div className={controlSlot}>
              <EntitySearchSelect
                selectedId={filters.counterpartyId}
                onSelectId={id => patch({ counterpartyId: id })}
                options={[{ value: '', label: 'All parties', detail: '' }, ...counterpartyOptions]}
                placeholder="All parties"
                inputClassName={icfInput}
                showDetailLine={false}
                className="w-full"
              />
            </div>
          </div>
        ) : null}

        {showVoucherStatus ? (
          <SelectFilter<ReportVoucherStatusFilter>
            id="icf-voucher-status"
            label="Voucher status"
            value={filters.voucherStatus}
            onChange={v => patch({ voucherStatus: v })}
            className={statementAccount ? 'xl:col-span-3' : ''}
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
              options={[
                { value: 'all', label: 'All order states' },
                { value: 'open', label: 'Open orders' },
                { value: 'in_progress', label: 'In process' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
            <div className={fieldCell}>
              <span className={icfLabel} id="icf-include-void-label">
                Options
              </span>
              <label
                htmlFor="icf-include-void"
                className={`${controlSlot} flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--theme-border-field)] bg-white px-2.5 text-sm text-slate-700 dark:bg-[var(--theme-input-bg)] dark:text-[var(--theme-text)]`}
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
      </div>

      {showToolbar ? (
        <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 dark:border-[var(--theme-border-subtle)]">
          <div className="flex min-w-0 items-center">{bookToggle}</div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`min-w-[6.5rem] text-right text-[11px] font-medium tabular-nums text-slate-500 transition-opacity dark:text-[var(--theme-text-secondary)] ${
                activeCount > 0 ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden={activeCount === 0}
            >
              {activeCount} active
            </span>
            <button
              type="button"
              className={`${icfBtnGhost} disabled:pointer-events-none disabled:opacity-40`}
              disabled={!showClear}
              onClick={() => onChange({ ...DEFAULT_REPORT_FILTERS })}
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
