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
};

export function ICTransferDealBookKpiStrips({ books, rangeLabel, flow, countHint }: Props) {
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
    </>
  );
}

export default ICTransferDealBookKpiStrips;
