'use client';

import React from 'react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

/** Shared layout for warehouse / delivery portals — matches ASIC admin density. */
export default function WarehousePortalShell({ title, subtitle, actions, children }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <AsicPageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </div>
  );
}
