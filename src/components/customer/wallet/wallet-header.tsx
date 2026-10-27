'use client';

import React from 'react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import type { CustomerWalletStatus } from '@/app/actions/icWalletActions';
import { useWriteAccess } from '@/context/RbacWriteContext';

type Props = {
  currency?: string;
  status: CustomerWalletStatus;
  pendingCount: number;
  canPay: boolean;
  onPay: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

function StatusBadge({ status, pendingCount }: { status: CustomerWalletStatus; pendingCount: number }) {
  const map = {
    needs_agents: {
      label: 'No agents assigned',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    needs_payment: {
      label: 'Payment due',
      className: 'border-sky-200 bg-sky-50 text-sky-800',
    },
    pending_approval: {
      label: `${pendingCount} pending approval`,
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    ready: {
      label: 'Up to date',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    idle: {
      label: 'No open balance',
      className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
  } as const;
  const tone = map[status];
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${tone.className}`}
    >
      {tone.label}
    </span>
  );
}

export default function WalletHeader({
  currency,
  status,
  pendingCount,
  canPay,
  onPay,
  onRefresh,
  refreshing,
}: Props) {
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const payBlocked = !canPay || !canWrite;

  return (
    <AsicPageHeader
      title="Wallet"
      subtitle={
        currency
          ? `Pay assigned collection agents in ${currency}. Admin approval is required before funds reach agents.`
          : 'Foreign-currency sale balances and collection agent payments'
      }
      meta={<StatusBadge status={status} pendingCount={pendingCount} />}
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
          {canPay ? (
            <button
              type="button"
              className={asicBtnPrimary}
              onClick={() => !payBlocked && onPay()}
              {...wp({ disabled: payBlocked })}
            >
              Pay to agent
            </button>
          ) : null}
        </>
      }
    />
  );
}
