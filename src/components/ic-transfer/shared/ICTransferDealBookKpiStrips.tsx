'use client';

import React from 'react';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { buildDealFlowBookMetrics } from '@/lib/icFunds/ledgerKpiMetrics';
import type { DealBookPair } from '@/lib/icTransfer/dealBookKpis';

type Props = {
  books: DealBookPair;
  rangeLabel: string;
  flow: 'purchase' | 'sale' | 'combined';
  countHint?: string;
  inrLedgerStatus?: 'loading' | 'ready' | 'error';
};

export function ICTransferDealBookKpiStrips({
  books,
  rangeLabel,
  flow,
  countHint,
  inrLedgerStatus = 'ready',
}: Props) {
  return (
    <>
      <AsicKpiStrip
        columns={4}
        metrics={buildDealFlowBookMetrics({
          book: books.aed,
          rangeLabel,
          currency: 'AED',
          flow,
          countHint,
        })}
      />
      {inrLedgerStatus === 'ready' ? (
        <AsicKpiStrip
          columns={4}
          metrics={buildDealFlowBookMetrics({
            book: books.inr,
            rangeLabel,
            currency: 'INR',
            flow,
            countHint,
          })}
        />
      ) : (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {inrLedgerStatus === 'loading'
            ? 'Loading warehouse INR ledger…'
            : 'Warehouse INR ledger is unavailable for this selection; reconcile the warehouse INR account.'}
        </p>
      )}
    </>
  );
}

export default ICTransferDealBookKpiStrips;
