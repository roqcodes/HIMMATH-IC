'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BooksScreen from '@/components/ic-funds/BooksScreen';
import ReportsHub from '@/components/ic-funds/reports/ReportsHub';
import ICFundsReportsChrome from '@/components/ic-funds/ICFundsReportsChrome';
import { isICFundsReportId, type ICFundsReportId } from '@/lib/icFunds/nav';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';

function ICFundsBooksInner({
  branchId,
  slug,
  portal,
  headerMeta,
}: {
  branchId: string;
  slug: string;
  reportView?: ICFundsReportId;
  portal: 'admin' | 'branch';
  headerMeta?: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  if (!isICFundsReportId(view)) {
    return (
      <ICFundsReportsChrome meta={headerMeta}>
        <ReportsHub slug={slug} portal={portal} />
      </ICFundsReportsChrome>
    );
  }

  return (
    <ICFundsReportsChrome meta={headerMeta}>
      <BooksScreen branchId={branchId} slug={slug} reportView={view} portal={portal} />
    </ICFundsReportsChrome>
  );
}

export default function ICFundsBooksSection(props: {
  branchId: string;
  slug: string;
  reportView?: ICFundsReportId;
  portal: 'admin' | 'branch';
  headerMeta?: React.ReactNode;
}) {
  return (
    <Suspense fallback={<ASICPageSkeleton />}>
      <ICFundsBooksInner {...props} />
    </Suspense>
  );
}
