'use client';

import React from 'react';
import { icfCard } from '@/components/ic-funds/ui';

type Props = {
  title: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
};

export default function ChartCard({ title, legend, children }: Props) {
  return (
    <div className={`${icfCard} p-3 sm:p-4`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-900">{title}</h3>
        {legend}
      </div>
      <div>{children}</div>
    </div>
  );
}
