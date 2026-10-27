'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  getFxPageOverviewAction,
  getSaleFxSettlementsPageAction,
  listOpenForeignSalesByAgentAction,
} from '@/app/actions/saleFxSettlementActions';
import {
  listWalletTransactionsPageAction,
  type WalletTransactionRow,
} from '@/app/actions/icWalletActions';
import { FX_SETTLEMENT_LIST_PAGE_SIZE } from '@/lib/icTransfer/saleFxSettlementQueries';
import BatchFxSettlementModal, { type AgentGroupSale } from './BatchFxSettlementModal';
import PendingWalletApprovalsPanel from './PendingWalletApprovalsPanel';
import PendingFxSettlementRequestsPanel from './PendingFxSettlementRequestsPanel';
import AgentTransferModal from './AgentTransferModal';
import AssignCustomerAgentsModal from './AssignCustomerAgentsModal';
import FxHeader from './fx-header';
import FxKpiCards, { type FxKpiStats } from './fx-kpi-cards';
import FxCustomersPanel, { type FxCustomerRow } from './FxCustomersPanel';
import FxAgentBalancesPanel, { type FxAgentGroup } from './FxAgentBalancesPanel';
import FxSettlementsTable, { type FxSettlementRow } from './FxSettlementsTable';
import FxWalletTransactionsPanel from './FxWalletTransactionsPanel';
import { trackLoading, maybeTrackLoading } from '@/lib/loadingBar';
import { asicCard } from '@/components/asic/ui';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { usePageRefresh } from '@/hooks/usePageRefresh';

type FxTab = 'customers' | 'agents' | 'payments' | 'settlements';

const emptyStats: FxKpiStats = {
  customerCount: 0,
  customersWithoutAgents: 0,
  customersNeedingProfile: 0,
  pendingPayments: 0,
  pendingSettlementRequests: 0,
  foreignByCurrency: {},
  agentByCurrency: {},
  totalForeignRemaining: 0,
  totalAgentBalance: 0,
  totalType2Booked: 0,
};

export default function FxSettlementsPage() {
  const { currentSlug, showToast, branches } = useApp();
  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
  const showBranch = !branchSlug;

  const [tab, setTab] = useState<FxTab>('customers');
  const [stats, setStats] = useState<FxKpiStats>(emptyStats);
  const [customers, setCustomers] = useState<FxCustomerRow[]>([]);
  const [groups, setGroups] = useState<FxAgentGroup[]>([]);
  const [settlements, setSettlements] = useState<FxSettlementRow[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRow[]>([]);
  const [walletTxTotal, setWalletTxTotal] = useState(0);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [settlementsLoading, setSettlementsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalType2, setTotalType2] = useState(0);
  const [batchAgent, setBatchAgent] = useState<{
    id: string;
    name: string;
    sales: AgentGroupSale[];
    agentBalance: number;
  } | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignCustomerId, setAssignCustomerId] = useState<string | undefined>();

  const pageSize = FX_SETTLEMENT_LIST_PAGE_SIZE;

  const loadOverview = useCallback(async (silent = false) => {
    setOverviewLoading(true);
    const res = await maybeTrackLoading(() => getFxPageOverviewAction(branchSlug), !silent);
    if (!res.success) {
      showToast(res.error || 'Failed to load FX overview', 'error');
      setStats(emptyStats);
      setCustomers([]);
    } else {
      setStats(res.stats);
      setCustomers(res.customers as FxCustomerRow[]);
    }
    setOverviewLoading(false);
  }, [branchSlug, showToast]);

  const loadAgentGroups = useCallback(async (silent = false) => {
    setAgentsLoading(true);
    const groupRes = await maybeTrackLoading(() => listOpenForeignSalesByAgentAction(branchSlug), !silent);
    if (!groupRes.success) {
      showToast('Failed to load agent balances', 'error');
      setGroups([]);
    } else if (groupRes.groups) {
      setGroups(
        groupRes.groups.map(g => ({
          collectionAccountId: g.collectionAccountId,
          collectionAccountName: g.collectionAccountName,
          currency: g.currency,
          agentBalance: g.agentBalance,
          sales: g.sales as AgentGroupSale[],
          closing: g.closing
            ? {
                totalSarOwed: g.closing.totalSarOwed,
                totalSarRemaining: g.closing.totalSarRemaining,
                avgSaleRateAed: g.closing.avgSaleRateAed,
                avgSaleConversionRate: g.closing.avgSaleConversionRate,
                totalAed: g.closing.totalAed,
              }
            : null,
        })),
      );
    }
    setAgentsLoading(false);
  }, [branchSlug, showToast]);

  const loadWalletTransactions = useCallback(async (silent = false) => {
    setPaymentsLoading(true);
    const res = await maybeTrackLoading(
      () => listWalletTransactionsPageAction({ branchSlug, limit: 100, offset: 0 }),
      !silent,
    );
    if (!res.success) {
      showToast(res.error || 'Failed to load wallet transactions', 'error');
      setWalletTransactions([]);
      setWalletTxTotal(0);
    } else {
      setWalletTransactions(res.transactions);
      setWalletTxTotal(res.total);
    }
    setPaymentsLoading(false);
  }, [branchSlug, showToast]);

  const loadSettlements = useCallback(async (silent = false) => {
    setSettlementsLoading(true);
    const listRes = await maybeTrackLoading(
      () =>
        getSaleFxSettlementsPageAction({
          branchSlug,
          limit: pageSize,
          offset,
        }),
      !silent,
    );
    if (!listRes.success) {
      showToast('Failed to load settlements', 'error');
      setSettlements([]);
      setTotal(0);
      setTotalType2(0);
    } else {
      setSettlements(listRes.settlements);
      setTotal(listRes.total);
      setTotalType2(listRes.totalType2);
    }
    setSettlementsLoading(false);
  }, [branchSlug, offset, pageSize, showToast]);

  const reloadAll = useCallback(async (silent = false) => {
    setRefreshing(true);
    setOffset(0);
    await Promise.all([
      loadOverview(silent),
      loadAgentGroups(silent),
      loadWalletTransactions(silent),
      loadSettlements(silent),
    ]);
    setRefreshing(false);
  }, [loadOverview, loadAgentGroups, loadWalletTransactions, loadSettlements]);

  usePageRefresh(() => reloadAll(true));

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadAgentGroups();
  }, [loadAgentGroups]);

  useEffect(() => {
    void loadWalletTransactions();
  }, [loadWalletTransactions]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const openAssign = (customerId?: string) => {
    setAssignCustomerId(customerId);
    setAssignOpen(true);
  };

  const tabCounts = {
    customers: customers.length,
    agents: groups.length,
    payments: walletTxTotal,
    settlements: total,
  };

  const tabs: { id: FxTab; label: string; count: number }[] = [
    { id: 'customers', label: 'Customers & agents', count: tabCounts.customers },
    { id: 'agents', label: 'Agent balances', count: tabCounts.agents },
    { id: 'payments', label: 'Wallet transactions', count: tabCounts.payments },
    { id: 'settlements', label: 'Settlements', count: tabCounts.settlements },
  ];

  return (
    <div className="space-y-3">
      <FxHeader
        pendingCount={stats.pendingPayments}
        onAssignAgents={() => openAssign()}
        onTransfer={() => setTransferOpen(true)}
        onRefresh={() => void reloadAll(true)}
        refreshing={refreshing}
      />

      <FxKpiCards stats={stats} />

      <PendingWalletApprovalsPanel branchSlug={branchSlug} onChanged={() => void reloadAll()} />
      <PendingFxSettlementRequestsPanel branchSlug={branchSlug} onChanged={() => void reloadAll()} />

      <div className={asicCard}>
        <AsicTabBar tabs={tabs} activeTab={tab} onTabChange={id => setTab(id as FxTab)} ariaLabel="FX sections" />

        {tab === 'customers' ? (
          <FxCustomersPanel
            customers={customers}
            loading={overviewLoading}
            showBranch={showBranch}
            onAssign={id => openAssign(id)}
          />
        ) : null}

        {tab === 'agents' ? (
          <div className="p-3">
            <FxAgentBalancesPanel
              groups={groups}
              loading={agentsLoading}
              branches={branches}
              onSettle={group =>
                setBatchAgent({
                  id: group.collectionAccountId,
                  name: group.collectionAccountName,
                  sales: group.sales,
                  agentBalance: group.agentBalance,
                })
              }
            />
          </div>
        ) : null}

        {tab === 'payments' ? (
          <FxWalletTransactionsPanel transactions={walletTransactions} loading={paymentsLoading} />
        ) : null}

        {tab === 'settlements' ? (
          <FxSettlementsTable
              rows={settlements}
              loading={settlementsLoading}
              total={total}
              totalType2={totalType2}
              offset={offset}
              pageSize={pageSize}
              onPrev={() => setOffset(o => Math.max(0, o - pageSize))}
            onNext={() => setOffset(o => o + pageSize)}
          />
        ) : null}
      </div>

      {assignOpen ? (
        <AssignCustomerAgentsModal
          open={assignOpen}
          onClose={() => {
            setAssignOpen(false);
            setAssignCustomerId(undefined);
          }}
          branchSlug={branchSlug}
          initialCustomerId={assignCustomerId}
          overviewCustomers={customers}
          onSuccess={() => void reloadAll()}
        />
      ) : null}

      {transferOpen ? (
        <AgentTransferModal
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          branchSlug={branchSlug}
          onSuccess={() => void reloadAll()}
        />
      ) : null}

      {batchAgent ? (
        <BatchFxSettlementModal
          open={!!batchAgent}
          onClose={() => setBatchAgent(null)}
          collectionAccountId={batchAgent.id}
          collectionAccountName={batchAgent.name}
          sales={batchAgent.sales}
          agentBalance={batchAgent.agentBalance}
          branchSlug={branchSlug}
          onSuccess={() => {
            setBatchAgent(null);
            void reloadAll();
          }}
        />
      ) : null}
    </div>
  );
}
