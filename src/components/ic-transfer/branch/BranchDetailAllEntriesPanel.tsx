'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteBranchDepositAction, listBranchDepositsAction } from '@/app/actions/branchDepositActions';
import { listLocationPartyVouchersAction } from '@/app/actions/icFundsActions';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import JournalVoucherDetailModal from '@/components/ic-transfer/journal/JournalVoucherDetailModal';
import ICTransferDataTableShell, { icTdClass, type ICTransferTableColumn } from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import { ICTransferDeleteIconButton } from '@/components/ic-transfer/shared/ICTransferTableActions';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatTallyVoucherNo } from '@/lib/icFunds/tallyLedgerPdf';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import type { ICBranchDeposit, ICFundVoucher } from '@/types';
import { useApp } from '@/context/AppContext';

type Entry = {
  key: string;
  date: string;
  dateSort: number;
  entryType: string;
  voucherId: string;
  managerId?: string;
  managerName: string;
  customerId?: string;
  customerName: string;
  amount: number;
  notes: string;
  deposit?: ICBranchDeposit;
  voucher?: ICFundVoucher;
};

const COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date' },
  { id: 'Voucher ID', label: 'Voucher ID' },
  { id: 'Type', label: 'Type' },
  { id: 'Manager', label: 'Manager' },
  { id: 'Customer', label: 'Customer' },
  { id: 'Amount', label: 'Amount', align: 'right' },
  { id: 'Notes', label: 'Notes', sortable: false },
  { id: 'Actions', label: '', align: 'right', sortable: false },
];

function DateCell({ value }: { value: string }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const datePart = value.slice(0, 10);
  const parsed = new Date(`${datePart}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? <span>—</span> : (
    <span className="whitespace-nowrap text-xs font-medium text-slate-800">
      {parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );
}

export default function BranchDetailAllEntriesPanel({
  icBranchId,
  branchSlug,
  range,
  rangeLabel,
  refreshToken,
  onDepositsLoaded,
  canDelete = false,
  onDeleted,
}: {
  icBranchId: string;
  branchSlug: string;
  range: DateFilterRange;
  rangeLabel: string;
  refreshToken?: number;
  onDepositsLoaded?: (deposits: ICBranchDeposit[]) => void;
  canDelete?: boolean;
  onDeleted?: () => void;
}) {
  const { icSuppliers, showToast } = useApp();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewVoucher, setViewVoucher] = useState<ICFundVoucher | null>(null);

  const nameOf = useCallback((id?: string) => icSuppliers.find(p => p.id === id)?.name || '—', [icSuppliers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deposits, payments, receipts] = await Promise.all([
        listBranchDepositsAction({
          icBranchId,
          startDate: range.startDate,
          endDate: range.endDate,
          slug: branchSlug,
        }),
        listLocationPartyVouchersAction({
          icBranchId,
          voucherType: 'payment',
          startDate: range.startDate ?? undefined,
          endDate: range.endDate ?? undefined,
          limit: 500,
        }),
        listLocationPartyVouchersAction({
          icBranchId,
          voucherType: 'receipt',
          startDate: range.startDate ?? undefined,
          endDate: range.endDate ?? undefined,
          limit: 500,
        }),
      ]);
      onDepositsLoaded?.(deposits);
      const rows: Entry[] = [
        ...deposits.map(deposit => ({
          key: `deposit:${deposit.id}`,
          date: deposit.depositDate || deposit.createdAt || '',
          dateSort: new Date(deposit.createdAt || deposit.depositDate).getTime() || 0,
          entryType: deposit.settlementMode === 'metal' ? 'Metal deposit' : 'Cash deposit',
          voucherId: `DEP-${deposit.id.slice(0, 8).toUpperCase()}`,
          managerId: deposit.managerId,
          managerName: deposit.managerName || '—',
          customerId: deposit.customerId,
          customerName: deposit.customerName || '—',
          amount: Number(deposit.amountAed) || 0,
          notes: deposit.notes || '',
          deposit,
        })),
        ...[...payments, ...receipts]
          .filter(voucher => voucher.status !== 'void')
          .map(voucher => ({
            key: `voucher:${voucher.id}`,
            date: voucher.voucherDate || voucher.createdAt || '',
            dateSort: new Date(voucher.voucherDate || voucher.createdAt).getTime() || 0,
            entryType: voucher.voucherType === 'payment' ? 'Payment' : 'Receipt',
            voucherId: formatTallyVoucherNo(voucher.voucherType, voucher.voucherNo),
            managerId: voucher.managerId,
            managerName: nameOf(voucher.managerId),
            customerId: voucher.referenceId,
            customerName: nameOf(voucher.referenceId),
            amount: Number(voucher.amount) || 0,
            notes: voucher.notes || '',
            voucher,
          })),
      ];
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }, [branchSlug, icBranchId, nameOf, onDepositsLoaded, range.endDate, range.startDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(entry => [
      entry.date,
      entry.voucherId,
      entry.entryType,
      entry.managerName,
      entry.customerName,
      entry.amount,
      entry.notes,
    ].some(value => String(value ?? '').toLowerCase().includes(q)));
  }, [entries, search]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    const direction = sortOrder === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      if (sortField === 'Amount') return direction * (a.amount - b.amount);
      if (sortField === 'Type') return direction * a.entryType.localeCompare(b.entryType);
      if (sortField === 'Manager') return direction * a.managerName.localeCompare(b.managerName);
      if (sortField === 'Customer') return direction * a.customerName.localeCompare(b.customerName);
      if (sortField === 'Voucher ID') return direction * a.voucherId.localeCompare(b.voucherId);
      return direction * (a.dateSort - b.dateSort);
    });
    return rows;
  }, [filtered, sortField, sortOrder]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortOrder(previous => previous === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder(field === 'Date' ? 'desc' : 'asc');
    }
  };

  const handleDelete = async (event: React.MouseEvent, entry: Entry) => {
    event.stopPropagation();
    if (!canDelete || !entry.deposit || deletingId) return;
    if (!window.confirm(`Delete this ${entry.entryType.toLowerCase()} for ${entry.customerName}? This reverses the customer ledger entry.`)) return;
    setDeletingId(entry.deposit.id);
    try {
      const result = await deleteBranchDepositAction(branchSlug, entry.deposit.id);
      if (!result.success) {
        showToast(result.error || 'Could not delete deposit', 'error');
        return;
      }
      showToast('Deposit deleted');
      onDeleted?.();
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const renderEntry = (entry: Entry) => (
    <tr
      key={entry.key}
      className={`border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${entry.voucher ? 'cursor-pointer' : ''}`}
      onClick={entry.voucher ? () => setViewVoucher(entry.voucher ?? null) : undefined}
    >
      <td className={icTdClass('left')}><DateCell value={entry.date} /></td>
      <td className={`${icTdClass('left')} font-mono text-xs text-slate-600`}>{entry.voucherId}</td>
      <td className={icTdClass('left')}>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{entry.entryType}</span>
      </td>
      <td className={icTdClass('left')}>
        {entry.managerId ? <CounterpartyLink counterpartyId={entry.managerId} name={entry.managerName} branchSlug={branchSlug} /> : entry.managerName}
      </td>
      <td className={icTdClass('left')}>
        {entry.customerId ? <CounterpartyLink counterpartyId={entry.customerId} name={entry.customerName} branchSlug={branchSlug} /> : entry.customerName}
      </td>
      <td className={icTdClass('right')}><span className="font-mono tabular-nums"><FmtLedgerAed amount={entry.amount} /></span></td>
      <td className={icTdClass('left')}><span className="line-clamp-2 text-xs text-slate-500">{entry.notes.trim() || '—'}</span></td>
      <td className={icTdClass('right')}>
        {canDelete && entry.deposit ? <ICTransferDeleteIconButton onClick={event => void handleDelete(event, entry)} /> : null}
      </td>
    </tr>
  );

  const mobileView = sorted.map(entry => (
    <article key={entry.key} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-slate-500"><DateCell value={entry.date} /></div>
          <div className="mt-1 font-mono text-xs text-slate-600">{entry.voucherId}</div>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{entry.entryType}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div><div className="text-slate-400">Manager</div><div>{entry.managerName}</div></div>
        <div><div className="text-slate-400">Customer</div><div>{entry.customerName}</div></div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="line-clamp-2 text-xs text-slate-500">{entry.notes || '—'}</div>
        <div className="shrink-0 font-mono text-sm font-semibold"><FmtLedgerAed amount={entry.amount} /></div>
      </div>
      {canDelete && entry.deposit ? <div className="mt-2 flex justify-end"><ICTransferDeleteIconButton onClick={event => void handleDelete(event, entry)} /></div> : null}
    </article>
  ));

  return (
    <>
      <ICTransferDataTableShell
        title={`All branch entries · ${rangeLabel}`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search voucher, manager, customer, notes…"
        columns={COLUMNS}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        minWidth="1040px"
        isEmpty={!loading && sorted.length === 0}
        emptyMessage="No deposits, payments or receipts in the selected period."
        mobileView={mobileView}
      >
        {loading ? <ASICTableRowsSkeleton rows={6} cols={COLUMNS.length} /> : sorted.map(renderEntry)}
      </ICTransferDataTableShell>
      <JournalVoucherDetailModal
        open={!!viewVoucher}
        voucher={viewVoucher}
        onClose={() => setViewVoucher(null)}
        icFundsSlug={branchSlug}
        branchSlug={branchSlug}
        purchases={[]}
        sales={[]}
      />
    </>
  );
}
