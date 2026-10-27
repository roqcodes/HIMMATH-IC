'use client';

import React from 'react';
import {
  IC_FUNDS_BASE_CURRENCY,
  accountWalletCurrency,
  walletLedgerNote,
} from '@/lib/icFunds/currencyPolicy';
import type { ICFundAccountType } from '@/lib/icFunds/constants';

export function AccountCurrencyBadge({
  accountType,
  currency,
  compact = false,
}: {
  accountType: ICFundAccountType | string;
  currency?: string | null;
  compact?: boolean;
}) {
  const walletCur = accountWalletCurrency({ accountType: String(accountType), currency });
  if (!walletCur) {
    return (
      <span className="inline-flex rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {IC_FUNDS_BASE_CURRENCY}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1"
      title={walletLedgerNote(walletCur)}
    >
      <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-900">
        {walletCur}
      </span>
      {!compact ? (
        <span className="text-[10px] text-slate-500">wallet · ledger {IC_FUNDS_BASE_CURRENCY}</span>
      ) : null}
    </span>
  );
}
