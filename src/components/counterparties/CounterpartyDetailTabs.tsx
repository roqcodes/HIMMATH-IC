'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { useApp } from '@/context/AppContext';
import { listCounterpartyDealVouchersAction } from '@/app/actions/icFundsActions';
import {
  listDepositsByCustomerAction,
  repairCustomerDepositLedgersAction,
} from '@/app/actions/branchDepositActions';
import { repairCounterpartyMetalLedgersAction } from '@/app/actions/icFundsActions';
import {
  filterCounterpartyDeposits,
  filterCounterpartyPurchases,
  filterCounterpartySales,
  mergeCounterpartyActivity,
  type CounterpartyActivityRow,
} from '@/lib/counterparties/counterpartyActivity';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { fmtICDate, fmtLedgerAmount, FmtLedgerAmount } from '@/lib/icFunds/format';
import {
  formatDealTableAed,
  formatDealTableInr,
  formatDealTableSheetRate,
  formatDealTableSplitPaidAed,
  formatDealTableSplitPaidInr,
  formatSaleLineProfit,
  purchaseDealAed,
  purchaseDealInr,
  purchaseDealSheetRate,
  saleDealInr,
  saleDealSheetRate,
  saleTableDisplayAed,
} from '@/lib/icTransfer/dealTableDisplay';
import { indexSaleLineProfits } from '@/lib/icTransfer/dealProfit';
import { icCounterpartyDealTableColumns } from '@/lib/icTransfer/dealTableColumns';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import {
  icfTableWrap,
  icfTd,
  icfTh,
  icfThAlign,
  icfTheadRow,
} from '@/components/ic-funds/ui';
import ICTransferDataTableShell, {
  icTdClass,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import { ICTransferEditIconButton, ICTransferViewIconButton } from '@/components/ic-transfer/shared/ICTransferTableActions';
import { DealInvoiceIconButtons } from '@/components/ic-transfer/invoice/DealInvoiceButtons';
import AddPurchaseModal from '@/components/ic-transfer/purchase/AddPurchaseModal';
import ViewPurchaseModal from '@/components/ic-transfer/purchase/ViewPurchaseModal';
import AddSaleModal from '@/components/ic-transfer/sales/AddSaleModal';
import ViewSaleModal from '@/components/ic-transfer/sales/ViewSaleModal';
import JournalVoucherDetailModal from '@/components/ic-transfer/journal/JournalVoucherDetailModal';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';
import {
  sortDealJournals,
  warehouseJournalAccountDisplayName,
  warehouseJournalDealRef,
  warehouseJournalEntryLabel,
} from '@/lib/icTransfer/warehouseJournalLabels';
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import { asicCard } from '@/components/asic/ui';
import type { ICBranchDeposit, ICPurchase, ICSale, ICFundVoucher } from '@/types';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { voucherPostedTargetsCounterparty } from '@/lib/icFunds/voucherPostedNotify';
import { useOnIcFundsVoucherPosted } from '@/hooks/useOnIcFundsVoucherPosted';
import {
  sortCounterpartyActivity,
  sortCounterpartyPurchases,
  sortCounterpartySales,
} from '@/lib/icTransfer/detailTableSort';
import {
  augmentPartyJournalsWithMetalProfit,
  isPartyProfitMemoVoucher,
} from '@/lib/counterparties/counterpartyPartyJournals';

type TabId = 'all' | 'purchases' | 'sales' | 'deposits' | 'payments' | 'receipts' | 'journals';

const ACTIVITY_COLUMNS = icCounterpartyDealTableColumns(true);
const PURCHASE_COLUMNS = icCounterpartyDealTableColumns(false);

function DateCell({ iso }: { iso?: string }) {
  if (!iso) return <span className="text-slate-400">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-xs font-medium text-slate-800">
        {new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
      <div className="text-[10px] text-slate-400">
        {new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

type Props = {
  counterpartyId: string;
  range: DateFilterRange;
  branchSlug?: string;
  /** UAE branch deposit rows (customer wallets). */
  showDeposits?: boolean;
  onLedgerRepaired?: () => void;
};

export default function CounterpartyDetailTabs({
  counterpartyId,
  range,
  branchSlug,
  showDeposits = true,
  onLedgerRepaired,
}: Props) {
  const { icPurchases, icSales, icWarehouses, icBranches } = useApp();
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [journals, setJournals] = useState<ICFundVoucher[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalsLoaded, setJournalsLoaded] = useState(false);
  const [deposits, setDeposits] = useState<ICBranchDeposit[]>([]);
  const [depositsLoading, setDepositsLoading] = useState(false);

  const [viewPurchase, setViewPurchase] = useState<ICPurchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<ICPurchase | null>(null);
  const [viewSale, setViewSale] = useState<ICSale | null>(null);
  const [editSale, setEditSale] = useState<ICSale | null>(null);
  const [viewJournal, setViewJournal] = useState<ICFundVoucher | null>(null);

  const icFundsSlug = branchSlug || HQ_IC_FUNDS_BRANCH_SLUG;

  const getWarehouseName = useCallback(
    (id?: string) => icWarehouses.find(w => w.id === id)?.name || 'None',
    [icWarehouses],
  );

  const getBranchLockerName = useCallback(
    (deposit: ICBranchDeposit) => {
      const id = deposit.icBranchId || deposit.warehouseId || undefined;
      if (!id) return '—';
      return icBranches.find(b => b.id === id)?.name || icWarehouses.find(w => w.id === id)?.name || '—';
    },
    [icBranches, icWarehouses],
  );

  const getBranchLockerId = useCallback(
    (deposit: ICBranchDeposit) => deposit.icBranchId || deposit.warehouseId || undefined,
    [],
  );

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

  const purchases = useMemo(
    () => filterCounterpartyPurchases(icPurchases, counterpartyId, range),
    [icPurchases, counterpartyId, range],
  );

  const sales = useMemo(
    () => filterCounterpartySales(icSales, counterpartyId, range),
    [icSales, counterpartyId, range],
  );

  const periodDeposits = useMemo(
    () => (showDeposits ? filterCounterpartyDeposits(deposits, range) : []),
    [deposits, range, showDeposits],
  );

  const activity = useMemo(
    () => mergeCounterpartyActivity(purchases, sales, journals, periodDeposits),
    [purchases, sales, journals, periodDeposits],
  );

  const saleProfits = useMemo(
    () => indexSaleLineProfits({ purchases: icPurchases, sales: icSales, range }),
    [icPurchases, icSales, range],
  );

  const sortedActivity = useMemo(
    () => sortCounterpartyActivity(activity, sortField, sortOrder, getWarehouseName, saleProfits),
    [activity, sortField, sortOrder, getWarehouseName, saleProfits],
  );

  const sortedPurchases = useMemo(
    () => sortCounterpartyPurchases(purchases, sortField, sortOrder, getWarehouseName),
    [purchases, sortField, sortOrder, getWarehouseName],
  );

  const sortedSales = useMemo(
    () => sortCounterpartySales(sales, sortField, sortOrder, getWarehouseName, saleProfits),
    [sales, sortField, sortOrder, getWarehouseName, saleProfits],
  );

  const loadJournals = useCallback(async () => {
    setJournalsLoading(true);
    try {
      const rows = await listCounterpartyDealVouchersAction({
        counterpartyId,
        startDate: range.startDate ?? undefined,
        endDate: range.endDate ?? undefined,
        limit: 500,
      });
      setJournals(rows);
      setJournalsLoaded(true);
    } finally {
      setJournalsLoading(false);
    }
  }, [counterpartyId, range.startDate, range.endDate]);

  const loadDeposits = useCallback(async () => {
    if (!showDeposits) {
      setDeposits([]);
      return;
    }
    setDepositsLoading(true);
    try {
      const { repaired } = await repairCustomerDepositLedgersAction(counterpartyId);
      if (repaired > 0) {
        onLedgerRepaired?.();
        void loadJournals();
      }
      const rows = await listDepositsByCustomerAction({
        customerId: counterpartyId,
        startDate: range.startDate,
        endDate: range.endDate,
        limit: 500,
      });
      setDeposits(rows);
    } finally {
      setDepositsLoading(false);
    }
  }, [counterpartyId, range.startDate, range.endDate, showDeposits, onLedgerRepaired, loadJournals]);

  useEffect(() => {
    setJournalsLoaded(false);
    setJournals([]);
    void loadJournals();
  }, [loadJournals]);

  useEffect(() => {
    void repairCounterpartyMetalLedgersAction(counterpartyId).then(() => {
      onLedgerRepaired?.();
      void loadJournals();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync once per counterparty visit
  }, [counterpartyId]);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  useOnIcFundsVoucherPosted(detail => {
    if (!voucherPostedTargetsCounterparty(detail, counterpartyId)) return;
    void loadJournals();
    void loadDeposits();
  });

  const tabs = useMemo(() => {
    const base = [
      { id: 'all', label: 'All', count: activity.length },
      { id: 'purchases', label: 'Purchases', count: purchases.length },
      { id: 'sales', label: 'Sales', count: sales.length },
      {
        id: 'payments',
        label: 'Payments',
        count: journalsLoaded ? journals.filter(v => v.status !== 'void' && v.voucherType === 'payment').length : 0,
      },
      {
        id: 'receipts',
        label: 'Receipts',
        count: journalsLoaded ? journals.filter(v => v.status !== 'void' && v.voucherType === 'receipt').length : 0,
      },
    ];
    if (showDeposits) {
      base.push({ id: 'deposits', label: 'Deposits', count: periodDeposits.length });
    }
    base.push({
      id: 'journals',
      label: 'Journals',
      count: journalsLoaded ? journals.filter(v => v.status !== 'void').length : 0,
    });
    return base;
  }, [activity.length, purchases.length, sales.length, periodDeposits.length, journals, journalsLoaded, showDeposits]);

  const filteredJournals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const withProfit = augmentPartyJournalsWithMetalProfit(journals, sales, saleProfits, counterpartyId);
    const active = withProfit.filter(v => v.status !== 'void');
    const rows = !q
      ? active
      : active.filter(v => {
          const entry = warehouseJournalEntryLabel(v, icPurchases, icSales).toLowerCase();
          const deal = warehouseJournalDealRef(v, icPurchases, icSales).toLowerCase();
          return (
            entry.includes(q) ||
            deal.includes(q) ||
            v.notes.toLowerCase().includes(q) ||
            String(v.voucherNo).includes(q) ||
            v.debitAccountName.toLowerCase().includes(q) ||
            v.creditAccountName.toLowerCase().includes(q)
          );
        });
    return sortDealJournals(rows);
  }, [journals, search, icPurchases, icSales, sales, saleProfits, counterpartyId]);

  const renderPurchaseRow = (p: ICPurchase, showType?: boolean) => (
    <tr
      key={p.id}
      onClick={() => setViewPurchase(p)}
      className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80"
    >
      <td className={icTdClass('left')}>
        <DateCell iso={p.createdAt} />
      </td>
      {showType ? (
        <td className={icTdClass('left')}>
          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800">
            Purchase
          </span>
        </td>
      ) : null}
      <td className={icTdClass('left')}>
        <WarehouseLink
          warehouseId={p.warehouseId}
          name={getWarehouseName(p.warehouseId)}
          branchSlug={branchSlug}
          stopPropagation
        />
      </td>
      <td className={icTdClass('left')}>
        <span className="text-xs font-medium text-slate-700">
          {formatSettlementModeLabel(p.settlementMode, p.metalPaymentMethod)}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums">{p.settlementMode === 'metal' ? '—' : p.units.toLocaleString()}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-amber-800">
          {p.settlementMode === 'metal'
            ? (p.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
            : '—'}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-indigo-900">{formatDealTableInr(purchaseDealInr(p))}</span>
      </td>
      <td className={icTdClass('right')}>{formatDealTableSheetRate(purchaseDealSheetRate(p))}</td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">
          {formatDealTableAed(purchaseDealAed(p))}
        </span>
      </td>
      <td className={icTdClass('right')}>{formatDealTableSplitPaidInr(p)}</td>
      <td className={icTdClass('right')}>{formatDealTableSplitPaidAed(p)}</td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-0.5">
          <ICTransferViewIconButton onClick={() => setViewPurchase(p)} />
          <DealInvoiceIconButtons purchase={p} />
          <ICTransferEditIconButton onClick={() => setEditPurchase(p)} />
        </div>
      </td>
    </tr>
  );

  const renderSaleRow = (s: ICSale, showType?: boolean) => (
    <tr
      key={s.id}
      onClick={() => setViewSale(s)}
      className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80"
    >
      <td className={icTdClass('left')}>
        <DateCell iso={s.createdAt} />
      </td>
      {showType ? (
        <td className={icTdClass('left')}>
          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
            Sale
          </span>
        </td>
      ) : null}
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
        <span className="font-mono tabular-nums">{s.settlementMode === 'metal' ? '—' : (s.units ?? 0).toLocaleString()}</span>
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
        <span className="font-mono font-medium tabular-nums text-slate-900">
          {formatDealTableAed(saleTableDisplayAed(s))}
        </span>
      </td>
      <td className={icTdClass('right')}>{formatDealTableSplitPaidInr(s)}</td>
      <td className={icTdClass('right')}>{formatDealTableSplitPaidAed(s)}</td>
      <td className={icTdClass('right')}>{formatSaleLineProfit(saleProfits.get(s.id))}</td>
      <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-0.5">
          <ICTransferViewIconButton onClick={() => setViewSale(s)} />
          <DealInvoiceIconButtons sale={s} />
          <ICTransferEditIconButton onClick={() => setEditSale(s)} />
        </div>
      </td>
    </tr>
  );

  const renderDepositRow = (d: ICBranchDeposit, showType?: boolean) => (
    <tr key={d.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
      <td className={icTdClass('left')}>
        <DateCell iso={d.depositDate || d.createdAt} />
      </td>
      {showType ? (
        <td className={icTdClass('left')}>
          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800">
            Deposit
          </span>
        </td>
      ) : null}
      <td className={icTdClass('left')}>
        <WarehouseLink
          warehouseId={getBranchLockerId(d)}
          name={getBranchLockerName(d)}
          branchSlug={branchSlug}
          detailKind="branch"
          stopPropagation
        />
      </td>
      <td className={icTdClass('left')}>
        <span className="text-xs font-medium text-slate-700">
          {d.settlementMode === 'metal' ? 'Metal · AED wallet' : 'Cash · AED wallet'}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-amber-800">
          {d.settlementMode === 'metal' && d.metalWeightG != null
            ? d.metalWeightG.toLocaleString('en-US', { maximumFractionDigits: 4 })
            : '—'}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">
          <FmtLedgerAed amount={d.amountAed} />
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="text-slate-400">—</span>
      </td>
      <td className={icTdClass('center')}>
        <span className="text-slate-400">—</span>
      </td>
    </tr>
  );

  const renderVoucherRow = (v: ICFundVoucher) => {
    const typeLabel =
      v.voucherType === 'payment' ? 'Payment' : v.voucherType === 'receipt' ? 'Receipt' : 'Journal';
    const typeClass =
      v.voucherType === 'payment'
        ? 'bg-rose-50 text-rose-800'
        : v.voucherType === 'receipt'
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-700';
    const amountAed = v.book === 'INR' ? '—' : formatDealTableAed(v.amount);
    const amountInr = v.book === 'INR' ? formatDealTableInr(v.amount) : '—';
    const dateIso = v.createdAt || v.voucherDate;

    return (
      <tr
        key={v.id}
        onClick={() => setViewJournal(v)}
        className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80"
      >
        <td className={icTdClass('left')}>
          <DateCell iso={dateIso} />
        </td>
        <td className={icTdClass('left')}>
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${typeClass}`}>
            {typeLabel}
          </span>
        </td>
        <td className={icTdClass('left')}>
          <span className="text-xs text-slate-400">—</span>
        </td>
        <td className={icTdClass('left')}>
          <span className="text-xs font-medium text-slate-700">{v.book === 'INR' ? 'INR' : 'AED'}</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="text-slate-400">—</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="text-slate-400">—</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="font-mono tabular-nums text-indigo-900">{amountInr}</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="text-slate-400">—</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="font-mono font-medium tabular-nums text-slate-900">{amountAed}</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="text-slate-400">—</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="text-slate-400">—</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="text-slate-400">—</span>
        </td>
        <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
          <ICTransferViewIconButton onClick={() => setViewJournal(v)} />
        </td>
      </tr>
    );
  };

  const renderActivityRow = (row: CounterpartyActivityRow) => {
    if (row.kind === 'purchase') return renderPurchaseRow(row.purchase, true);
    if (row.kind === 'sale') return renderSaleRow(row.sale, true);
    if (row.kind === 'deposit') return renderDepositRow(row.deposit, true);
    return renderVoucherRow(row.voucher);
  };

  const journalTable = (rows: ICFundVoucher[], emptyMessage: string) => (
    <div className={icfTableWrap}>
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className={icfTheadRow}>
            <th className={icfTh}>Date</th>
            <th className={icfTh}>Book</th>
            <th className={icfTh}>#</th>
            <th className={icfTh}>Entry</th>
            <th className={icfTh}>Deal</th>
            <th className={icfTh}>Debit</th>
            <th className={icfTh}>Credit</th>
            <th className={icfThAlign('right')}>Amount</th>
            <th className={icfTh}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {journalsLoading ? (
            <ASICTableRowsSkeleton rows={6} cols={9} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={9} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>{emptyMessage}</td>
            </tr>
          ) : (
            rows.map(row => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isPartyProfitMemoVoucher(row.id)) return;
                  setViewJournal(row);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isPartyProfitMemoVoucher(row.id)) return;
                    setViewJournal(row);
                  }
                }}
                className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${row.status === 'pending' ? 'bg-amber-50/40' : ''}`}
              >
                <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.voucherDate)}</td>
                <td className={icfTd}>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      row.book === 'INR' ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {row.book === 'INR' ? 'INR' : 'AED'}
                  </span>
                </td>
                <td className={`${icfTd} font-mono tabular-nums text-slate-500`}>
                  {row.voucherNo}
                  {row.status === 'pending' ? (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span>
                  ) : null}
                </td>
                <td className={`${icfTd} text-xs font-medium text-slate-800`}>
                  {warehouseJournalEntryLabel(row, icPurchases, icSales)}
                </td>
                <td className={`${icfTd} font-mono text-xs text-slate-600`}>
                  {warehouseJournalDealRef(row, icPurchases, icSales)}
                </td>
                <td className={icfTd} onClick={e => e.stopPropagation()}>
                  {row.book === 'INR' ? (
                    <span>{warehouseJournalAccountDisplayName(row.debitAccountName)}</span>
                  ) : (
                    <ICFundAccountLink
                      slug={icFundsSlug}
                      accountId={row.debitAccountId}
                      name={warehouseJournalAccountDisplayName(row.debitAccountName)}
                    />
                  )}
                </td>
                <td className={icfTd} onClick={e => e.stopPropagation()}>
                  {row.book === 'INR' ? (
                    <span>{warehouseJournalAccountDisplayName(row.creditAccountName)}</span>
                  ) : (
                    <ICFundAccountLink
                      slug={icFundsSlug}
                      accountId={row.creditAccountId}
                      name={warehouseJournalAccountDisplayName(row.creditAccountName)}
                    />
                  )}
                </td>
                <td className={`${icfTd} text-right font-mono tabular-nums`}>
                  <FmtLedgerAmount amount={row.amount} book={row.book} />
                </td>
                <td className={`${icfTd} max-w-[14rem] truncate text-slate-500`}>{row.notes || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className={`${asicCard} min-h-0 flex-1`}>
        <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
          <AsicTabBar tabs={tabs} activeTab={tab} onTabChange={id => setTab(id as TabId)} />
        </div>

        {tab === 'all' ? (
          <ICTransferDataTableShell
            title="Purchases, sales & settlements"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search activity…"
            columns={ACTIVITY_COLUMNS}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isEmpty={activity.length === 0 && !journalsLoading && !depositsLoading}
            emptyMessage="No purchases, sales, deposits, payments, or receipts for this counterparty in the selected period."
          >
            {sortedActivity.map(renderActivityRow)}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'purchases' ? (
          <ICTransferDataTableShell
            title="Purchases"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search purchases…"
            columns={PURCHASE_COLUMNS}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isEmpty={purchases.length === 0}
            emptyMessage="No purchases for this counterparty in the selected period."
          >
            {sortedPurchases.map(p => renderPurchaseRow(p))}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'deposits' && showDeposits ? (
          <ICTransferDataTableShell
            title="UAE branch deposits"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search deposits…"
            columns={PURCHASE_COLUMNS}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isEmpty={!depositsLoading && periodDeposits.length === 0}
            emptyMessage="No branch deposits crediting this customer in the selected period."
          >
            {depositsLoading ? (
              <ASICTableRowsSkeleton rows={5} cols={PURCHASE_COLUMNS.length} />
            ) : (
              periodDeposits.map(d => renderDepositRow(d))
            )}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'sales' ? (
          <ICTransferDataTableShell
            title="Sales"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search sales…"
            columns={PURCHASE_COLUMNS}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            isEmpty={sales.length === 0}
            emptyMessage="No sales for this counterparty in the selected period."
          >
            {sortedSales.map(s => renderSaleRow(s))}
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
            {journalTable(
              filteredJournals,
              'No AED or INR journals for this counterparty in the selected period.',
            )}
          </div>
        ) : null}

        {tab === 'payments' ? (
          <div className="p-3 sm:p-4">
            <div className="mb-3 max-w-md">
              <SearchInput value={search} onChange={setSearch} placeholder="Search paymentsâ€¦" className="w-full" />
            </div>
            {journalTable(
              filteredJournals.filter(v => v.voucherType === 'payment'),
              'No payments for this counterparty in the selected period.',
            )}
          </div>
        ) : null}

        {tab === 'receipts' ? (
          <div className="p-3 sm:p-4">
            <div className="mb-3 max-w-md">
              <SearchInput value={search} onChange={setSearch} placeholder="Search receiptsâ€¦" className="w-full" />
            </div>
            {journalTable(
              filteredJournals.filter(v => v.voucherType === 'receipt'),
              'No receipts for this counterparty in the selected period.',
            )}
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
        onViewPurchase={setViewPurchase}
        onViewSale={setViewSale}
      />
      <ViewPurchaseModal open={!!viewPurchase} purchase={viewPurchase} onClose={() => setViewPurchase(null)} />
      <AddPurchaseModal
        open={!!editPurchase}
        onClose={() => setEditPurchase(null)}
        initialData={editPurchase || undefined}
      />
      <ViewSaleModal open={!!viewSale} sale={viewSale} onClose={() => setViewSale(null)} />
      <AddSaleModal
        open={!!editSale}
        onClose={() => setEditSale(null)}
        initialData={editSale || undefined}
      />
    </>
  );
}
