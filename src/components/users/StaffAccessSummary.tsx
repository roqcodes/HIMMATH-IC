'use client';

import React from 'react';
import type { BranchPageId } from '@/lib/branchPages';
import type { PageAccessLevel, PagePermissionMap } from '@/types';
import {
  summarizeLegacyPermissionsForSections,
  summarizePermissionsForSections,
  type StaffPermissionPortal,
} from '@/lib/staffSectionPermissions';
import { accessLevelLabel } from './PageAccessRadioGroup';

function accessBadgeClass(level: PageAccessLevel | undefined): string {
  switch (level ?? 'none') {
    case 'write':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/15';
    case 'read':
      return 'bg-sky-50 text-sky-700 ring-sky-600/15';
    default:
      return 'bg-slate-100 text-slate-400 ring-slate-300/20';
  }
}

type Props = {
  permissions: PagePermissionMap | undefined;
  pages: BranchPageId[];
  portal?: StaffPermissionPortal;
  loading?: boolean;
};

export default function StaffAccessSummary({ permissions, pages, portal = 'branch', loading }: Props) {
  if (loading && permissions === undefined) {
    return (
      <div className="flex flex-wrap gap-1.5" aria-busy="true" aria-label="Loading access">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-6 w-16 animate-pulse rounded-md bg-slate-100 motion-reduce:animate-none" />
        ))}
      </div>
    );
  }

  const allPages =
    portal === 'admin'
      ? summarizePermissionsForSections(permissions, 'admin')
      : summarizeLegacyPermissionsForSections(permissions, pages);

  return (
    <div className="flex flex-wrap gap-1.5">
      {allPages.map(({ id, label, level }) => (
        <span
          key={id}
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${accessBadgeClass(level)}`}
          title={`${label}: ${accessLevelLabel(level)}`}
        >
          <span className="max-w-[120px] truncate">{label}</span>
          <span className="opacity-70">·</span>
          <span>{accessLevelLabel(level, true)}</span>
        </span>
      ))}
    </div>
  );
}
