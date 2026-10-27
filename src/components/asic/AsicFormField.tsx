'use client';

import React from 'react';
import { asicLabel } from '@/components/asic/ui';

type ColSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12;

const spanClass: Record<ColSpan, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  12: 'sm:col-span-2 lg:col-span-12',
};

type Props = {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  colSpan?: ColSpan;
  className?: string;
};

export default function AsicFormField({
  label,
  htmlFor,
  hint,
  children,
  colSpan = 6,
  className = '',
}: Props) {
  return (
    <div className={`min-w-0 ${spanClass[colSpan]} ${className}`}>
      {label ? (
        <label className={asicLabel} htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {hint ? (
        <p className="mt-0.5 line-clamp-3 break-words text-[11px] leading-snug text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
