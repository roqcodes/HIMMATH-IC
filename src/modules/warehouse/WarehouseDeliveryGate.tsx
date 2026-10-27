'use client';

import React from 'react';
import DeliveryAgentsClient from '@/app/[slug]/warehouse/delivery-agents/DeliveryAgentsClient';

export default function WarehouseDeliveryGate({ slug }: { slug?: string }) {
  if (!slug) return <p className="text-sm text-slate-500">Missing branch.</p>;
  return <DeliveryAgentsClient branchSlug={slug} />;
}
