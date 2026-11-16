'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteBranchDepositAction, listBranchDepositsAction } from '@/app/actions/branchDepositActions';
import { ICTransferDeleteIconButton } from '@/components/ic-transfer/shared/ICTransferTableActions';
import { useApp } from '@/context/AppContext';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import ICTransferDataTableShell, {
  icTdClass,
  type ICTransferTableColumn,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { asicCard } from '@/components/asic/ui';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import type { ICBranchDeposit } from '@/types';

export type BranchDepositModeTab = 'all' | 'cash' | 'metal';
export type BranchDetailContentTab =
  | BranchDepositModeTab
  | 'journals'
  | 'payments'
  | 'receipts';

const ALL_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'Manager', label: 'Manager', align: 'left' },
  { id: 'Customer', label: 'Customer', align: 'left' },
  { id: 'Mode', label: 'Mode', align: 'left' },
  { id: 'AED', label: 'AED credited', align: 'right' },
  { id: 'Metal (g)', label: 'Metal (g)', align: 'right' },
  { id: 'Rate (AED/g)', label: 'Rate (AED/g)', align: 'right' },
  { id: 'Entered by', label: 'Entered by', align: 'left' },
  { id: 'Notes', label: 'Notes', align: 'left', sortable: false },
  { id: 'Actions', label: '', align: 'right', sortable: false },
];

const AED_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'Manager', label: 'Manager', align: 'left' },
  { id: 'Customer', label: 'Customer', align: 'left' },
  { id: 'AED', label: 'AED credited', align: 'right' },
  { id: 'Entered by', label: 'Entered by', align: 'left' },
  { id: 'Notes', label: 'Notes', align: 'left', sortable: false },
  { id: 'Actions', label: '', align: 'right', sortable: false },
];

const METAL_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'Manager', label: 'Manager', align: 'left' },
  { id: 'Customer', label: 'Customer', align: 'left' },
  { id: 'Metal (g)', label: 'Metal (g)', align: 'right' },
  { id: 'Rate (AED/g)', label: 'Rate (AED/g)', align: 'right' },
  { id: 'AED', label: 'AED credited', align: 'right' },
  { id: 'Entered by', label: 'Entered by', align: 'left' },
  { id: 'Notes', label: 'Notes', align: 'left', sortable: false },
  { id: 'Actions', label: '', align: 'right', sortable: false },
];

function columnsForTab(tab: BranchDepositModeTab): ICTransferTableColumn[] {
  if (tab === 'cash') return AED_COLUMNS;
  if (tab === 'metal') return METAL_COLUMNS;
  return ALL_COLUMNS;
}

function DepositDateCell({ deposit }: { deposit: ICBranchDeposit }) {
  const iso = deposit.createdAt || deposit.depositDate;
  if (!iso) return <span className="text-slate-400">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-xs font-medium text-slate-800">
        {new Date(deposit.depositDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </div>
      <div className="text-[10px] text-slate-400">
        {new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

type Props = {
  icBranchId: string;
  branchSlug: string;
  range: DateFilterRange;
  rangeLabel: string;
  refreshToken?: number;
  onDepositsLoaded?: (deposits: ICBranchDeposit[]) => void;
  modeTab?: BranchDepositModeTab;
  onModeTabChange?: (tab: BranchDepositModeTab) => void;
  canDelete?: boolean;
  onDeleted?: () => void;
  /** Mode tabs (All / AED / Metal) are rendered in the parent. */
  hideModeTabs?: boolean;
};

export default function BranchDetailDepositsPanel({
  icBranchId,
  branchSlug,
  range,
  rangeLabel,
  refreshToken = 0,
  onDepositsLoaded,
  modeTab: modeTabProp,
  onModeTabChange,
  canDelete = false,
  onDeleted,
  hideModeTabs = false,
}: Props) {
  const { showToast } = useApp();
  const [deposits, setDeposits] = useState<ICBranchDeposit[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modeTabInternal, setModeTabInternal] = useState<BranchDepositModeTab>('all');
  const modeTab = modeTabProp ?? modeTabInternal;
  const setModeTab = onModeTabChange ?? setModeTabInternal;
  const [sortField, setSortField] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listBranchDepositsAction({
        icBranchId,
        startDate: range.startDate,
        endDate: range.endDate,
        slug: branchSlug || undefined,
      });
      setDeposits(rows);
      onDepositsLoaded?.(rows);
    } finally {
      setLoading(false);
    }
  }, [icBranchId, range.startDate, range.endDate, branchSlug, onDepositsLoaded]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const modeCounts = useMemo(() => {
    let cash = 0;
    let metal = 0;
    for (const d of deposits) {
      if (d.settlementMode === 'metal') metal += 1;
      else cash += 1;
    }
    return { cash, metal, all: deposits.length };
  }, [deposits]);

  const filtered = useMemo(() => {
    const byMode =
      modeTab === 'all' ? deposits : deposits.filter(d => d.settlementMode === modeTab);
    const q = search.trim().toLowerCase();
    if (!q) return byMode;
    return byMode.filter(d => {
      const blob = [
        d.managerName,
        d.customerName,
        d.notes,
        d.enteredByName,
        d.settlementMode,
        String(d.amountAed),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [deposits, search, modeTab]);

  const columns = useMemo(() => columnsForTab(modeTab), [modeTab]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const dir = sortOrder === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (sortField) {
        case 'Manager':
          return dir * (a.managerName || '').localeCompare(b.managerName || '');
        case 'Customer':
          return dir * (a.customerName || '').localeCompare(b.customerName || '');
        case 'Mode':
          return dir * a.settlementMode.localeCompare(b.settlementMode);
        case 'AED':
          return dir * ((a.amountAed || 0) - (b.amountAed || 0));
        case 'Metal (g)':
          return dir * ((a.metalWeightG || 0) - (b.metalWeightG || 0));
        case 'Rate (AED/g)':
          return dir * ((a.metalRateAedPerG || 0) - (b.metalRateAedPerG || 0));
        case 'Entered by':
          return dir * (a.enteredByName || '').localeCompare(b.enteredByName || '');
        case 'Date':
        default: {
          const ta = new Date(a.depositDate).getTime();
          const tb = new Date(b.depositDate).getTime();
          return dir * (ta - tb);
        }
      }
    });
    return rows;
  }, [filtered, sortField, sortOrder]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, deposit: ICBranchDeposit) => {
      e.stopPropagation();
      if (!canDelete || deletingId) return;
      const label =
        deposit.settlementMode === 'metal'
          ? `metal deposit (${deposit.amountAed} AED)`
          : `AED ${deposit.amountAed} deposit`;
      if (
        !window.confirm(
          `Delete this ${label} for ${deposit.customerName || 'customer'}? This voids the customer ledger entry.`,
        )
      ) {
        return;
      }
      setDeletingId(deposit.id);
      try {
        const res = await deleteBranchDepositAction(branchSlug, deposit.id);
        if (!res.success) {
          showToast(res.error || 'Could not delete deposit', 'error');
          return;
        }
        showToast('Deposit deleted');
        onDeleted?.();
        await load();
      } finally {
        setDeletingId(null);
      }
    },
    [branchSlug, canDelete, deletingId, load, onDeleted, showToast],
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

  const emptyMessage =
    modeTab === 'cash'
      ? 'No AED cash deposits in this period.'
      : modeTab === 'metal'
        ? 'No metal deposits in this period.'
        : 'No deposits at this branch in the selected period. Use Deposit to record cash or metal.';

  const tabs = hideModeTabs ? null : (
    <div className={`${asicCard} border-0 border-b border-slate-100 shadow-none`}>
      <AsicTabBar
        tabs={[
          { id: 'all', label: 'All', count: modeCounts.all },
          { id: 'cash', label: 'AED', count: modeCounts.cash },
          { id: 'metal', label: 'Metal', count: modeCounts.metal },
        ]}
        activeTab={modeTab}
        onTabChange={id => {
          const next = id as BranchDepositModeTab;
          setModeTab(next);
          if (next !== 'all' && sortField === 'Mode') setSortField('Date');
        }}
      />
    </div>
  );

  const renderRow = (d: ICBranchDeposit) => {
    const isMetal = d.settlementMode === 'metal';
    const showMode = modeTab === 'all';
    const showMetalCols = modeTab !== 'cash';
    /** Matches column order: All + Cash = AED before metal cols; Metal tab = AED after rate. */
    const showAedEarly = modeTab === 'cash' || modeTab === 'all';

    const partyCells = (
      <>
        <td className={icTdClass('left')}>
          <DepositDateCell deposit={d} />
        </td>
        <td className={icTdClass('left')}>
          <CounterpartyLink
            counterpartyId={d.managerId}
            name={d.managerName || '—'}
            branchSlug={branchSlug || undefined}
          />
        </td>
        <td className={icTdClass('left')}>
          <CounterpartyLink
            counterpartyId={d.customerId}
            name={d.customerName || '—'}
            branchSlug={branchSlug || undefined}
          />
        </td>
      </>
    );

    const modeCell = showMode ? (
      <td className={icTdClass('left')}>
        <span
          className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            isMetal ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'
          }`}
        >
          {isMetal ? 'Metal' : 'Cash'}
        </span>
      </td>
    ) : null;

    const aedCell = (
      <td className={icTdClass('right')}>
        <span className="font-mono font-medium tabular-nums text-slate-900">
          <FmtLedgerAed amount={d.amountAed} />
        </span>
      </td>
    );

    const metalCells = showMetalCols ? (
      <>
        <td className={icTdClass('right')}>
          <span className="font-mono tabular-nums text-amber-800">
            {isMetal || modeTab === 'metal' ? formatMetalGrams(d.metalWeightG ?? 0) : '—'}
          </span>
        </td>
        <td className={icTdClass('right')}>
          <span className="font-mono tabular-nums text-slate-600">
            {isMetal && d.metalRateAedPerG
              ? Number(d.metalRateAedPerG).toLocaleString('en-US', { maximumFractionDigits: 4 })
              : '—'}
          </span>
        </td>
      </>
    ) : null;

    const tailCells = (
      <>
        <td className={icTdClass('left')}>
          <span className="text-sm text-slate-700">{d.enteredByName || '—'}</span>
        </td>
        <td className={icTdClass('left')}>
          <span className="line-clamp-2 text-xs text-slate-500">{d.notes?.trim() || '—'}</span>
        </td>
        <td className={icTdClass('right')}>
          {canDelete ? (
            <ICTransferDeleteIconButton
              onClick={e => {
                if (deletingId === d.id) return;
                void handleDelete(e, d);
              }}
            />
          ) : null}
        </td>
      </>
    );

    return (
      <tr key={d.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
        {partyCells}
        {showMode ? modeCell : null}
        {showAedEarly ? aedCell : null}
        {metalCells}
        {!showAedEarly ? aedCell : null}
        {tailCells}
      </tr>
    );
  };

  return (
    <ICTransferDataTableShell
      title={`Customer deposits · ${rangeLabel}`}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search manager, customer, notes…"
      tabs={tabs}
      columns={columns}
      sortField={sortField}
      sortOrder={sortOrder}
      onSort={handleSort}
      isEmpty={!loading && sorted.length === 0}
      emptyMessage={emptyMessage}
      minWidth={modeTab === 'cash' ? '720px' : '880px'}
    >
      {loading ? (
        <ASICTableRowsSkeleton rows={5} cols={columns.length} />
      ) : (
        sorted.map(renderRow)
      )}
    </ICTransferDataTableShell>
  );
}
