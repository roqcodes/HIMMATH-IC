'use client';

import React from 'react';
import SettlementClient from '@/app/[slug]/warehouse/settlement/SettlementClient';

export default function WarehouseOrdersGate({ slug }: { slug?: string }) {
  if (!slug) return <p className="text-sm text-slate-500">Missing branch.</p>;
  return <SettlementClient branchSlug={slug} />;
}
