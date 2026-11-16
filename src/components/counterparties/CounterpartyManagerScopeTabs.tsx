'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { useApp } from '@/context/AppContext';
import { listCounterpartyDealVouchersAction } from '@/app/actions/icFundsActions';
import { listDepositsByManagerAction } from '@/app/actions/branchDepositActions';
import {
  filterManagerCustomerSales,
  filterCounterpartyDeposits,
} from '@/lib/counterparties/counterpartyActivity';
import { counterpartyDetailPath } from '@/lib/counterparties/navigation';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { FmtLedgerAed, FmtLedgerAmount, fmtICDate } from '@/lib/icFunds/format';
import {
  formatDealTableAed,
  formatDealTableInr,
  formatDealTableSheetRate,
  formatDealTableSplitPaidAed,
  formatDealTableSplitPaidInr,
  formatSaleLineProfit,
  saleDealInr,
  saleDealSheetRate,
  saleTableDisplayAed,
} from '@/lib/icTransfer/dealTableDisplay';
import { indexSaleLineProfits } from '@/lib/icTransfer/dealProfit';
import { icSaleMainTableColumns } from '@/lib/icTransfer/dealTableColumns';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import JournalVoucherDetailModal from '@/components/ic-transfer/journal/JournalVoucherDetailModal';
import ViewSaleModal from '@/components/ic-transfer/sales/ViewSaleModal';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import {
  icfTableWrap,
  icfTd,
  icfTh,
  icfThAlign,
  icfTheadRow,
} from '@/components/ic-funds/ui';
import ICTransferDataTableShell, { icTdClass } from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import { asicCard } from '@/components/asic/ui';
import {
  sortDealJournals,
  warehouseJournalAccountDisplayName,
  warehouseJournalDealRef,
  warehouseJournalEntryLabel,
} from '@/lib/icTransfer/warehouseJournalLabels';
import { sortCounterpartySales } from '@/lib/icTransfer/detailTableSort';
import { voucherPostedTargetsCounterparty } from '@/lib/icFunds/voucherPostedNotify';
import { useOnIcFundsVoucherPosted } from '@/hooks/useOnIcFundsVoucherPosted';
import type { ICBranchDeposit, ICFundVoucher, ICSale } from '@/types';
import Link from 'next/link';

type TabId = 'deposits' | 'sales' | 'journals';

type Props = {
  managerId: string;
  range: DateFilterRange;
  branchSlug?: string;
  onDepositsLoaded?: (deposits: ICBranchDeposit[]) => void;
};

export default function CounterpartyManagerScopeTabs({
  managerId,
  range,
  branchSlug,
  onDepositsLoaded,
}: Props) {
  const { icSales, icWarehouses, icSuppliers, icPurchases } = useApp();
  const [tab, setTab] = useState<TabId>('deposits');
  const [search, setSearch] = useState('');
  const [deposits, setDeposits] = useState<ICBranchDeposit[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);
  const [journals, setJournals] = useState<ICFundVoucher[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [viewJournal, setViewJournal] = useState<ICFundVoucher | null>(null);
  const [viewSale, setViewSale] = useState<ICSale | null>(null);
  const [sortField, setSortField] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const icFundsSlug = branchSlug || HQ_IC_FUNDS_BRANCH_SLUG;

  const scopedSales = useMemo(
    () => filterManagerCustomerSales(icSales, managerId, icSuppliers, range),
    [icSales, managerId, icSuppliers, range],
  );

  const saleProfits = useMemo(
    () => indexSaleLineProfits({ purchases: icPurchases, sales: icSales, range }),
    [icPurchases, icSales, range],
  );

  const managerSalesColumns = useMemo(
  () => icSaleMainTableColumns('Customer', 'Customer').filter(c => c.id !== 'Actions'),
  [],
);

  const periodDeposits = useMemo(
    () => filterCounterpartyDeposits(deposits, range),
    [deposits, range],
  );

  const getWarehouseName = useCallback(
    (id?: string) => icWarehouses.find(w => w.id === id)?.name || '—',
    [icWarehouses],
  );

  const loadDeposits = useCallback(async () => {
    setDepositsLoading(true);
    try {
      const rows = await listDepositsByManagerAction({
        managerId,
        startDate: range.startDate,
        endDate: range.endDate,
      });
      setDeposits(rows);
      onDepositsLoaded?.(rows);
    } finally {
      setDepositsLoading(false);
    }
  }, [managerId, range.startDate, range.endDate, onDepositsLoaded]);

  const loadJournals = useCallback(async () => {
    setJournalsLoading(true);
    try {
      const rows = await listCounterpartyDealVouchersAction({
        counterpartyId: managerId,
        startDate: range.startDate ?? undefined,
        endDate: range.endDate ?? undefined,
        limit: 500,
      });
      setJournals(rows);
    } finally {
      setJournalsLoading(false);
    }
  }, [managerId, range.startDate, range.endDate]);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  useEffect(() => {
    void loadJournals();
  }, [loadJournals]);

  useOnIcFundsVoucherPosted(detail => {
    if (!voucherPostedTargetsCounterparty(detail, managerId)) return;
    void loadJournals();
    void loadDeposits();
  });

  const tabs = useMemo(
    () => [
      { id: 'deposits', label: 'Deposits', count: periodDeposits.length },
      { id: 'sales', label: 'Sales', count: scopedSales.length },
      {
        id: 'journals',
        label: 'Journals',
        count: journals.filter(v => v.status !== 'void').length,
      },
    ],
    [periodDeposits.length, scopedSales.length, journals],
  );

  const sortedSales = useMemo(
    () => sortCounterpartySales(scopedSales, sortField, sortOrder, getWarehouseName),
    [scopedSales, sortField, sortOrder, getWarehouseName],
  );

  const filteredJournals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = journals.filter(v => v.status !== 'void');
    const rows = !q
      ? active
      : active.filter(v => {
          const entry = warehouseJournalEntryLabel(v, icPurchases, icSales).toLowerCase();
          const deal = warehouseJournalDealRef(v, icPurchases, icSales).toLowerCase();
          return (
            entry.includes(q) ||
            deal.includes(q) ||
            v.notes.toLowerCase().includes(q) ||
            String(v.voucherNo).includes(q)
          );
        });
    return sortDealJournals(rows);
  }, [journals, search, icPurchases, icSales]);

  const filteredDeposits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return periodDeposits;
    return periodDeposits.filter(
      d =>
        (d.customerName || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q) ||
        String(d.amountAed).includes(q),
    );
  }, [periodDeposits, search]);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder(field === 'Date' ? 'desc' : 'asc');
      }
    },
    [sortField],
  );

  return (
    <>
      <div className={`${asicCard} min-h-0 flex-1`}>
        <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
          <AsicTabBar tabs={tabs} activeTab={tab} onTabChange={id => setTab(id as TabId)} />
        </div>

        {tab === 'deposits' ? (
          <ICTransferDataTableShell
            title="UAE branch deposits"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search customer, notes…"
            columns={[
              { id: 'Date', label: 'Date', align: 'left' },
              { id: 'Customer', label: 'Customer', align: 'left' },
              { id: 'Mode', label: 'Mode', align: 'left' },
              { id: 'AED', label: 'AED', align: 'right' },
            ]}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isEmpty={!depositsLoading && filteredDeposits.length === 0}
            emptyMessage="No deposits for this manager in the selected period."
          >
            {depositsLoading ? (
              <ASICTableRowsSkeleton rows={5} cols={4} />
            ) : (
              filteredDeposits.map(d => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className={icTdClass('left')}>
                    <span className="text-xs text-slate-800">{fmtICDate(d.depositDate)}</span>
                  </td>
                  <td className={icTdClass('left')}>
                    <CounterpartyLink
                      counterpartyId={d.customerId}
                      name={d.customerName || '—'}
                      branchSlug={branchSlug}
                    />
                  </td>
                  <td className={icTdClass('left')}>
                    <span className="text-xs uppercase text-slate-600">{d.settlementMode}</span>
                  </td>
                  <td className={icTdClass('right')}>
                    <FmtLedgerAed amount={d.amountAed} />
                  </td>
                </tr>
              ))
            )}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'sales' ? (
          <ICTransferDataTableShell
            title="Sales tagged with this manager"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search sales…"
            columns={managerSalesColumns}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isEmpty={scopedSales.length === 0}
            emptyMessage="No India sales for this manager's customers in the selected period."
          >
            {sortedSales.map(s => {
              const customerId = s.counterpartyId || s.orderCustomerId;
              const customerName = icSuppliers.find(c => c.id === customerId)?.name || '—';
              return (
                <tr
                  key={s.id}
                  onClick={() => setViewSale(s)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className={icTdClass('left')}>
                    <span className="text-xs text-slate-800">{fmtICDate(s.createdAt || '')}</span>
                  </td>
                  <td className={icTdClass('left')}>
                    {customerId ? (
                      <CounterpartyLink
                        counterpartyId={customerId}
                        name={customerName}
                        branchSlug={branchSlug}
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={icTdClass('left')}>
                    <WarehouseLink
                      warehouseId={s.warehouseId}
                      name={getWarehouseName(s.warehouseId)}
                      branchSlug={branchSlug}
                      stopPropagation
                    />
                  </td>
                  <td className={icTdClass('left')}>
                    <span className="text-xs font-medium text-slate-700">
                      {formatSettlementModeLabel(s.settlementMode, s.metalPaymentMethod)}
                    </span>
                  </td>
                  <td className={icTdClass('right')}>
                    <span className="font-mono tabular-nums">
                      {s.settlementMode === 'metal' ? '—' : (s.units ?? 0).toLocaleString()}
                    </span>
                  </td>
                  <td className={icTdClass('right')}>
                    <span className="font-mono tabular-nums text-amber-800">
                      {s.settlementMode === 'metal'
                        ? (s.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
                        : '—'}
                    </span>
                  </td>
                  <td className={icTdClass('right')}>
                    <span className="font-mono tabular-nums text-indigo-900">{formatDealTableInr(saleDealInr(s))}</span>
                  </td>
                  <td className={icTdClass('right')}>{formatDealTableSheetRate(saleDealSheetRate(s))}</td>
                  <td className={icTdClass('right')}>
                    <span className="font-mono tabular-nums">{formatDealTableAed(saleTableDisplayAed(s))}</span>
                  </td>
                  <td className={icTdClass('right')}>{formatDealTableSplitPaidInr(s)}</td>
                  <td className={icTdClass('right')}>{formatDealTableSplitPaidAed(s)}</td>
                  <td className={icTdClass('right')}>{formatSaleLineProfit(saleProfits.get(s.id))}</td>
                </tr>
              );
            })}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'journals' ? (
          <div className="p-3 sm:p-4">
            <div className="mb-3 max-w-md">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search journals…"
                className="w-full"
              />
            </div>
            <div className={icfTableWrap}>
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>Entry</th>
                    <th className={icfTh}>Deal</th>
                    <th className={icfTh}>Debit</th>
                    <th className={icfTh}>Credit</th>
                    <th className={icfThAlign('right')}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {journalsLoading ? (
                    <ASICTableRowsSkeleton rows={6} cols={6} />
                  ) : filteredJournals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>
                        No journals for this manager scope in the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map(row => (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setViewJournal(row)}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                      >
                        <td className={icfTd}>{fmtICDate(row.voucherDate || row.createdAt)}</td>
                        <td className={icfTd}>{warehouseJournalEntryLabel(row, icPurchases, icSales)}</td>
                        <td className={icfTd}>{warehouseJournalDealRef(row, icPurchases, icSales)}</td>
                        <td className={icfTd} onClick={e => e.stopPropagation()}>
                          <ICFundAccountLink
                            slug={icFundsSlug}
                            accountId={row.debitAccountId}
                            name={warehouseJournalAccountDisplayName(row.debitAccountName)}
                          />
                        </td>
                        <td className={icfTd} onClick={e => e.stopPropagation()}>
                          <ICFundAccountLink
                            slug={icFundsSlug}
                            accountId={row.creditAccountId}
                            name={warehouseJournalAccountDisplayName(row.creditAccountName)}
                          />
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          <FmtLedgerAmount amount={row.amount} book={row.book} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <JournalVoucherDetailModal
        open={!!viewJournal}
        voucher={viewJournal}
        onClose={() => setViewJournal(null)}
        icFundsSlug={icFundsSlug}
        branchSlug={branchSlug}
        purchases={icPurchases}
        sales={icSales}
      />
      <ViewSaleModal open={!!viewSale} sale={viewSale} onClose={() => setViewSale(null)} />
    </>
  );
}
