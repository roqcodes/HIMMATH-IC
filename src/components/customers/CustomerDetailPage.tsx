'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Customer, ICFundAccount } from '@/types';
import { getCustomerById } from '@/app/actions/customerActions';
import { getICFundAccountByCustomerIdAction } from '@/app/actions/icFundsActions';
import { formatMoneyValue } from '@/lib/format';
import CustomerModal from './CustomerModal';
import CustomerICFundsTab from './customer-detail/CustomerICFundsTab';
import CustomerProfileCard from './customer-detail/CustomerProfileCard';
import DetailSection from './customer-detail/DetailSection';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { fmtLedgerAed } from '@/lib/icFunds/format';
import { iconBtn } from '@/lib/ui';
import { asicBtnPrimary } from '@/components/asic/ui';
import AsicKpiStrip, { type AsicKpiMetric } from '@/components/asic/AsicKpiStrip';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.customerId as string;
  const backHref = '/admin/customers';
  const backLabel = 'Back to customers';
  const { canWrite, writeBlockedReason, buttonProps: wp } = useWriteAccess();

  const branchId = HQ_IC_FUNDS_BRANCH_ID;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [icFundAccount, setIcFundAccount] = useState<ICFundAccount | null>(null);

  const loadCustomer = async () => {
    setLoading(true);
    const res = await getCustomerById(customerId, 'hq');
    if (res.success && res.customer) {
      setCustomer(res.customer);
      setError(null);
    } else {
      setCustomer(null);
      setError(res.error || 'Customer not found');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadCustomer();
  }, [customerId]);

  useEffect(() => {
    void getICFundAccountByCustomerIdAction(branchId, customerId).then(setIcFundAccount);
  }, [branchId, customerId]);

  const fmtBalance = (n: number) => formatMoneyValue(n);

  const kpiMetrics = useMemo((): AsicKpiMetric[] => {
    if (!customer) return [];
    const metrics: AsicKpiMetric[] = [
      {
        label: 'Ledger balance',
        value: fmtBalance(customer.balance),
        hint: 'Customer ledger position',
        tone: customer.balance > 0 ? 'emerald' : customer.balance < 0 ? 'red' : 'slate',
      },
    ];
    if (icFundAccount) {
      metrics.push({
        label: 'IC Funds',
        value: fmtLedgerAed(icFundAccount.balance),
        hint: icFundAccount.pendingBalance
          ? `${fmtLedgerAed(icFundAccount.pendingBalance)} pending`
          : 'Fund account balance',
        tone: icFundAccount.balance > 0 ? 'emerald' : icFundAccount.balance < 0 ? 'red' : 'default',
      });
    }
    return metrics;
  }, [customer, icFundAccount]);

  const kpiColumns = (kpiMetrics.length <= 2 ? 2 : 3) as 2 | 3 | 4;

  if (loading) {
    return <ASICPageSkeleton variant="detail" />;
  }

  if (error || !customer) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
        {error || 'Customer not found'}
      </div>
    );
  }

  const contactLine = [customer.phone, customer.email].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <Link href={backHref} className={iconBtn} aria-label={backLabel} title={backLabel}>
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-[var(--theme-text)]">
              {customer.name}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-[var(--theme-text-secondary)]">
              {contactLine || 'Customer profile & financial activity'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => canWrite && setIsEditOpen(true)}
          {...wp()}
          className={`${asicBtnPrimary}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
          title={!canWrite ? writeBlockedReason : 'Edit customer'}
        >
          Edit customer
        </button>
      </header>

      <AsicKpiStrip metrics={kpiMetrics} columns={kpiColumns} />

      <div className="grid gap-3 lg:grid-cols-12 lg:items-start">
        <aside className="lg:col-span-8">
          <CustomerProfileCard customer={customer} branchName="HQ" />
        </aside>
      </div>

      <DetailSection
        id="ic-funds"
        title="IC Funds"
        description="AED company ledger — sales receivable and settlements"
      >
        <CustomerICFundsTab
          slug="hq"
          branchId={branchId}
          customer={customer}
          icFundAccount={icFundAccount}
          branchName="HQ"
        />
      </DetailSection>

      {isEditOpen ? (
        <CustomerModal
          slug="hq"
          open={isEditOpen}
          customer={customer}
          onClose={() => setIsEditOpen(false)}
          onSave={() => {
            setIsEditOpen(false);
            void loadCustomer();
          }}
        />
      ) : null}
    </div>
  );
}
