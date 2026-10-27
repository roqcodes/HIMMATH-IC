'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BooksScreen from '@/components/ic-funds/BooksScreen';
import { isICFundsReportId, type ICFundsReportId } from '@/lib/icFunds/nav';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';

function ICFundsBooksInner({
  branchId,
  slug,
  reportView,
  portal,
}: {
  branchId: string;
  slug: string;
  reportView?: ICFundsReportId;
  portal: 'admin' | 'branch';
}) {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const resolved = isICFundsReportId(view) ? view : (reportView ?? 'all-vouchers');

  return (
    <BooksScreen branchId={branchId} slug={slug} reportView={resolved} portal={portal} />
  );
}

export default function ICFundsBooksSection(props: {
  branchId: string;
  slug: string;
  reportView?: ICFundsReportId;
  portal: 'admin' | 'branch';
}) {
  return (
    <Suspense fallback={<ASICPageSkeleton />}>
      <ICFundsBooksInner {...props} />
    </Suspense>
  );
}
