'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsicTabBar from '@/components/asic/AsicTabBar';
import {
  listBranchDeskVouchersAction,
  listLocationPartyVouchersAction,
} from '@/app/actions/icFundsActions';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { FmtLedgerAmount } from '@/lib/icFunds/format';
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
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import { asicCard } from '@/components/asic/ui';
import {
  groupWarehouseDealJournals,
  warehouseJournalAccountDisplayName,
  warehouseJournalDealRef,
  warehouseJournalEntryLabel,
} from '@/lib/icTransfer/warehouseJournalLabels';
import BranchDetailDepositsPanel, {
  type BranchDetailContentTab,
  type BranchDepositModeTab,
} from '@/components/ic-transfer/branch/BranchDetailDepositsPanel';
import BranchDetailAllEntriesPanel from '@/components/ic-transfer/branch/BranchDetailAllEntriesPanel';
import LocationPartyPrVouchersPanel from '@/components/ic-transfer/shared/LocationPartyPrVouchersPanel';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import type { ICBranchDeposit, ICFundVoucher } from '@/types';

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
  return <ICFundAccountLink slug={icFundsSlug} accountId={accountId} name={name} />;
}

type Props = {
  icBranchId: string;
  branchSlug: string;
  range: DateFilterRange;
  rangeLabel: string;
  refreshToken?: number;
  onDepositsLoaded?: (deposits: ICBranchDeposit[]) => void;
  modeTab?: BranchDetailContentTab;
  onModeTabChange?: (tab: BranchDetailContentTab) => void;
  depositModeCounts?: { all: number; cash: number; metal: number };
  canDelete?: boolean;
  onDeleted?: () => void;
};

export default function BranchDetailTabs({
  icBranchId,
  branchSlug,
  range,
  rangeLabel,
  refreshToken,
  onDepositsLoaded,
  modeTab,
  onModeTabChange,
  canDelete,
  onDeleted,
  depositModeCounts,
}: Props) {
  const [tabInternal, setTabInternal] = useState<BranchDetailContentTab>('all');
  const isDepositTab = (t: BranchDetailContentTab): t is BranchDepositModeTab =>
    t === 'all' || t === 'cash' || t === 'metal';
  const depositModeTab: BranchDepositModeTab = (() => {
    const active = modeTab ?? tabInternal;
    if (isDepositTab(active)) return active;
    if (isDepositTab(tabInternal)) return tabInternal;
    return 'all';
  })();
  const viewTab: BranchDetailContentTab = modeTab ?? tabInternal;
  const setViewTab = (next: BranchDetailContentTab) => {
    onModeTabChange?.(next);
    if (modeTab === undefined) setTabInternal(next);
  };
  const [search, setSearch] = useState('');
  const [journals, setJournals] = useState<ICFundVoucher[]>([]);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalsLoaded, setJournalsLoaded] = useState(false);
  const [viewJournal, setViewJournal] = useState<ICFundVoucher | null>(null);
  const [paymentCount, setPaymentCount] = useState<number | undefined>(undefined);
  const [receiptCount, setReceiptCount] = useState<number | undefined>(undefined);

  const icFundsSlug = branchSlug || HQ_IC_FUNDS_BRANCH_SLUG;

  const loadJournals = useCallback(async () => {
    setJournalsLoading(true);
    try {
      const rows = await listBranchDeskVouchersAction({
        icBranchId,
        startDate: range.startDate ?? undefined,
        endDate: range.endDate ?? undefined,
        limit: 500,
      });
      setJournals(rows);
      setJournalsLoaded(true);
    } finally {
      setJournalsLoading(false);
    }
  }, [icBranchId, range.startDate, range.endDate]);

  useEffect(() => {
    setJournalsLoaded(false);
    setJournals([]);
  }, [loadJournals]);

  useEffect(() => {
    if (viewTab === 'journals' && !journalsLoaded && !journalsLoading) {
      void loadJournals();
    }
  }, [viewTab, journalsLoaded, journalsLoading, loadJournals]);

  useEffect(() => {
    if (viewTab === 'journals' && journalsLoaded) {
      void loadJournals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when deposits change (ledger sync)
  }, [refreshToken]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const base = {
        icBranchId,
        startDate: range.startDate ?? undefined,
        endDate: range.endDate ?? undefined,
        limit: 500,
      };
      const [payments, receipts] = await Promise.all([
        listLocationPartyVouchersAction({ ...base, voucherType: 'payment' }),
        listLocationPartyVouchersAction({ ...base, voucherType: 'receipt' }),
      ]);
      if (cancelled) return;
      setPaymentCount(payments.filter(v => v.status !== 'void').length);
      setReceiptCount(receipts.filter(v => v.status !== 'void').length);
    })();
    return () => {
      cancelled = true;
    };
  }, [icBranchId, range.startDate, range.endDate, refreshToken]);

  const journalCount = journalsLoaded ? journals.filter(v => v.status !== 'void').length : undefined;

  const tabs = useMemo(
    () => [
      { id: 'all', label: 'All', count: (depositModeCounts?.all ?? 0) + (paymentCount ?? 0) + (receiptCount ?? 0) },
      { id: 'cash', label: 'AED', count: depositModeCounts?.cash },
      { id: 'metal', label: 'Metal', count: depositModeCounts?.metal },
      { id: 'payments', label: 'Payments', count: paymentCount },
      { id: 'receipts', label: 'Receipts', count: receiptCount },
      { id: 'journals', label: 'Journals', count: journalCount },
    ],
    [depositModeCounts, journalCount, paymentCount, receiptCount],
  );

  const filteredJournalGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = journals.filter(v => v.status !== 'void');
    const rows = !q
      ? active
      : active.filter(v => {
          const entry = warehouseJournalEntryLabel(v, [], []).toLowerCase();
          const deal = warehouseJournalDealRef(v, [], []).toLowerCase();
          return (
            entry.includes(q) ||
            deal.includes(q) ||
            v.notes.toLowerCase().includes(q) ||
            String(v.voucherNo).includes(q) ||
            v.debitAccountName.toLowerCase().includes(q) ||
            v.creditAccountName.toLowerCase().includes(q)
          );
        });
    return groupWarehouseDealJournals(rows, [], []);
  }, [journals, search]);

  return (
    <>
      <div className={`${asicCard} min-h-0 flex-1`}>
        <div className="border-b border-slate-100 px-3 py-2 sm:px-4">
          <AsicTabBar
            tabs={tabs}
            activeTab={viewTab}
            onTabChange={id => setViewTab(id as BranchDetailContentTab)}
          />
        </div>

        {viewTab === 'all' ? (
          <BranchDetailAllEntriesPanel
            icBranchId={icBranchId}
            branchSlug={branchSlug}
            range={range}
            rangeLabel={rangeLabel}
            refreshToken={refreshToken}
            onDepositsLoaded={onDepositsLoaded}
            canDelete={canDelete}
            onDeleted={onDeleted}
          />
        ) : null}

        {viewTab === 'cash' || viewTab === 'metal' ? (
          <BranchDetailDepositsPanel
            icBranchId={icBranchId}
            branchSlug={branchSlug}
            range={range}
            rangeLabel={rangeLabel}
            refreshToken={refreshToken}
            onDepositsLoaded={onDepositsLoaded}
            modeTab={depositModeTab}
            onModeTabChange={id => setViewTab(id)}
            canDelete={canDelete}
            onDeleted={onDeleted}
            hideModeTabs
          />
        ) : null}

        {viewTab === 'payments' ? (
          <LocationPartyPrVouchersPanel
            voucherType="payment"
            icBranchId={icBranchId}
            range={range}
            branchSlug={branchSlug}
            refreshToken={refreshToken}
            title="Party payments (AED)"
          />
        ) : null}

        {viewTab === 'receipts' ? (
          <LocationPartyPrVouchersPanel
            voucherType="receipt"
            icBranchId={icBranchId}
            range={range}
            branchSlug={branchSlug}
            refreshToken={refreshToken}
            title="Party receipts (AED)"
          />
        ) : null}

        {viewTab === 'journals' ? (
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
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>Deal</th>
                    <th className={icfTh}>Summary</th>
                    <th className={icfTh}>Debit</th>
                    <th className={icfTh}>Credit</th>
                    <th className={icfThAlign('right')}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {journalsLoading ? (
                    <ASICTableRowsSkeleton rows={6} cols={6} />
                  ) : filteredJournalGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>
                        No deposit journals for this branch desk in the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredJournalGroups.map(group => (
                      <React.Fragment key={group.key}>
                        <tr className="border-t border-slate-200 bg-slate-50/90">
                          <td className={`${icfTd} py-2`}>
                            <DateCell iso={group.latestAt} />
                          </td>
                          <td className={`${icfTd} py-2 font-mono text-xs font-semibold text-slate-700`}>
                            {group.dealRef}
                          </td>
                          <td className={`${icfTd} py-2 text-sm font-semibold text-slate-900`} colSpan={4}>
                            {group.headline}
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              {group.lines.length} {group.lines.length === 1 ? 'line' : 'lines'}
                            </span>
                          </td>
                        </tr>
                        {group.lines.map(row => (
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
                            className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50/80 ${row.status === 'pending' ? 'bg-amber-50/40' : ''}`}
                          >
                            <td className={icfTd} />
                            <td className={icfTd} />
                            <td className={`${icfTd} pl-6 text-xs text-slate-600`}>
                              <span className="font-medium text-slate-800">
                                {warehouseJournalEntryLabel(row, [], [])}
                              </span>
                              <span className="ml-2 font-mono text-[10px] tabular-nums text-slate-400">
                                #{row.voucherNo}
                              </span>
                            </td>
                            <td className={icfTd} onClick={e => e.stopPropagation()}>
                              <JournalAccountCell row={row} side="debit" icFundsSlug={icFundsSlug} />
                            </td>
                            <td className={icfTd} onClick={e => e.stopPropagation()}>
                              <JournalAccountCell row={row} side="credit" icFundsSlug={icFundsSlug} />
                            </td>
                            <td className={`${icfTd} text-right font-mono tabular-nums`}>
                              <FmtLedgerAmount amount={row.amount} book={row.book ?? 'AED'} />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
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
        purchases={[]}
        sales={[]}
      />
    </>
  );
}
