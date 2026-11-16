'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listLocationPartyVouchersAction } from '@/app/actions/icFundsActions';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import { icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import SearchInput from '@/components/ic-transfer/ui/SearchInput';
import JournalVoucherDetailModal from '@/components/ic-transfer/journal/JournalVoucherDetailModal';
import { FmtLedgerAmount } from '@/lib/icFunds/format';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import type { DateFilterRange } from '@/lib/dateFilterRange';
import type { ICFundVoucher } from '@/types';
import { useApp } from '@/context/AppContext';

type Props = {
  voucherType: 'payment' | 'receipt';
  icBranchId?: string;
  warehouseId?: string;
  range: DateFilterRange;
  branchSlug?: string;
  refreshToken?: number;
  title: string;
};

function DateCell({ iso }: { iso?: string }) {
  if (!iso) return <span className="text-slate-400">—</span>;
  const src = iso.includes('T') ? iso : `${iso}T12:00:00`;
  return (
    <div className="leading-tight">
      <div className="text-xs font-medium text-slate-800">
        {new Date(src).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
      {iso.includes('T') ? (
        <div className="text-[10px] text-slate-400">
          {new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      ) : null}
    </div>
  );
}

export default function LocationPartyPrVouchersPanel({
  voucherType,
  icBranchId,
  warehouseId,
  range,
  branchSlug,
  refreshToken,
  title,
}: Props) {
  const { icSuppliers } = useApp();
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<ICFundVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewJournal, setViewJournal] = useState<ICFundVoucher | null>(null);

  const icFundsSlug = branchSlug || HQ_IC_FUNDS_BRANCH_SLUG;
  const book = warehouseId ? 'INR' : 'AED';

  const nameOf = useCallback(
    (id?: string | null) => {
      if (!id) return '—';
      return icSuppliers.find(s => s.id === id)?.name || '—';
    },
    [icSuppliers],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listLocationPartyVouchersAction({
        voucherType,
        icBranchId,
        warehouseId,
        startDate: range.startDate ?? undefined,
        endDate: range.endDate ?? undefined,
        limit: 500,
      });
      setRows(list);
    } finally {
      setLoading(false);
    }
  }, [voucherType, icBranchId, warehouseId, range.startDate, range.endDate]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = rows.filter(v => v.status !== 'void');
    if (!q) return active;
    return active.filter(v => {
      const mgr = nameOf(v.managerId).toLowerCase();
      const cust = nameOf(v.referenceId).toLowerCase();
      return (
        mgr.includes(q) ||
        cust.includes(q) ||
        v.id.toLowerCase().includes(q) ||
        v.notes.toLowerCase().includes(q) ||
        String(v.voucherNo).includes(q)
      );
    });
  }, [rows, search, nameOf]);

  return (
  <>
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search manager, customer, notes…"
          className="w-full max-w-md"
        />
      </div>
      <div className={icfTableWrap}>
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>Date</th>
              <th className={icfTh}>Voucher ID</th>
              <th className={icfTh}>Manager</th>
              <th className={icfTh}>Customer</th>
              <th className={icfThAlign('right')}>Amount</th>
              <th className={icfTh}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <ASICTableRowsSkeleton rows={6} cols={6} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${icfTd} py-8 text-center text-sm text-slate-500`}>
                  No {voucherType}s for this location in the selected period.
                </td>
              </tr>
            ) : (
              filtered.map(v => (
                <tr
                  key={v.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewJournal(v)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setViewJournal(v);
                    }
                  }}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                >
                  <td className={icfTd}>
                    <DateCell iso={v.voucherDate || v.createdAt} />
                  </td>
                  <td className={`${icfTd} font-mono text-xs text-slate-600`}>{v.id}</td>
                  <td className={icfTd}>
                    {v.managerId ? (
                      <CounterpartyLink
                        counterpartyId={v.managerId}
                        name={nameOf(v.managerId)}
                        branchSlug={branchSlug}
                        stopPropagation
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={icfTd}>
                    {v.referenceId ? (
                      <CounterpartyLink
                        counterpartyId={v.referenceId}
                        name={nameOf(v.referenceId)}
                        branchSlug={branchSlug}
                        stopPropagation
                      />
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${icfTd} text-right font-mono tabular-nums`}>
                    <FmtLedgerAmount amount={v.amount} book={v.book ?? book} />
                  </td>
                  <td className={`${icfTd} max-w-[12rem] truncate text-xs text-slate-600`} title={v.notes}>
                    {v.notes?.trim() || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
