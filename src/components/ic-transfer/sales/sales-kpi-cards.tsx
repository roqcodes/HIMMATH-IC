'use client';

import React from 'react';
import ICTransferDealBookKpiStrips from '@/components/ic-transfer/shared/ICTransferDealBookKpiStrips';
import type { DealBookPair } from '@/lib/icTransfer/dealBookKpis';

type Props = {
  books: DealBookPair;
  rangeLabel: string;
  countHint?: string;
};

export default function SalesKpiCards({ books, rangeLabel, countHint }: Props) {
  return (
    <ICTransferDealBookKpiStrips
      books={books}
      rangeLabel={rangeLabel}
      flow="sale"
      countHint={countHint}
    />
  );
}
