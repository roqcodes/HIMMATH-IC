'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { useApp } from '@/context/AppContext';
import { listCounterpartyDealVouchersAction } from '@/app/actions/icFundsActions';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import {
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
  purchaseDealAed,
  purchaseDealInr,
  saleDealInr,
  saleTableDisplayAed,
} from '@/lib/icTransfer/dealTableDisplay';
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
  type ICTransferTableColumn,
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
  warehouseJournalDealRef,
  warehouseJournalEntryLabel,
} from '@/lib/icTransfer/warehouseJournalLabels';
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import { asicCard } from '@/components/asic/ui';
import type { ICPurchase, ICSale, ICFundVoucher } from '@/types';

type TabId = 'all' | 'purchases' | 'sales' | 'journals';

const ACTIVITY_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'Type', label: 'Type', align: 'left' },
  { id: 'ID', label: 'ID', align: 'left' },
  { id: 'Warehouse', label: 'Warehouse', align: 'left' },
  { id: 'Book', label: 'Book', align: 'left' },
  { id: 'Qty', label: 'Qty', align: 'right' },
  { id: 'INR', label: 'INR', align: 'right' },
  { id: 'AED', label: 'AED', align: 'right' },
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

type Props = {
  counterpartyId: string;
  range: DateFilterRange;
  branchSlug?: string;
};

export default function CounterpartyDetailTabs({ counterpartyId, range, branchSlug }: Props) {
  const { icPurchases, icSales, icWarehouses } = useApp();
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

  const icFundsSlug = branchSlug || HQ_IC_FUNDS_BRANCH_SLUG;

  const getWarehouseName = useCallback(
    (id?: string) => icWarehouses.find(w => w.id === id)?.name || 'None',
    [icWarehouses],
  );

  const purchases = useMemo(
    () => filterCounterpartyPurchases(icPurchases, counterpartyId, range),
    [icPurchases, counterpartyId, range],
  );

  const sales = useMemo(
    () => filterCounterpartySales(icSales, counterpartyId, range),
    [icSales, counterpartyId, range],
  );

  const activity = useMemo(
    () => mergeCounterpartyActivity(purchases, sales, journals),
    [purchases, sales, journals],
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

  useEffect(() => {
    setJournalsLoaded(false);
    setJournals([]);
    void loadJournals();
  }, [loadJournals]);

  const tabs = useMemo(
    () => [
      { id: 'all', label: 'All', count: activity.length },
      { id: 'purchases', label: 'Purchases', count: purchases.length },
      { id: 'sales', label: 'Sales', count: sales.length },
      {
        id: 'journals',
        label: 'Journals',
        count: journalsLoaded ? journals.filter(v => v.status !== 'void').length : undefined,
      },
    ],
    [activity.length, purchases.length, sales.length, journals, journalsLoaded],
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
            String(v.voucherNo).includes(q) ||
            v.debitAccountName.toLowerCase().includes(q) ||
            v.creditAccountName.toLowerCase().includes(q)
          );
        });
    return sortDealJournals(rows);
  }, [journals, search, icPurchases, icSales]);

  const renderPurchaseRow = (p: ICPurchase, showType?: boolean) => {
    const metalPurchase = p.settlementMode === 'metal';
    const pay = p.metalPaymentMethod === 'AED' ? 'AED' : 'CASH';
    const bookLabel = metalPurchase ? (pay === 'AED' ? 'Metal · AED' : 'Metal · INR') : 'IC · AED';
    const qty = metalPurchase
      ? `${(p.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} g`
      : `${p.units.toLocaleString()} u`;
    const amountAed = formatDealTableAed(purchaseDealAed(p));

    return (
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
        <WarehouseLink
          warehouseId={p.warehouseId}
          name={getWarehouseName(p.warehouseId)}
          branchSlug={branchSlug}
          stopPropagation
        />
      </td>
      <td className={icTdClass('left')}>
        <span className="text-xs font-medium text-slate-700">{bookLabel}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums">{qty}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-indigo-900">{formatDealTableInr(purchaseDealInr(p))}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">{amountAed}</span>
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
  };

  const renderSaleRow = (s: ICSale, showType?: boolean) => {
    const metalSale = s.settlementMode === 'metal';
  const pay = s.metalPaymentMethod === 'AED' ? 'AED' : 'CASH';
  const bookLabel = metalSale ? (pay === 'AED' ? 'Metal · AED' : 'Metal · INR') : 'IC · AED';
  const qty = metalSale
    ? `${(s.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} g`
    : `${(s.units ?? 0).toLocaleString()} u`;
  const amountAed = formatDealTableAed(saleTableDisplayAed(s));

  return (
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
        <WarehouseLink
          warehouseId={s.warehouseId}
          name={getWarehouseName(s.warehouseId)}
          branchSlug={branchSlug}
          stopPropagation
        />
      </td>
      <td className={icTdClass('left')}>
        <span className="text-xs font-medium text-slate-700">{bookLabel}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums">{qty}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono tabular-nums text-indigo-900">{formatDealTableInr(saleDealInr(s))}</span>
      </td>
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">{amountAed}</span>
      </td>
      <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-0.5">
          <ICTransferViewIconButton onClick={() => setViewSale(s)} />
          <DealInvoiceIconButtons sale={s} />
          <ICTransferEditIconButton onClick={() => setEditSale(s)} />
        </div>
      </td>
    </tr>
    );
  };

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
          <span className="font-mono text-xs text-slate-500">#{v.voucherNo}</span>
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
          <span className="font-mono tabular-nums text-indigo-900">{amountInr}</span>
        </td>
        <td className={icTdClass('right')}>
          <span className="font-mono font-medium tabular-nums text-slate-900">{amountAed}</span>
        </td>
        <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
          <ICTransferViewIconButton onClick={() => setViewJournal(v)} />
        </td>
      </tr>
    );
  };

  const renderActivityRow = (row: CounterpartyActivityRow) =>
    row.kind === 'purchase'
      ? renderPurchaseRow(row.purchase, true)
      : row.kind === 'sale'
        ? renderSaleRow(row.sale, true)
        : renderVoucherRow(row.voucher);

  const journalTable = (
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
          ) : filteredJournals.length === 0 ? (
            <tr>
              <td colSpan={9} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>
                No AED or INR journals for this counterparty in the selected period.
              </td>
            </tr>
          ) : (
            filteredJournals.map(row => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => setViewJournal(row)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
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
                    <span>{row.debitAccountName}</span>
                  ) : (
                    <ICFundAccountLink
                      slug={icFundsSlug}
                      accountId={row.debitAccountId}
                      name={row.debitAccountName}
                    />
                  )}
                </td>
                <td className={icfTd} onClick={e => e.stopPropagation()}>
                  {row.book === 'INR' ? (
                    <span>{row.creditAccountName}</span>
                  ) : (
                    <ICFundAccountLink
                      slug={icFundsSlug}
                      accountId={row.creditAccountId}
                      name={row.creditAccountName}
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
            sortField="Date"
            sortOrder="desc"
            onSort={() => {}}
            isEmpty={activity.length === 0 && !journalsLoading}
            emptyMessage="No purchases, sales, payments, or receipts for this counterparty in the selected period."
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
            emptyMessage="No purchases for this counterparty in the selected period."
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
            emptyMessage="No sales for this counterparty in the selected period."
          >
            {sales.map(s => renderSaleRow(s))}
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
            {journalTable}
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
