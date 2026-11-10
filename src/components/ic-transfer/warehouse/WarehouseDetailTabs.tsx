'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { useApp } from '@/context/AppContext';
import { listWarehouseDealVouchersAction } from '@/app/actions/icFundsActions';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import DealAgentHint from '@/components/ic-transfer/shared/DealAgentHint';
import {
  filterWarehousePurchases,
  filterWarehouseSales,
  mergeWarehouseActivity,
  type WarehouseActivityRow,
} from '@/lib/icTransfer/warehouseActivity';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import type { ICTransferPortalMode } from '@/lib/icTransfer/branchPortalScope';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { fmtLedgerAmount, FmtLedgerAmount } from '@/lib/icFunds/format';
import {
  formatDealTableAed,
  formatDealTableInr,
  purchaseDealAed,
  purchaseDealInr,
  formatSaleLineProfit,
  saleDealInr,
  saleTableDisplayAed,
} from '@/lib/icTransfer/dealTableDisplay';
import { indexSaleLineProfits } from '@/lib/icTransfer/dealProfit';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import JournalVoucherDetailModal from '@/components/ic-transfer/journal/JournalVoucherDetailModal';
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
  type ICTransferTableColumn,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import { ICTransferEditIconButton, ICTransferViewIconButton } from '@/components/ic-transfer/shared/ICTransferTableActions';
import { DealInvoiceIconButtons } from '@/components/ic-transfer/invoice/DealInvoiceButtons';
import AddPurchaseModal from '@/components/ic-transfer/purchase/AddPurchaseModal';
import ViewPurchaseModal from '@/components/ic-transfer/purchase/ViewPurchaseModal';
import AddSaleModal from '@/components/ic-transfer/sales/AddSaleModal';
import ViewSaleModal from '@/components/ic-transfer/sales/ViewSaleModal';
import { getAdminSaleCustomerName } from '@/lib/icTransfer/branchOrderOwnership';
import { effectiveSaleCounterpartyId } from '@/lib/counterparties/effectiveId';
import {
  groupWarehouseDealJournals,
  warehouseJournalAccountDisplayName,
  warehouseJournalDealRef,
  warehouseJournalEntryLabel,
} from '@/lib/icTransfer/warehouseJournalLabels';
import { buildWarehouseLabTestRows } from '@/lib/icTransfer/labTest';
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import { asicCard } from '@/components/asic/ui';
import type { ICPurchase, ICSale, ICFundVoucher } from '@/types';

type TabId = 'all' | 'purchases' | 'sales' | 'labTests' | 'journals';

const ACTIVITY_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'Type', label: 'Type', align: 'left' },
  { id: 'ID', label: 'ID', align: 'left' },
  { id: 'Party', label: 'Party', align: 'left' },
  { id: 'Settlement', label: 'Settlement', align: 'left' },
  { id: 'Units', label: 'Units', align: 'right' },
  { id: 'Metal (g)', label: 'Metal (g)', align: 'right' },
  { id: 'INR', label: 'INR', align: 'right' },
  { id: 'AED', label: 'AED', align: 'right' },
  { id: 'Profit', label: 'Profit', align: 'right' },
  { id: 'Actions', label: 'Actions', align: 'center', sortable: false },
];

const PURCHASE_COLUMNS: ICTransferTableColumn[] = ACTIVITY_COLUMNS.filter(c => c.id !== 'Type');

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

function JournalAccountCell({
  row,
  side,
  icFundsSlug,
}: {
  row: ICFundVoucher;
  side: 'debit' | 'credit';
  icFundsSlug: string;
}) {
  const rawName = side === 'debit' ? row.debitAccountName : row.creditAccountName;
  const accountId = side === 'debit' ? row.debitAccountId : row.creditAccountId;
  const name = warehouseJournalAccountDisplayName(rawName);
  if (row.book === 'INR') return <span>{name}</span>;
  return <ICFundAccountLink slug={icFundsSlug} accountId={accountId} name={name} />;
}

type Props = {
  warehouseId: string;
  range: DateFilterRange;
  portalMode: ICTransferPortalMode;
  branchSlug: string;
  purchaseBranchId?: string;
};

export default function WarehouseDetailTabs({
  warehouseId,
  range,
  portalMode,
  branchSlug,
  purchaseBranchId,
}: Props) {
  const { icPurchases, icSales, icSuppliers, icWarehouses, branches } = useApp();
  const [tab, setTab] = useState<TabId>('all');
  const [search, setSearch] = useState('');
  const [journals, setJournals] = useState<ICFundVoucher[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalsLoaded, setJournalsLoaded] = useState(false);

  const [viewPurchase, setViewPurchase] = useState<ICPurchase | null>(null);
  const [editPurchase, setEditPurchase] = useState<ICPurchase | null>(null);
  const [viewSale, setViewSale] = useState<ICSale | null>(null);
  const [editSale, setEditSale] = useState<ICSale | null>(null);
  const [viewJournal, setViewJournal] = useState<ICFundVoucher | null>(null);

  const icFundsSlug =
    portalMode === 'admin' ? HQ_IC_FUNDS_BRANCH_SLUG : branchSlug || HQ_IC_FUNDS_BRANCH_SLUG;

  const warehouse = useMemo(
    () => icWarehouses.find(w => w.id === warehouseId),
    [icWarehouses, warehouseId],
  );

  const purchases = useMemo(
    () => filterWarehousePurchases(icPurchases, warehouseId, range),
    [icPurchases, warehouseId, range],
  );

  const sales = useMemo(
    () => filterWarehouseSales(icSales, warehouseId, range),
    [icSales, warehouseId, range],
  );

  const activity = useMemo(() => mergeWarehouseActivity(purchases, sales), [purchases, sales]);

  const saleProfits = useMemo(
    () =>
      indexSaleLineProfits({
        purchases: icPurchases,
        sales: icSales,
        range,
        warehouseId,
      }),
    [icPurchases, icSales, range, warehouseId],
  );

  const getSupplierName = useCallback(
    (id: string) => icSuppliers.find(s => s.id === id)?.name || '—',
    [icSuppliers],
  );

  const labRows = useMemo(
    () =>
      buildWarehouseLabTestRows(
        purchases,
        sales,
        p => getSupplierName(effectivePurchaseCounterpartyId(p) || p.supplierId || ''),
        s => getAdminSaleCustomerName(s, '', branches),
        (kind, id) => {
          if (kind === 'purchase') {
            const p = purchases.find(x => x.id === id);
            return p ? getFormattedTxnId(p.id, 'purchase', p) : id.slice(0, 8);
          }
          const s = sales.find(x => x.id === id);
          return s ? getFormattedTxnId(s.id, 'sale', s) : id.slice(0, 8);
        },
      ),
    [purchases, sales, getSupplierName, branches],
  );

  const loadJournals = useCallback(async () => {
    setJournalsLoading(true);
    try {
      const rows = await listWarehouseDealVouchersAction({
        warehouseId,
        startDate: range.startDate ?? undefined,
        endDate: range.endDate ?? undefined,
        limit: 500,
      });
      setJournals(rows);
      setJournalsLoaded(true);
    } finally {
      setJournalsLoading(false);
    }
  }, [warehouseId, range.startDate, range.endDate]);

  useEffect(() => {
    setJournalsLoaded(false);
    setJournals([]);
  }, [warehouseId, range.startDate, range.endDate]);

  useEffect(() => {
    if (tab === 'journals' && !journalsLoaded && !journalsLoading) {
      void loadJournals();
    }
  }, [tab, journalsLoaded, journalsLoading, loadJournals]);

  const tabs = useMemo(
    () => [
      { id: 'all', label: 'All', count: activity.length },
      { id: 'purchases', label: 'Purchases', count: purchases.length },
      { id: 'sales', label: 'Sales', count: sales.length },
      { id: 'labTests', label: 'Lab tests', count: labRows.length },
      {
        id: 'journals',
        label: 'Journals',
        count: journalsLoaded ? journals.filter(v => v.status !== 'void').length : undefined,
      },
    ],
    [activity.length, purchases.length, sales.length, labRows.length, journals, journalsLoaded],
  );

  const filteredJournalGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = journals.filter(v => v.status !== 'void');
    const rows = !q
      ? active
      : active.filter(v => {
          const entry = warehouseJournalEntryLabel(v, icPurchases, icSales).toLowerCase();
          const deal = warehouseJournalDealRef(v, icPurchases, icSales).toLowerCase();
          const debit = warehouseJournalAccountDisplayName(v.debitAccountName).toLowerCase();
          const credit = warehouseJournalAccountDisplayName(v.creditAccountName).toLowerCase();
          return (
            entry.includes(q) ||
            deal.includes(q) ||
            v.notes.toLowerCase().includes(q) ||
            String(v.voucherNo).includes(q) ||
            v.debitAccountName.toLowerCase().includes(q) ||
            v.creditAccountName.toLowerCase().includes(q) ||
            debit.includes(q) ||
            credit.includes(q)
          );
        });
    return groupWarehouseDealJournals(rows, icPurchases, icSales);
  }, [journals, search, icPurchases, icSales]);

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
        <span className="font-mono text-xs text-slate-500">{getFormattedTxnId(p.id, 'purchase', p)}</span>
      </td>
      <td className={icTdClass('left')}>
        <div className="min-w-[120px]">
          <CounterpartyLink
            counterpartyId={effectivePurchaseCounterpartyId(p)}
            name={getSupplierName(effectivePurchaseCounterpartyId(p) || '')}
            branchSlug={branchSlug || undefined}
            stopPropagation
          />
          <DealAgentHint deal={p} nameOf={getSupplierName} branchSlug={branchSlug || undefined} />
        </div>
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
        <span className="font-mono tabular-nums text-indigo-900 dark:text-indigo-300">
          {formatDealTableInr(purchaseDealInr(p))}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">
          {formatDealTableAed(purchaseDealAed(p))}
        </span>
      </td>
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
        <span className="font-mono text-xs text-slate-500">{getFormattedTxnId(s.id, 'sale', s)}</span>
      </td>
      <td className={icTdClass('left')}>
        <div className="min-w-[120px]">
          <CounterpartyLink
            counterpartyId={effectiveSaleCounterpartyId(s) || s.orderCustomerId}
            name={getAdminSaleCustomerName(s, '', branches)}
            branchSlug={branchSlug || undefined}
            stopPropagation
          />
          <DealAgentHint deal={s} nameOf={getSupplierName} branchSlug={branchSlug || undefined} />
        </div>
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
        <span className="font-mono tabular-nums text-indigo-900 dark:text-indigo-300">
          {formatDealTableInr(saleDealInr(s))}
        </span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">
          {formatDealTableAed(saleTableDisplayAed(s))}
        </span>
      </td>
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

  const renderActivityRow = (row: WarehouseActivityRow) =>
    row.kind === 'purchase' ? renderPurchaseRow(row.purchase, true) : renderSaleRow(row.sale, true);

  const journalTable = (
    <div className={icfTableWrap}>
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className={icfTheadRow}>
            <th className={icfTh}>Date</th>
            <th className={icfTh}>Deal</th>
            <th className={icfTh}>Summary</th>
            <th className={icfTh}>Book</th>
            <th className={icfTh}>Debit</th>
            <th className={icfTh}>Credit</th>
            <th className={icfThAlign('right')}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {journalsLoading ? (
            <ASICTableRowsSkeleton rows={6} cols={7} />
          ) : filteredJournalGroups.length === 0 ? (
            <tr>
              <td colSpan={7} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>
                No journals for this warehouse in the selected period.
              </td>
            </tr>
          ) : (
            filteredJournalGroups.map(group => (
              <React.Fragment key={group.key}>
                <tr className="border-t border-slate-200 bg-slate-50/90">
                  <td className={`${icfTd} py-2`}>
                    <DateCell iso={group.latestAt} />
                  </td>
                  <td className={`${icfTd} py-2 font-mono text-xs font-semibold text-slate-700`}>{group.dealRef}</td>
                  <td className={`${icfTd} py-2 text-sm font-semibold text-slate-900`} colSpan={5}>
                    {group.headline}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {group.lines.length} {group.lines.length === 1 ? 'line' : 'lines'}
                    </span>
                  </td>
                </tr>
                {group.lines.map(row => (
                  <tr
                    key={`${row.book ?? 'AED'}-${row.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setViewJournal(row)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setViewJournal(row);
                      }
                    }}
                    className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50/80 ${row.status === 'pending' ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className={icfTd} />
                    <td className={icfTd} />
                    <td className={`${icfTd} pl-6 text-xs text-slate-600`}>
                      <span className="font-medium text-slate-800">
                        {warehouseJournalEntryLabel(row, icPurchases, icSales)}
                      </span>
                      <span className="ml-2 font-mono text-[10px] tabular-nums text-slate-400">#{row.voucherNo}</span>
                      {row.status === 'pending' ? (
                        <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span>
                      ) : null}
                    </td>
                    <td className={icfTd}>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          row.book === 'INR' ? 'bg-indigo-50 text-indigo-800' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {row.book === 'INR' ? 'INR' : 'AED'}
                      </span>
                    </td>
                    <td className={icfTd} onClick={e => e.stopPropagation()}>
                      <JournalAccountCell row={row} side="debit" icFundsSlug={icFundsSlug} />
                    </td>
                    <td className={icfTd} onClick={e => e.stopPropagation()}>
                      <JournalAccountCell row={row} side="credit" icFundsSlug={icFundsSlug} />
                    </td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      <FmtLedgerAmount amount={row.amount} book={row.book} />
                    </td>
                  </tr>
                ))}
              </React.Fragment>
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
            title="Purchases & sales"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search activity…"
            columns={ACTIVITY_COLUMNS}
            sortField="Date"
            sortOrder="desc"
            onSort={() => {}}
            isEmpty={activity.length === 0}
            emptyMessage="No purchases or sales for this warehouse in the selected period."
          >
            {activity.map(renderActivityRow)}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'purchases' ? (
          <ICTransferDataTableShell
            title="Purchases"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search purchases…"
            columns={PURCHASE_COLUMNS}
            sortField="Date"
            sortOrder="desc"
            onSort={() => {}}
            isEmpty={purchases.length === 0}
            emptyMessage="No purchases for this warehouse in the selected period."
          >
            {purchases.map(p => renderPurchaseRow(p))}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'sales' ? (
          <ICTransferDataTableShell
            title="Sales"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search sales…"
            columns={PURCHASE_COLUMNS}
            sortField="Date"
            sortOrder="desc"
            onSort={() => {}}
            isEmpty={sales.length === 0}
            emptyMessage="No sales for this warehouse in the selected period."
          >
            {sales.map(s => renderSaleRow(s))}
          </ICTransferDataTableShell>
        ) : null}

        {tab === 'labTests' ? (
          <div className="p-3 sm:p-4">
            <div className={`${icfTableWrap} overflow-x-auto`}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className={icfTheadRow}>
                    {['Date', 'Type', 'Deal', 'Party', 'Lab (g)', 'Charge', 'Lab INR', 'Net INR'].map((h, i) => (
                      <th key={h} className={`${icfTh} ${i >= 4 ? icfThAlign('right') : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {labRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={`${icfTd} text-center text-slate-500`}>
                        No lab tests in this period.
                      </td>
                    </tr>
                  ) : (
                    labRows.map(row => (
                      <tr
                        key={`${row.dealKind}-${row.id}`}
                        className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                        onClick={() =>
                          row.dealKind === 'purchase'
                            ? setViewPurchase(purchases.find(p => p.id === row.id) || null)
                            : setViewSale(sales.find(s => s.id === row.id) || null)
                        }
                      >
                        <td className={icfTd}>
                          <DateCell iso={row.createdAt} />
                        </td>
                        <td className={icfTd}>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase ${
                              row.dealKind === 'purchase'
                                ? 'bg-sky-50 text-sky-800'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {row.dealKind}
                          </span>
                        </td>
                        <td className={`${icfTd} font-mono text-xs text-slate-500`}>{row.dealRef}</td>
                        <td className={icfTd}>{row.partyLabel}</td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.labWeightG.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {row.labChargeInrPerG.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums`}>
                          {formatDealTableInr(row.labTotalInr)}
                        </td>
                        <td className={`${icfTd} text-right font-mono tabular-nums text-indigo-900`}>
                          {formatDealTableInr(row.netInr)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
            {journalTable}
          </div>
        ) : null}
      </div>

      <JournalVoucherDetailModal
        open={!!viewJournal}
        voucher={viewJournal}
        onClose={() => setViewJournal(null)}
        icFundsSlug={icFundsSlug}
        portalMode={portalMode}
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
        branchId={purchaseBranchId}
        warehouses={warehouse ? [warehouse] : undefined}
        lockedWarehouseId={warehouseId}
      />
      <ViewSaleModal open={!!viewSale} sale={viewSale} onClose={() => setViewSale(null)} />
      <AddSaleModal
        open={!!editSale}
        onClose={() => setEditSale(null)}
        initialData={editSale || undefined}
        lockedWarehouseId={warehouseId}
      />
    </>
  );
}
