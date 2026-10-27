'use client';

import React from 'react';
import OrderSettlementClient from '@/app/[slug]/warehouse/order-settlement/OrderSettlementClient';

export default function DeliverySettlementGate({ slug }: { slug?: string }) {
  if (!slug) return <p className="text-sm text-slate-500">Missing branch.</p>;
  return <OrderSettlementClient branchSlug={slug} />;
}
