'use client';

import React from 'react';
import ASICToolbar from '@/components/asic/ASICToolbar';
import BranchDetailScreen from '@/modules/admin/screens/BranchDetailScreen';

export default function BranchDetailPageClient({ slug }: { slug: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ASICToolbar portal="admin" section="branches" />
      <div className="min-w-0 flex-1 px-1 py-1 sm:px-2 sm:py-2">
        <BranchDetailScreen slug={slug} />
      </div>
    </div>
  );
}
