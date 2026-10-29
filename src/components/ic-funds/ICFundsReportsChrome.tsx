'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { reportCatalogTitle } from '@/lib/icFunds/reportCatalog';
import { isICFundsReportId } from '@/lib/icFunds/nav';

type HeaderToolbarContextValue = {
  setToolbar: (node: React.ReactNode) => void;
};

const HeaderToolbarContext = createContext<HeaderToolbarContextValue | null>(null);

/** Register print / export (or other) controls in the reports page header (detail views). */
export function useICFundsReportHeaderToolbar(toolbar: React.ReactNode) {
  const ctx = useContext(HeaderToolbarContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setToolbar(toolbar);
    return () => ctx.setToolbar(null);
  }, [ctx, toolbar]);
}

export default function ICFundsReportsChrome({
  meta,
  children,
}: {
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const onHub = !isICFundsReportId(view);
  const [toolbar, setToolbarState] = useState<React.ReactNode>(null);
  const setToolbar = useCallback((node: React.ReactNode) => setToolbarState(node), []);
  const toolbarCtx = useMemo(() => ({ setToolbar }), [setToolbar]);

  if (onHub) {
    return (
      <>
        <AsicPageHeader
          title="Financial reports"
          subtitle="HQ ledger (AED). Pick a report, then set the period on the next screen."
          meta={meta}
        />
        {children}
      </>
    );
  }

  return (
    <HeaderToolbarContext.Provider value={toolbarCtx}>
      <AsicPageHeader
        breadcrumbs={[
          { label: 'Financial reports', href: '/admin/reports' },
          { label: reportCatalogTitle(view) },
        ]}
        meta={meta}
        toolbar={toolbar}
      />
      {children}
    </HeaderToolbarContext.Provider>
  );
}
