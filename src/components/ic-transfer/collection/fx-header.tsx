'use client';

import React from 'react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';

type Props = {
  pendingCount: number;
  onAssignAgents: () => void;
  onTransfer: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
      {count} pending payment{count === 1 ? '' : 's'}
    </span>
  );
}

export default function FxHeader({
  pendingCount,
  onAssignAgents,
  onTransfer,
  onRefresh,
  refreshing,
}: Props) {
  const { canWrite, buttonProps: wp } = useWriteAccess();

  return (
    <AsicPageHeader
      title="FX"
      subtitle="Collection agents, wallet payments, agent balances, and Type 2 profit — foreign wallet layer + AED ledger at settlement"
      meta={<PendingBadge count={pendingCount} />}
      actions={
        <>
          <button
            type="button"
            className={asicBtnOutline}
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button type="button" className={asicBtnOutline} onClick={onTransfer}>
            Transfer agents
          </button>
          {canWrite ? (
            <button
              type="button"
              className={asicBtnPrimary}
              onClick={() => canWrite && onAssignAgents()}
              {...wp()}
            >
              Assign agents
            </button>
          ) : null}
        </>
      }
    />
  );
}
