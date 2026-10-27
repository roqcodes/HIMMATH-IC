'use client';

import React, { useMemo, useState } from 'react';
import {
  asicBtnGhost,
  asicInput,
  asicTable,
  asicTableWrap,
  asicTd,
  asicTh,
  asicTheadRow,
  asicTr,
} from '@/components/asic/ui';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { useWriteAccess } from '@/context/RbacWriteContext';

export type FxCustomerRow = {
  id: string;
  name: string;
  branchName?: string;
  branchSlug?: string;
  profileCurrency: string;
  saleCurrency?: string;
  effectiveCurrency: string;
  agents: Array<{
    collectionAccountId: string;
    name: string;
    currency: string;
    isPrimary: boolean;
  }>;
  foreignRemaining: number;
  foreignPaidApproved: number;
  openSaleCount: number;
  needsProfileCurrency: boolean;
  status: 'ready' | 'needs_agents' | 'needs_payment' | 'needs_profile' | 'idle';
};

type StatusFilter = 'all' | 'needs_action' | 'assigned';

function StatusBadge({ status }: { status: FxCustomerRow['status'] }) {
  const map = {
    needs_profile: {
      label: 'Set currency',
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    },
    needs_agents: {
      label: 'No agents',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    needs_payment: {
      label: 'Awaiting payment',
      className: 'border-sky-200 bg-sky-50 text-sky-800',
    },
    ready: {
      label: 'Assigned',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    idle: {
      label: 'Idle',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
  } as const;
  const tone = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone.className}`}
    >
      {tone.label}
    </span>
  );
}

type Props = {
  customers: FxCustomerRow[];
  loading?: boolean;
  showBranch?: boolean;
  accountsSlug?: string;
  onAssign: (customerId: string) => void;
};

export default function FxCustomersPanel({
  customers,
  loading,
  showBranch,
  accountsSlug = HQ_IC_FUNDS_BRANCH_SLUG,
  onAssign,
}: Props) {
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter(c => {
      if (filter === 'needs_action' && !['needs_profile', 'needs_agents', 'needs_payment'].includes(c.status)) {
        return false;
      }
      if (filter === 'assigned' && c.agents.length === 0) return false;
      if (!q) return true;
      const agentNames = c.agents.map(a => a.name).join(' ').toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.effectiveCurrency.toLowerCase().includes(q) ||
        (c.branchName || '').toLowerCase().includes(q) ||
        agentNames.includes(q)
      );
    });
  }, [customers, filter, search]);

  return (
    <div className="flex min-h-[320px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search customer or agent…"
          className={`${asicInput} min-w-[180px] flex-1`}
        />
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as StatusFilter)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
        >
          <option value="all">All customers</option>
          <option value="needs_action">Needs action</option>
          <option value="assigned">With agents</option>
        </select>
      </div>

      <div className={`${asicTableWrap} min-h-0 flex-1`}>
        <table className={asicTable}>
          <thead>
            <tr className={asicTheadRow}>
              <th className={asicTh}>Customer</th>
              {showBranch ? <th className={asicTh}>Branch</th> : null}
              <th className={asicTh}>Currency</th>
              <th className={asicTh}>Assigned agents</th>
              <th className={`${asicTh} text-right`}>Owed</th>
              <th className={`${asicTh} text-right`}>Paid</th>
              <th className={asicTh}>Status</th>
              <th className={`${asicTh} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={showBranch ? 8 : 7} className="px-3 py-10 text-center text-sm text-slate-500">
                  Loading customers…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={showBranch ? 8 : 7} className="px-3 py-10 text-center text-sm text-slate-500">
                  No FX customers match this view.
                </td>
              </tr>
            ) : (
              filtered.map(row => (
                <tr key={row.id} className={asicTr}>
                  <td className={asicTd}>
                    <CustomerProfileLink
                      branchSlug={row.branchSlug}
                      customerId={row.id}
                      name={row.name}
                    />
                    {row.openSaleCount > 0 ? (
                      <p className="text-[11px] text-slate-400">
                        {row.openSaleCount} open sale{row.openSaleCount === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </td>
                  {showBranch ? (
                    <td className={`${asicTd} text-slate-600`}>{row.branchName || '—'}</td>
                  ) : null}
                  <td className={asicTd}>
                    <span className="font-mono text-xs font-medium text-slate-800">{row.effectiveCurrency}</span>
                    {row.needsProfileCurrency && row.saleCurrency ? (
                      <p className="text-[11px] text-rose-600">Profile still AED · sales {row.saleCurrency}</p>
                    ) : null}
                  </td>
                  <td className={asicTd}>
                    {row.agents.length === 0 ? (
                      <span className="text-xs text-slate-400">None</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.agents.map(agent => (
                          <ICFundAccountLink
                            key={agent.collectionAccountId}
                            slug={accountsSlug}
                            accountId={agent.collectionAccountId}
                            name={`${agent.name}${agent.isPrimary ? ' · primary' : ''}`}
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium no-underline hover:underline ${
                              agent.isPrimary
                                ? 'border-slate-300 bg-slate-900 text-white hover:text-white'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums font-medium text-amber-700`}>
                    {row.foreignRemaining > 0.0001
                      ? `${formatFxAmount(row.foreignRemaining)} ${row.saleCurrency || row.effectiveCurrency}`
                      : '—'}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums text-slate-600`}>
                    {row.foreignPaidApproved > 0.0001
                      ? `${formatFxAmount(row.foreignPaidApproved)} ${row.saleCurrency || row.effectiveCurrency}`
                      : '—'}
                  </td>
                  <td className={asicTd}>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className={`${asicTd} text-right`}>
                    {canWrite ? (
                      <button
                        type="button"
                        className={asicBtnGhost}
                        onClick={() => onAssign(row.id)}
                        {...wp()}
                      >
                        {row.agents.length > 0 ? 'Edit' : 'Assign'}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
