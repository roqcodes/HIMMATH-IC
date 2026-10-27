'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import type { Customer, ICFundAccount } from '@/types';
import { useApp } from '@/context/AppContext';
import { getCustomerById } from '@/app/actions/customerActions';
import { getICFundAccountByCustomerIdAction } from '@/app/actions/icFundsActions';
import { formatMoneyLabel } from '@/lib/format';
import CustomerModal from './CustomerModal';
import CustomerICFundsTab from './customer-detail/CustomerICFundsTab';
import CustomerWalletActivitySection from '@/components/ic-funds/CustomerWalletActivitySection';
import CustomerCollectionAgentsSection from './customer-detail/CustomerCollectionAgentsSection';
import CustomerProfileCard from './customer-detail/CustomerProfileCard';
import DetailSection from './customer-detail/DetailSection';
import PayToCollectionAgentModal from './customer-detail/PayToCollectionAgentModal';
import { getCustomerWalletSummaryAction } from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { fmtICAmount } from '@/lib/icFunds/format';
import { iconBtn } from '@/lib/ui';
import { asicBtnPrimary } from '@/components/asic/ui';
import AsicKpiStrip, { type AsicKpiMetric } from '@/components/asic/AsicKpiStrip';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';
import { parseAsicPath, RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';

export default function CustomerDetailPage() {
  const params = useParams();
  const pathname = usePathname();
  const parsed = parseAsicPath(pathname);
  const paramSlug = params.slug as string | undefined;
  const customerId = params.customerId as string;
  const slug =
    parsed.portal === 'branch' && parsed.branchSlug
      ? parsed.branchSlug
      : paramSlug && !RESERVED_BRANCH_SLUGS.has(paramSlug)
        ? paramSlug
        : '';
  const backHref = slug ? `/branch/${slug}/accounts` : '/admin/accounts';
  const backLabel = 'Back to accounts';
  const { branches, activeCurrency } = useApp();
  const { canWrite, writeBlockedReason, buttonProps: wp } = useWriteAccess();

  const branch = slug ? branches.find(b => b.slug === slug) : undefined;
  const branchId = branch?.id;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [icFundAccount, setIcFundAccount] = useState<ICFundAccount | null>(null);
  const [walletSummary, setWalletSummary] = useState<{
    foreignRemaining: number;
    agents: Array<{ collectionAccountId: string; name: string; currency: string }>;
  } | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

  const loadCustomer = async () => {
    setLoading(true);
    const res = await getCustomerById(customerId, slug || undefined);
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
  }, [customerId, slug]);

  useEffect(() => {
    if (!branchId) {
      setIcFundAccount(null);
      setWalletSummary(null);
      return;
    }
    void getICFundAccountByCustomerIdAction(branchId, customerId).then(setIcFundAccount);
    void getCustomerWalletSummaryAction(customerId, slug || undefined).then(res => {
      if (res.success) {
        setWalletSummary({
          foreignRemaining: res.foreignRemaining,
          agents: res.agents || [],
        });
      }
    });
  }, [branchId, customerId, slug]);

  const fmtBalance = (n: number) => formatMoneyLabel(n, activeCurrency);

  const isForeignCurrency =
    Boolean(customer?.currency) && customer!.currency!.toUpperCase() !== 'AED';

  const kpiMetrics = useMemo((): AsicKpiMetric[] => {
    if (!customer) return [];
    const metrics: AsicKpiMetric[] = [
      {
        label: 'Ledger balance',
        value: fmtBalance(customer.balance),
        hint: 'Branch ledger position',
        tone: customer.balance > 0 ? 'emerald' : customer.balance < 0 ? 'red' : 'slate',
      },
    ];
    if (icFundAccount) {
      metrics.push({
        label: 'IC Funds',
        value: fmtICAmount(icFundAccount.balance),
        hint: icFundAccount.pendingBalance
          ? `${fmtICAmount(icFundAccount.pendingBalance)} pending`
          : 'Fund account balance',
        tone: icFundAccount.balance > 0 ? 'emerald' : icFundAccount.balance < 0 ? 'red' : 'default',
      });
    }
    if (isForeignCurrency && walletSummary) {
      metrics.push({
        label: `${customer.currency} wallet`,
        value: `${formatFxAmount(walletSummary.foreignRemaining)} ${customer.currency}`,
        hint: 'Unsettled foreign balance',
        tone: walletSummary.foreignRemaining > 0 ? 'amber' : 'slate',
      });
      metrics.push({
        label: 'Collection agents',
        value: String(walletSummary.agents.length),
        hint: walletSummary.agents.length ? 'Assigned for remittance' : 'None assigned',
        tone: walletSummary.agents.length ? 'indigo' : 'slate',
      });
    }
    return metrics;
  }, [customer, icFundAccount, walletSummary, isForeignCurrency, activeCurrency]);

  const kpiColumns = (kpiMetrics.length <= 2 ? 2 : kpiMetrics.length <= 3 ? 3 : 4) as 2 | 3 | 4;

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
          <Link
            href={backHref}
            className={iconBtn}
            aria-label={backLabel}
            title={backLabel}
          >
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
          <CustomerProfileCard customer={customer} branchName={branch?.name} />
        </aside>

        {isForeignCurrency ? (
          <div className="lg:col-span-4">
            <DetailSection
              id="foreign-collection"
              title="Foreign collection"
              description={`${customer.currency} remittance via collection agents`}
              action={
                canWrite && walletSummary && walletSummary.agents.length > 0 ? (
                  <button type="button" className={asicBtnPrimary} onClick={() => setPayModalOpen(true)}>
                    Pay to agent
                  </button>
                ) : null
              }
            >
              <CustomerCollectionAgentsSection
                customerId={customer.id}
                customerCurrency={customer.currency!}
                branchSlug={slug || undefined}
                canWrite={canWrite}
              />
            </DetailSection>
          </div>
        ) : null}
      </div>

      {isForeignCurrency ? (
        <DetailSection
          id="wallet-activity"
          title="Wallet activity"
          description={`${customer.currency} payments to collection agents — separate from the AED IC Funds ledger`}
        >
          <CustomerWalletActivitySection
            customerId={customer.id}
            branchSlug={slug || undefined}
            currency={customer.currency!}
            refreshKey={walletRefreshKey}
          />
        </DetailSection>
      ) : null}

      {branchId ? (
        <DetailSection
          id="ic-funds"
          title="IC Funds"
          description="AED company ledger — sales receivable and settlements"
        >
          <CustomerICFundsTab
            slug={slug}
            branchId={branchId}
            customer={customer}
            icFundAccount={icFundAccount}
            branchName={branch?.name}
          />
        </DetailSection>
      ) : (
        <DetailSection title="IC Funds" description="Branch ledger required">
          <p className="py-6 text-center text-sm text-slate-400 dark:text-[var(--theme-text-muted)]">
            Select a branch ledger to view IC Funds activity.
          </p>
        </DetailSection>
      )}

      {isEditOpen ? (
        <CustomerModal
          slug={slug || 'hq'}
          open={isEditOpen}
          customer={customer}
          onClose={() => setIsEditOpen(false)}
          onSave={() => {
            setIsEditOpen(false);
            void loadCustomer();
          }}
        />
      ) : null}

      {payModalOpen && walletSummary && customer.currency ? (
        <PayToCollectionAgentModal
          open={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          customerId={customer.id}
          customerName={customer.name}
          currency={customer.currency}
          foreignRemaining={walletSummary.foreignRemaining}
          agents={walletSummary.agents}
          branchSlug={slug || undefined}
          onSuccess={() => {
            setWalletRefreshKey(k => k + 1);
            void getCustomerWalletSummaryAction(customer.id, slug || undefined).then(res => {
              if (res.success) {
                setWalletSummary({
                  foreignRemaining: res.foreignRemaining,
                  agents: res.agents || [],
                });
              }
            });
          }}
        />
      ) : null}
    </div>
  );
}
