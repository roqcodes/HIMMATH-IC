'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getCustomerWalletSummaryAction,
  type CustomerWalletStats,
} from '@/app/actions/icWalletActions';
import PayToCollectionAgentModal from '@/components/customers/customer-detail/PayToCollectionAgentModal';
import WalletHeader from '@/components/customer/wallet/wallet-header';
import WalletKpiCards from '@/components/customer/wallet/wallet-kpi-cards';
import WalletSalesPanel from '@/components/customer/wallet/WalletSalesPanel';
import WalletAgentsPanel from '@/components/customer/wallet/WalletAgentsPanel';
import WalletPaymentsPanel from '@/components/customer/wallet/WalletPaymentsPanel';
import { asicCard } from '@/components/asic/ui';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { trackLoading } from '@/lib/loadingBar';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

type WalletTab = 'sales' | 'agents' | 'payments';

const emptyStats: CustomerWalletStats = {
  openSaleCount: 0,
  foreignTotalOwed: 0,
  foreignPaidApproved: 0,
  foreignRemaining: 0,
  foreignCredit: 0,
  pendingPaymentCount: 0,
  pendingPaymentAmount: 0,
  agentCount: 0,
};

export default function CustomerWalletPage() {
  const { user, currentSlug, branches, showToast } = useApp();
  const customerId = user?.customerId;
  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<WalletTab>('sales');
  const [payOpen, setPayOpen] = useState(false);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getCustomerWalletSummaryAction>> | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    const res = await trackLoading(() => getCustomerWalletSummaryAction(customerId, branchSlug));
    if (!res.success) {
      showToast(res.error || 'Failed to load wallet', 'error');
    }
    setSummary(res);
    setLoading(false);
  }, [branchSlug, customerId, showToast]);

  const refresh = useCallback(async () => {
    if (!customerId) return;
    setRefreshing(true);
    const res = await trackLoading(() => getCustomerWalletSummaryAction(customerId, branchSlug));
    if (!res.success) {
      showToast(res.error || 'Failed to refresh wallet', 'error');
    } else {
      setSummary(res);
    }
    setRefreshing(false);
  }, [branchSlug, customerId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!customerId) {
    return <p className="p-8 text-center text-slate-500">Sign in as a customer to view your wallet.</p>;
  }

  if (loading && !summary) {
    return <p className="p-8 text-center text-slate-500">Loading wallet…</p>;
  }

  if (!summary?.success) {
    return <p className="p-8 text-center text-red-500">{summary?.error || 'Failed to load wallet'}</p>;
  }

  const currency = summary.currency || summary.agents[0]?.currency || '';
  const stats = summary.stats ?? emptyStats;
  const status = summary.status ?? 'idle';
  const sales = summary.allSales;
  const canPay = summary.agents.length > 0;

  const tabs: { id: WalletTab; label: string; count: number }[] = [
    { id: 'sales', label: 'Sales', count: sales.length },
    { id: 'agents', label: 'Collection agents', count: summary.agents.length },
    { id: 'payments', label: 'Payments', count: summary.payments?.length ?? 0 },
  ];

  return (
    <div className="space-y-3">
      <WalletHeader
        currency={currency}
        status={status}
        pendingCount={stats.pendingPaymentCount}
        canPay={canPay}
        onPay={() => setPayOpen(true)}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      <WalletKpiCards stats={stats} currency={currency} />

      {stats.pendingPaymentCount > 0 ? (
        <section className={`${asicCard} border-amber-200 bg-amber-50/40 px-3 py-2.5`}>
          <p className="text-sm font-medium text-amber-950">Payments awaiting admin approval</p>
          <p className="mt-0.5 text-[11px] text-amber-800/90">
            {stats.pendingPaymentCount} payment{stats.pendingPaymentCount === 1 ? '' : 's'} totaling{' '}
            {formatFxAmount(stats.pendingPaymentAmount)} {currency} will reduce your remaining balance once
            approved.
          </p>
        </section>
      ) : null}

      {summary.agents.length === 0 && stats.foreignRemaining > 1e-10 ? (
        <section className={`${asicCard} border-amber-200 bg-amber-50/40 px-3 py-2.5`}>
          <p className="text-sm font-medium text-amber-950">No collection agents assigned</p>
          <p className="mt-0.5 text-[11px] text-amber-800/90">
            Contact your branch admin to assign collection agents before you can submit wallet payments.
          </p>
        </section>
      ) : null}

      <div className={`${asicCard} overflow-hidden`}>
        <AsicTabBar tabs={tabs} activeTab={tab} onTabChange={id => setTab(id as WalletTab)} ariaLabel="Wallet sections" />

        {tab === 'sales' ? (
          <WalletSalesPanel
            sales={sales}
            currency={currency}
            branches={branches}
            loading={loading || refreshing}
          />
        ) : null}
        {tab === 'agents' ? (
          <WalletAgentsPanel
            agents={summary.agents}
            currency={currency}
            loading={loading || refreshing}
          />
        ) : null}
        {tab === 'payments' ? (
          <WalletPaymentsPanel payments={summary.payments ?? []} loading={loading || refreshing} />
        ) : null}
      </div>

      {payOpen && user?.customerId ? (
        <PayToCollectionAgentModal
          open={payOpen}
          onClose={() => setPayOpen(false)}
          customerId={user.customerId}
          customerName={summary.customerName || user.name || 'Customer'}
          currency={currency}
          foreignRemaining={summary.foreignRemaining}
          agents={summary.agents}
          branchSlug={branchSlug}
          onSuccess={() => {
            void refresh();
          }}
        />
      ) : null}
    </div>
  );
}
