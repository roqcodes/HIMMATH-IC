'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import type { AsicPortal } from '@/lib/asic/routing';
import type { AsicSectionId } from '@/lib/asic/pages';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';
import type { ICFundsSectionId } from '@/lib/icFunds/nav';

const ICFundsApp = dynamic(() => import('@/components/ic-funds/ICFundsApp'));
const ICTransferBranch = dynamic(() => import('@/components/ic-transfer/branch/ICTransferBranch'));
const ICTransferDashboard = dynamic(() => import('@/components/ic-transfer/dashboard/ICTransferDashboard'));
const ICTransferSales = dynamic(() => import('@/components/ic-transfer/sales/ICTransferSales'));
const ICTransferPurchase = dynamic(() => import('@/components/ic-transfer/purchase/ICTransferPurchase'));
const ICTransferWarehouse = dynamic(() => import('@/components/ic-transfer/warehouse/ICTransferWarehouse'));
const ICTransferRegions = dynamic(() => import('@/components/ic-transfer/regions/ICTransferRegions'));
const ICTransferSuppliersPage = dynamic(
  () => import('@/components/ic-transfer/settings/ICTransferSuppliersPage'),
);
const FxSettlementsPage = dynamic(
  () => import('@/components/ic-transfer/collection/FxSettlementsPage'),
);
const CollectionAgentFxPage = dynamic(
  () => import('@/components/collection-agent/CollectionAgentFxPage'),
);
const CustomerWalletPage = dynamic(() => import('@/components/customer/CustomerWalletPage'));
const ICTransferRatesPage = dynamic(() => import('@/components/ic-transfer/settings/ICTransferRatesPage'));
const ICTransferSettingsUsersPage = dynamic(
  () => import('@/components/ic-transfer/settings/ICTransferSettingsUsersPage'),
);
const ICTransferFinance = dynamic(() => import('@/components/ic-transfer/finance/ICTransferFinance'));
const CustomersPage = dynamic(() => import('@/components/customers/CustomersPage'));
const BranchesScreen = dynamic(() => import('@/modules/admin/screens/BranchesScreen'));
const GlobalSettingsScreen = dynamic(() => import('@/modules/admin/screens/GlobalSettingsScreen'));
const AuditLogScreen = dynamic(() => import('@/modules/admin/screens/AuditLogScreen'));
const ReconciliationScreen = dynamic(() => import('@/modules/admin/screens/ReconciliationScreen'));
const BackupScreen = dynamic(() => import('@/modules/admin/screens/BackupScreen'));
const UsersManagementGate = dynamic(() => import('@/modules/admin/screens/UsersManagementGate'));
const BranchUsersManagementGate = dynamic(() => import('@/modules/branch/BranchUsersManagementGate'));
const StaffAccountSettings = dynamic(() => import('@/components/users/StaffAccountSettings'));
const WarehouseOrdersGate = dynamic(() => import('@/modules/warehouse/WarehouseOrdersGate'));
const WarehouseDeliveryGate = dynamic(() => import('@/modules/warehouse/WarehouseDeliveryGate'));
const DeliverySettlementGate = dynamic(() => import('@/modules/warehouse/DeliverySettlementGate'));

const FUND_SECTIONS: Partial<Record<AsicSectionId, ICFundsSectionId>> = {
  payments: 'payments',
  receipts: 'receipts',
  contra: 'contra',
  journal: 'journal',
  pl: 'pl',
  accounts: 'accounts',
  reports: 'reports',
};

export default function ASICSectionRouter({
  portal,
  section,
  slug,
}: {
  portal: AsicPortal;
  section: AsicSectionId;
  slug?: string;
}) {
  const purchaseMode = portal === 'admin' ? 'admin' : 'branch';
  const fundSection = FUND_SECTIONS[section];

  let body: React.ReactNode;

  if (fundSection) {
    body = (
      <ICFundsApp
        section={fundSection}
        portal={portal}
        branchSlug={portal === 'branch' ? slug : undefined}
      />
    );
  } else {
    switch (section) {
      case 'dashboard':
        body = <ICTransferDashboard />;
        break;
      case 'orders':
        body =
          portal === 'warehouse' ? (
            <WarehouseOrdersGate slug={slug} />
          ) : (
            <ICTransferBranch />
          );
        break;
      case 'wallet':
        body = portal === 'customer' ? <CustomerWalletPage /> : <p className="text-sm text-slate-500">Unknown section.</p>;
        break;
      case 'sales':
        body = <ICTransferSales />;
        break;
      case 'purchases':
        body = <ICTransferPurchase portalMode={purchaseMode} />;
        break;
      case 'warehouse':
        body = <ICTransferWarehouse />;
        break;
      case 'customers':
        body = <CustomersPage />;
        break;
      case 'regions':
        body = <ICTransferRegions />;
        break;
      case 'suppliers':
        body = <ICTransferSuppliersPage />;
        break;
      case 'fx-settlements':
        body =
          portal === 'collection' ? (
            <CollectionAgentFxPage />
          ) : (
            <FxSettlementsPage />
          );
        break;
      case 'rates':
        body = <ICTransferRatesPage />;
        break;
      case 'agents':
        body = (
          <ICTransferSettingsUsersPage
            title="Agents"
            subtitle="Manage agent accounts and access"
            modalTitle="Add User"
            showRate
          />
        );
        break;
      case 'commission':
        body = (
          <ICTransferSettingsUsersPage
            title="Commission"
            subtitle="Configure commission rates for agents"
            addButtonLabel="Add Agent"
            modalTitle="Add User"
            showCommission
            showRate={false}
          />
        );
        break;
      case 'ic-finance':
        body = <ICTransferFinance />;
        break;
      case 'branches':
        body = <BranchesScreen />;
        break;
      case 'users':
        body =
          portal === 'branch' ? (
            <BranchUsersManagementGate slug={slug} />
          ) : (
            <UsersManagementGate />
          );
        break;
      case 'global-settings':
        body = <GlobalSettingsScreen />;
        break;
      case 'audit-log':
        body = <AuditLogScreen />;
        break;
      case 'reconciliation':
        body = <ReconciliationScreen />;
        break;
      case 'backup':
        body = <BackupScreen />;
        break;
      case 'delivery-agents':
        body = <WarehouseDeliveryGate slug={slug} />;
        break;
      case 'settlement':
        body = <DeliverySettlementGate slug={slug} />;
        break;
      case 'account':
        body = <StaffAccountSettings branchSlug={slug} />;
        break;
      default:
        body = <p className="text-sm text-slate-500">Unknown section.</p>;
    }
  }

  return (
    <Suspense fallback={<ASICPageSkeleton />}>
      <div key={`${portal}:${section}:${slug ?? ''}`}>{body}</div>
    </Suspense>
  );
}
