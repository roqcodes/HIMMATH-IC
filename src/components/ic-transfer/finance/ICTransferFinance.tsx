'use client';

import React from 'react';
import Link from 'next/link';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { asicBtnPrimary } from '@/components/asic/ui';
import { PageHeader, PageShell } from '../ui';
import { sectionHref } from '@/lib/asic/nav';

export default function ICTransferFinance() {
  const fundsHref = sectionHref('admin', 'payments');

  return (
    <PageShell>
      <PageHeader
        title="Intercompany Finance"
        actions={
          <Link href={fundsHref} className={`${asicBtnPrimary} no-underline`}>
            Open General Ledger
          </Link>
        }
      />

      <AsicKpiStrip
        metrics={[
          { label: 'Total revenue', value: '—', hint: 'Coming soon' },
          { label: 'Total expenses', value: '—', hint: 'Coming soon' },
          { label: 'Net profit', value: '—', hint: 'Coming soon', tone: 'emerald' },
          { label: 'Outstanding due', value: '—', hint: 'Coming soon', tone: 'amber' },
        ]}
      />

    </PageShell>
  );
}
