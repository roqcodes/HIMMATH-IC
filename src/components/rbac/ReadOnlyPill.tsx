'use client';

import React from 'react';
import { useWriteAccess } from '@/context/RbacWriteContext';

type ReadOnlyPillProps = {
  className?: string;
};

export default function ReadOnlyPill({ className = '' }: ReadOnlyPillProps) {
  const { isReadOnly, writeBlockedReason } = useWriteAccess();

  if (!isReadOnly) return null;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-[10px] font-medium tracking-wide text-slate-500 ${className}`}
      title={writeBlockedReason}
      role="status"
    >
      Read only
    </span>
  );
}
