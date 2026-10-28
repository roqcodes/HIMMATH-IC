'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import VoucherScreen from '@/components/ic-funds/VoucherScreen';
import AccountsScreen from '@/components/ic-funds/AccountsScreen';
import ICFundsBooksSection from '@/components/ic-funds/ICFundsBooksSection';
import PLScreen from '@/components/ic-funds/PLScreen';
import { IC_FUNDS_NAV, type ICFundsReportId, type ICFundsSectionId } from '@/lib/icFunds/nav';
import type { ICFundVoucherType } from '@/lib/icFunds/constants';
import type { AsicPortal } from '@/lib/asic/routing';
import { icfInput, icfLabel } from '@/components/ic-funds/ui';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';
import {
  HQ_IC_FUNDS_BRANCH_SLUG,
  icFundsBranchOptions,
  isHqIcFundsBranch,
} from '@/lib/icFunds/hqBranch';
import { ensureHqIcFundsBranchAction } from '@/app/actions/icFundsActions';

const VOUCHER_SECTIONS: Record<string, ICFundVoucherType> = {
  payments: 'payment',
  receipts: 'receipt',
  journal: 'journal',
  contra: 'contra',
};

const HQ_BRANCH_KEY = 'asic_admin_ic_funds_branch';

function sectionLabel(section: ICFundsSectionId): string {
  return IC_FUNDS_NAV.find(item => item.id === section)?.label ?? section;
}

export default function ICFundsApp({
  section,
  reportView,
  portal = 'branch',
  branchSlug: branchSlugProp,
}: {
  section: ICFundsSectionId;
  reportView?: ICFundsReportId;
  portal?: AsicPortal;
  branchSlug?: string;
}) {
  const { currentSlug, branches, refetchData, isInitialLoading } = useApp();
  const isHq = portal === 'admin';
  const [hqBranchSlug, setHqBranchSlug] = useState(HQ_IC_FUNDS_BRANCH_SLUG);
  const [hqReady, setHqReady] = useState(!isHq);

  const ledgerOptions = useMemo(() => icFundsBranchOptions(branches), [branches]);

  useEffect(() => {
    if (!isHq) return;
    let cancelled = false;
    void ensureHqIcFundsBranchAction().then(res => {
      if (cancelled) return;
      if (res.success) void refetchData();
      setHqReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isHq, refetchData]);

  useEffect(() => {
    if (!isHq || ledgerOptions.length === 0) return;
    const stored = typeof window !== 'undefined' ? localStorage.getItem(HQ_BRANCH_KEY) : null;
    const initial =
      (stored && ledgerOptions.some(b => b.slug === stored) ? stored : null) ??
      HQ_IC_FUNDS_BRANCH_SLUG;
    setHqBranchSlug(initial);
  }, [isHq, ledgerOptions]);

  const fundSlug = useMemo(() => {
    if (isHq) return hqBranchSlug;
    if (branchSlugProp) return branchSlugProp;
    if (currentSlug && currentSlug !== 'superadmin') return currentSlug;
    return '';
  }, [isHq, hqBranchSlug, branchSlugProp, currentSlug]);

  const branch = ledgerOptions.find(b => b.slug === fundSlug);
  const branchId = branch?.id;

  const onBranchChange = (slug: string) => {
    setHqBranchSlug(slug);
    if (typeof window !== 'undefined') {
      localStorage.setItem(HQ_BRANCH_KEY, slug);
    }
  };

  if (!isHq && (!fundSlug || !branchId)) {
    if (isInitialLoading) return <ASICPageSkeleton />;
    return <p className="text-sm text-slate-500">IC Funds is available on a branch workspace.</p>;
  }

  if (isHq && !hqReady) {
    return <ASICPageSkeleton />;
  }

  if (isHq && !branchId) {
    return (
      <div className="max-w-md space-y-3">
        <AsicPageHeader title="Entities" />
        <label className={icfLabel} htmlFor="ic-funds-branch">
          Ledger
        </label>
        <select
          id="ic-funds-branch"
          className={icfInput}
          value={hqBranchSlug}
          onChange={e => onBranchChange(e.target.value)}
        >
          <option value="">Choose ledger…</option>
          {ledgerOptions.map(b => (
            <option key={b.id} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  const voucherType = VOUCHER_SECTIONS[section];
  const fundsPortal = isHq ? 'admin' : 'branch';
  const operationalLedgers = ledgerOptions.filter(b => !isHqIcFundsBranch(b));

  const ledgerPicker =
    isHq && operationalLedgers.length > 0 ? (
      <select
        className={`${icfInput} !w-auto min-w-[140px] py-1 text-sm`}
        value={fundSlug}
        onChange={e => onBranchChange(e.target.value)}
        aria-label="Ledger"
      >
        {ledgerOptions.map(b => (
          <option key={b.id} value={b.slug}>
            {isHqIcFundsBranch(b) ? `${b.name} (admin)` : b.name}
          </option>
        ))}
      </select>
    ) : isHq && branch ? (
      <span className="text-xs text-slate-500">{branch.name}</span>
    ) : null;

  return (
    <div>
      {section !== 'accounts' ? (
        <AsicPageHeader title={sectionLabel(section)} meta={ledgerPicker} />
      ) : null}
      {voucherType ? (
        <VoucherScreen
          key={voucherType}
          branchId={branchId!}
          voucherType={voucherType}
          branchSlug={fundSlug}
        />
      ) : section === 'accounts' ? (
        <AccountsScreen
          branchId={branchId!}
          navSlug={fundSlug}
          hqMode={isHq}
        />
      ) : section === 'pl' ? (
        <PLScreen branchId={branchId!} slug={fundSlug} portal={fundsPortal} />
      ) : (
        <ICFundsBooksSection
          branchId={branchId!}
          slug={fundSlug}
          reportView={reportView}
          portal={fundsPortal}
        />
      )}
    </div>
  );
}

