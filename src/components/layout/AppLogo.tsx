'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { isBranchPortalRole, isCustomerRole } from '@/lib/rbac';
import { PRODUCT_NAME } from '@/lib/brand';

type Props = {
  variant?: 'sidebar' | 'header';
  collapsed?: boolean;
  href?: string;
};

export default function AppLogo({ variant = 'sidebar', collapsed = false, href }: Props) {
  const { user, branches, currentSlug } = useApp();

  const isBranchUser = user ? isBranchPortalRole(user.role) : false;
  const isCustomer = isCustomerRole(user?.role);
  const branch = isBranchUser && user?.branchId
    ? branches.find(b => b.id === user.branchId)
    : currentSlug !== 'superadmin'
      ? branches.find(b => b.slug === currentSlug)
      : null;

  const logoSrc = isBranchUser && branch?.logo_url ? branch.logo_url : '/logo.png';
  const brandName =
    isCustomer && user?.name?.trim()
      ? user.name.trim()
      : isBranchUser && branch
        ? branch.name
        : PRODUCT_NAME;
  const tagline = isCustomer && branch?.name
    ? branch.name
    : isBranchUser
      ? isCustomerRole(user?.role)
        ? 'Customer Portal'
        : user?.role === 'staff'
          ? 'Staff Portal'
          : user?.role?.startsWith('delivery') || user?.role?.startsWith('warehouse_')
            ? 'Warehouse Portal'
            : 'Branch Portal'
      : 'IC Transfer';

  const isHeader = variant === 'header';

  const iconSize = isHeader ? 'size-9 sm:size-10' : collapsed ? 'size-8 lg:size-8' : 'size-12 sm:size-14';
  const svgSize = isHeader ? 'size-[18px] sm:size-5' : 'size-6 sm:size-7';

  const asicIcon = (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg border border-[var(--theme-border-subtle)] bg-gradient-to-br from-[#faf8f5] to-white text-slate-500 shadow-surface-xs ring-1 ring-slate-900/[0.04] dark:from-[var(--theme-surface-raised)] dark:to-[var(--theme-surface)] ${iconSize}`}
      aria-hidden
    >
      <svg
        className={svgSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 4h9.5a1.5 1.5 0 0 1 1.5 1.5V19a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="M7 4v15" className="text-slate-400" strokeWidth="1.25" />
        <path d="M10.5 8.5h5.5" className="text-red-600/70" strokeWidth="1.4" />
        <path d="M10.5 12h5.5" strokeWidth="1.25" opacity="0.55" />
        <path d="M10.5 15.5h3.5" strokeWidth="1.25" opacity="0.4" />
      </svg>
    </div>
  );

  const content = (
    <>
      {isHeader ? (
        <>
          {asicIcon}
          <span className="min-w-0 truncate text-sm font-bold tracking-tight text-slate-900 sm:text-base">
            {PRODUCT_NAME}
          </span>
        </>
      ) : (
        <>
          <div
            className={`flex shrink-0 items-center justify-center transition-transform duration-300 motion-safe:hover:scale-105 ${
              collapsed ? 'lg:h-8' : 'h-14 sm:h-16'
            }`}
          >
            <img
              src={logoSrc}
              alt={`${brandName} logo`}
              className={`h-full w-auto object-contain ${
                collapsed ? 'lg:max-h-8 lg:max-w-[28px]' : 'max-w-[160px]'
              }`}
            />
          </div>
          <div className={`min-w-0 text-center ${collapsed ? 'lg:hidden' : ''}`}>
            <h1 className="text-xl font-black uppercase tracking-[0.05em] text-slate-900 sm:text-2xl">
              {brandName}
            </h1>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
              {tagline}
            </span>
          </div>
        </>
      )}
    </>
  );

  const className = isHeader
    ? 'flex min-w-0 items-center gap-2.5 sm:gap-3'
    : `flex flex-col items-center gap-2.5 px-4 py-8 sm:px-5 ${collapsed ? 'lg:gap-1 lg:px-2 lg:py-4' : ''}`;

  if (href) {
    return (
      <Link href={href} className={`${className} no-underline`} aria-label={`${PRODUCT_NAME} home`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
