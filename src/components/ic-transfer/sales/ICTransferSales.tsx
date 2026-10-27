'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useICTransferRegionFilter } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import { matchesSaleRegionFilter } from '@/lib/icTransfer/regionFilter';
import { useApp } from '@/context/AppContext';
import { getCustomersBySlug } from '@/app/actions/customerActions';
import {
  scopeSalesForBranchAdmin,
  saleMatchesDateFilter,
  saleMatchesSearchQuery,
} from '@/lib/icTransfer/branchOrderOwnership';
import { resolveDateFilterRange } from '@/lib/dateFilterRange';
import { useICTransferFilters } from '../ui';
import { canManageICTransferGlobalSettings } from '@/lib/icTransfer/settings';
import AddSaleModal from './AddSaleModal';
import ViewSaleModal from './ViewSaleModal';
import { ICSale } from '@/types';
import { ConfirmModal } from '@/components/warehouse/shared';
import { isBranchHandledSale } from '@/lib/icTransfer/fulfillmentHandler';
import { IC_ORDER_STATUSES, getAdminStatusLabel, normalizeOrderStatus, getCustomerOrderStatus } from '@/lib/icTransfer/orderStatus';
import { hasAdminWorkflowActions } from '@/lib/icTransfer/orderWorkflowRules';
import { comparePriority } from '@/lib/icTransfer/orderPriority';
import { getDeliveredUnits, getRemainingUnits } from '@/lib/icTransfer/saleUnits';
import { adminBulkVerifyDeliveryAction } from '@/app/actions/icTransferActions';
import SalesHeader from './sales-header';
import { useWriteAccess } from '@/context/RbacWriteContext';
import SalesKpiCards from './sales-kpi-cards';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import SalesDataTable, { type SalesTab } from './sales-data-table';
import { getAdminSaleCustomerName } from '@/lib/icTransfer/branchOrderOwnership';

export default function ICTransferSales() {
  const {
    icSales,
    icWarehouses,
    deleteICSale,
    branches,
    allBranches,
    currentSlug,
    refetchData,
    showToast,
    user,
    icTransferSettings,
    updateICTransferSalesEnabled,
  } = useApp();
  const { canWrite } = useWriteAccess();

  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
  const canManageGlobalSettings = canManageICTransferGlobalSettings(user);
  const salesPaused = !icTransferSettings.salesEnabled;
  const [isTogglingSales, setIsTogglingSales] = useState(false);
  const { selectedRegionIds } = useICTransferRegionFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<ICSale | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterWarehouse, setFilterWarehouse] = useState('All');
  const [tab, setTab] = useState<SalesTab>('all');
  const [sortField, setSortField] = useState('Priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<ICSale | null>(null);
  const [selectedVerifyIds, setSelectedVerifyIds] = useState<Set<string>>(new Set());
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);
  const [bulkVerifyLoading, setBulkVerifyLoading] = useState(false);
  const [branchCustomers, setBranchCustomers] = useState<{ id: string; name: string }[]>([]);

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const getWarehouseName = (id?: string) => icWarehouses.find(w => w.id === id)?.name || 'None';

  const branchName =
    branches.find(b => b.slug === currentSlug)?.name ||
    allBranches.find(b => b.slug === currentSlug)?.name ||
    currentSlug ||
    '';
  const isBranchAdminView = !!branchSlug;
  const txnBranchName = isBranchAdminView ? branchName : undefined;

  const branchCustomerIds = useMemo(
    () => new Set(branchCustomers.map(c => c.id)),
    [branchCustomers],
  );

  const branchCustomerNames = useMemo(
    () => new Set(branchCustomers.map(c => c.name.trim().toLowerCase())),
    [branchCustomers],
  );

  useEffect(() => {
    if (!branchSlug) return;
    getCustomersBySlug(branchSlug).then(res => {
      if (res.success && res.customers) {
        setBranchCustomers(res.customers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    });
  }, [branchSlug]);

  const scopedSales = useMemo(() => {
    if (!isBranchAdminView) return icSales;
    return scopeSalesForBranchAdmin(
      icSales,
      branchName,
      branchCustomerIds,
      branchCustomerNames,
      allBranches,
    );
  }, [icSales, isBranchAdminView, branchName, branchCustomerIds, branchCustomerNames, allBranches]);

  const baseFilteredSales = useMemo<ICSale[]>(() => {
    const range = resolveDateFilterRange(dateFilter, customStartDate, customEndDate);

    return scopedSales.filter((s: ICSale) => {
      if (!saleMatchesDateFilter(s, range)) return false;
      if (search && !saleMatchesSearchQuery(s, search, branches, branchName)) return false;
      if (!matchesSaleRegionFilter(s, icWarehouses, selectedRegionIds)) return false;

      if (filterStatus !== 'All') {
        if (filterStatus === 'paid') return s.paymentStatus === 'paid';
        if (filterStatus === 'Partial') return getCustomerOrderStatus(s) === 'Partial';
        if (IC_ORDER_STATUSES.includes(filterStatus as (typeof IC_ORDER_STATUSES)[number])) {
          return normalizeOrderStatus(s.orderStatus) === filterStatus;
        }
      }
      if (filterWarehouse !== 'All') {
        if (filterWarehouse === 'None') return !s.warehouseId;
        return s.warehouseId === filterWarehouse;
      }
      return true;
    });
  }, [
    scopedSales,
    search,
    selectedRegionIds,
    icWarehouses,
    filterStatus,
    filterWarehouse,
    dateFilter,
    customStartDate,
    customEndDate,
    branches,
    branchName,
  ]);

  const tabCounts = useMemo(
    () => ({
      needsAction: baseFilteredSales.filter(s => hasAdminWorkflowActions(s)).length,
      all: baseFilteredSales.length,
      awaitingVerification: baseFilteredSales.filter(
        s => normalizeOrderStatus(s.orderStatus) === 'delivery_pending_admin',
      ).length,
    }),
    [baseFilteredSales],
  );

  const filteredSales = useMemo<ICSale[]>(() => {
    if (tab === 'needs_action') {
      return baseFilteredSales.filter(s => hasAdminWorkflowActions(s));
    }
    if (tab === 'awaiting_verification') {
      return baseFilteredSales.filter(
        s => normalizeOrderStatus(s.orderStatus) === 'delivery_pending_admin',
      );
    }
    return baseFilteredSales;
  }, [baseFilteredSales, tab]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedSales = useMemo<ICSale[]>(() => {
    const sorted = [...filteredSales];
    sorted.sort((a, b) => {
      if (tab === 'all') {
        const actionDiff = Number(hasAdminWorkflowActions(b)) - Number(hasAdminWorkflowActions(a));
        if (actionDiff !== 0) return actionDiff;
      }

      let valA: string | number;
      let valB: string | number;

      if (sortField === 'Customer') {
        valA = getAdminSaleCustomerName(a, branchName, branches) || '';
        valB = getAdminSaleCustomerName(b, branchName, branches) || '';
      } else if (sortField === 'Units') {
        valA = Number(a.units || 0);
        valB = Number(b.units || 0);
      } else if (sortField === 'Total AED') {
        valA = Number(a.aedAmount || 0);
        valB = Number(b.aedAmount || 0);
      } else if (sortField === 'Delivered Units') {
        valA = getDeliveredUnits(Number(a.units || 0), a.collectedUnits, a.orderStatus);
        valB = getDeliveredUnits(Number(b.units || 0), b.collectedUnits, b.orderStatus);
      } else if (sortField === 'Remaining Units') {
        valA = getRemainingUnits(Number(a.units || 0), a.collectedUnits, a.orderStatus);
        valB = getRemainingUnits(Number(b.units || 0), b.collectedUnits, b.orderStatus);
      } else if (sortField === 'Warehouse') {
        valA = getWarehouseName(a.warehouseId);
        valB = getWarehouseName(b.warehouseId);
      } else if (sortField === 'Priority') {
        const order: Record<string, number> = { High: 0, Normal: 1, Low: 2 };
        valA = order[a.priority || 'Normal'] ?? 1;
        valB = order[b.priority || 'Normal'] ?? 1;
      } else if (sortField === 'Status') {
        valA = a.orderStatus || 'pending';
        valB = b.orderStatus || 'pending';
      } else {
        valA = new Date(a.createdAt || '').getTime();
        valB = new Date(b.createdAt || '').getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      const priDiff = comparePriority(a.priority, b.priority, 'asc');
      if (priDiff !== 0) return priDiff;
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
    return sorted;
  }, [filteredSales, sortField, sortOrder, branchName, branches, tab, getWarehouseName]);

  const stats = useMemo(() => {
    const totalOrders = filteredSales.length;
    const totalValue = filteredSales.reduce((acc: number, s: ICSale) => acc + (s.aedAmount || 0), 0);
    const totalUnits = filteredSales.reduce((acc: number, s: ICSale) => acc + s.units, 0);
    const avgRate = totalUnits > 0 ? totalValue / totalUnits : 0;
    const pendingCount = filteredSales.filter(
      (s: ICSale) => normalizeOrderStatus(s.orderStatus) === 'pending',
    ).length;
    const pendingVerificationCount = filteredSales.filter(
      (s: ICSale) => normalizeOrderStatus(s.orderStatus) === 'delivery_pending_admin',
    ).length;
    const partialCount = filteredSales.filter(
      (s: ICSale) => getCustomerOrderStatus(s) === 'Partial',
    ).length;
    const totalPartialUnitsDelivered = filteredSales
      .filter((s: ICSale) => getCustomerOrderStatus(s) === 'Partial' || !!s.derivedFromSaleId)
      .reduce(
        (acc: number, s: ICSale) => acc + getDeliveredUnits(s.units, s.collectedUnits, s.orderStatus),
        0,
      );

    return {
      totalOrders,
      totalValue,
      totalUnits,
      avgRate,
      pendingCount,
      pendingVerificationCount,
      partialCount,
      totalPartialUnitsDelivered,
    };
  }, [filteredSales]);

  const statusOptions = useMemo(
    () => [
      ...IC_ORDER_STATUSES.map(st => ({ value: st, label: getAdminStatusLabel(st) })),
      { value: 'paid', label: 'Fully Paid' },
      { value: 'Partial', label: 'Partial Delivered' },
    ],
    [],
  );

  useEffect(() => {
    if (!viewModalOpen || !selectedSale) return;
    const fresh = icSales.find(s => s.id === selectedSale.id);
    if (fresh) setSelectedSale(fresh);
  }, [icSales, viewModalOpen, selectedSale?.id]);

  useEffect(() => {
    setSelectedVerifyIds(new Set());
  }, [tab]);

  const allVerifySelected =
    sortedSales.length > 0 && sortedSales.every(s => selectedVerifyIds.has(s.id));

  const handleSalesToggle = async (enabled: boolean) => {
    if (!canWrite) return;
    setIsTogglingSales(true);
    await updateICTransferSalesEnabled(enabled);
    setIsTogglingSales(false);
  };

  const handleBulkVerifyConfirm = async () => {
    if (!canWrite) return;
    const ids = [...selectedVerifyIds];
    if (ids.length === 0) return;
    setBulkVerifyLoading(true);
    const res = await adminBulkVerifyDeliveryAction(ids, branchSlug);
    setBulkVerifyLoading(false);
    if (res.success && res.data) {
      const { verifiedCount, failedCount } = res.data;
      if (failedCount > 0) {
        showToast(
          `Verified ${verifiedCount} order(s). ${failedCount} could not be verified.`,
          verifiedCount > 0 ? 'success' : 'error',
        );
      } else {
        showToast(`Verified ${verifiedCount} order(s)`, 'success');
      }
      setBulkVerifyOpen(false);
      setSelectedVerifyIds(new Set());
      await refetchData();
    } else {
      showToast(res.error || 'Failed to verify deliveries', 'error');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col font-sans">
      <div className="shrink-0 space-y-2">
        <SalesHeader
          salesPaused={salesPaused}
          canManageGlobalSettings={canManageGlobalSettings}
          isTogglingSales={isTogglingSales}
          onAddSale={() => canWrite && setModalOpen(true)}
          onSalesToggle={handleSalesToggle}
          addDisabled={salesPaused || !canWrite}
        />

        <ICTransferDateFilterBar
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
        />

        <SalesKpiCards stats={stats} />
      </div>

      <div className="min-h-0 flex-1 pt-2">
        <SalesDataTable
        tab={tab}
        onTabChange={setTab}
        tabCounts={tabCounts}
        sales={sortedSales}
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        filterWarehouse={filterWarehouse}
        onFilterWarehouseChange={setFilterWarehouse}
        statusOptions={statusOptions}
        warehouses={icWarehouses}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        selectedVerifyIds={selectedVerifyIds}
        onToggleVerify={id =>
          setSelectedVerifyIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onToggleSelectAllVerify={() => {
          if (allVerifySelected) setSelectedVerifyIds(new Set());
          else setSelectedVerifyIds(new Set(sortedSales.map(s => s.id)));
        }}
        allVerifySelected={allVerifySelected}
        selectedVerifyCount={selectedVerifyIds.size}
        onBulkVerify={() => setBulkVerifyOpen(true)}
        onView={s => {
          setSelectedSale(s);
          setViewModalOpen(true);
        }}
        onEdit={s => {
          setSelectedSale(s);
          setModalOpen(true);
        }}
        onDelete={(e, s) => {
          e.stopPropagation();
          setSaleToDelete(s);
          setConfirmDeleteOpen(true);
        }}
        getWarehouseName={getWarehouseName}
        branchName={branchName}
        branches={branches}
        txnBranchName={txnBranchName}
        />
      </div>

      <AddSaleModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedSale(null);
        }}
        initialData={selectedSale || undefined}
      />
      <ViewSaleModal
        open={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedSale(null);
        }}
        sale={selectedSale}
        onEdit={selectedSale && isBranchHandledSale(selectedSale) ? undefined : s => {
          setSelectedSale(s);
          setModalOpen(true);
        }}
        workflowVariant="admin"
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
        confirmLabel="Delete Sale"
        variant="danger"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!saleToDelete) return;
          setDeleteLoading(true);
          await deleteICSale(saleToDelete.id);
          setDeleteLoading(false);
          setConfirmDeleteOpen(false);
          setSaleToDelete(null);
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmModal
        open={bulkVerifyOpen}
        title="Verify Selected Deliveries"
        message={
          selectedVerifyIds.size === 1
            ? 'Confirm delivery proof and mark this order as completed? The customer will see the order as delivered.'
            : `Confirm delivery proof and mark ${selectedVerifyIds.size} orders as completed? Customers will see these orders as delivered.`
        }
        confirmLabel={
          selectedVerifyIds.size === 1
            ? 'Verify Delivery'
            : `Verify ${selectedVerifyIds.size} Orders`
        }
        variant="success"
        loading={bulkVerifyLoading}
        onConfirm={handleBulkVerifyConfirm}
        onCancel={() => setBulkVerifyOpen(false)}
      />
    </div>
  );
}
