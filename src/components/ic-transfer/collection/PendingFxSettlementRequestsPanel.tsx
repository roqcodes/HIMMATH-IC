'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { asicBtnPrimary, asicCard } from '@/components/asic/ui';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { useApp } from '@/context/AppContext';
import { listPendingFxSettlementRequestsAction } from '@/app/actions/saleFxSettlementActions';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { trackLoading } from '@/lib/loadingBar';
import ApproveFxSettlementRequestModal from './ApproveFxSettlementRequestModal';

export type PendingFxRequest = {
  id: string;
  collectionAccountId: string;
  collectionAccountName?: string;
  paidForeign: number;
  currency: string;
  agentNotes?: string;
  enteredByName?: string;
  createdAt?: string;
  agentBalance: number;
  avgSaleFx: number;
  saleCount: number;
};

type Props = {
  branchSlug?: string;
  accountsSlug?: string;
  onChanged?: () => void;
};

export default function PendingFxSettlementRequestsPanel({
  branchSlug,
  accountsSlug = HQ_IC_FUNDS_BRANCH_SLUG,
  onChanged,
}: Props) {
  const { showToast } = useApp();
  const [rows, setRows] = useState<PendingFxRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PendingFxRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPendingFxSettlementRequestsAction(branchSlug);
    if (res.success && res.requests) setRows(res.requests);
    else setRows([]);
    setLoading(false);
  }, [branchSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || rows.length === 0) return null;

  return (
    <>
      <section className={`${asicCard} border-violet-200 bg-violet-50/30`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 px-3 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-violet-950">Pending agent remittances</h2>
            <p className="text-[11px] text-violet-900/80">
              Collection agents submitted foreign amounts — set FX rate and approve to settle.
            </p>
          </div>
          <span className="rounded-md border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-800">
            {rows.length} awaiting
          </span>
        </div>
        <div className="divide-y divide-violet-100">
          {rows.map(row => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  <ICFundAccountLink
                    slug={accountsSlug}
                    accountId={row.collectionAccountId}
                    name={row.collectionAccountName || 'Collection agent'}
                  />
                </p>
                <p className="text-xs text-slate-600">
                  <span className="font-mono font-semibold text-slate-900">
                    {formatFxAmount(row.paidForeign)} {row.currency}
                  </span>
                  {' · held '}
                  {formatFxAmount(row.agentBalance)} {row.currency}
                  {' · '}
                  {row.saleCount} deal{row.saleCount === 1 ? '' : 's'}
                  {row.avgSaleFx > 0 ? ` · avg FX ${formatFxAmount(row.avgSaleFx)}` : ''}
                  {row.enteredByName ? ` · ${row.enteredByName}` : ''}
                  {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString()}` : ''}
                </p>
                {row.agentNotes ? (
                  <p className="mt-1 text-[11px] text-slate-500">{row.agentNotes}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button type="button" className={asicBtnPrimary} onClick={() => setActive(row)}>
                  Review & approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {active ? (
        <ApproveFxSettlementRequestModal
          open={!!active}
          request={active}
          branchSlug={branchSlug}
          onClose={() => setActive(null)}
          onSuccess={() => {
            setActive(null);
            void load();
            onChanged?.();
          }}
        />
      ) : null}
    </>
  );
}
