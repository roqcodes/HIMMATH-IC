'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { getCustomersBySlug } from '@/app/actions/customerActions';
import { useICTransferRegionFilter } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import { matchesSaleRegionFilter } from '@/lib/icTransfer/regionFilter';
import { useApp } from '@/context/AppContext';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import {
  DataTableSection,
  PageHeader,
  PageShell,
  useICTransferFilters,
  AddButton,
  icTdClass,
} from '../ui';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import AddICBranchOrderModal from './AddICBranchOrderModal';
import ViewSaleModal from '../sales/ViewSaleModal';
import { ICSale } from '@/types';
import { portalMobileCardFooterClass } from '@/lib/icTransfer/layoutConstants';
import { BranchOrderStatusCell, BranchOrderWorkflowActions } from '../shared/BranchOrderStatusCell';
import { sumMetalSaleWeightG } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { ConfirmModal } from '@/components/warehouse/shared';
import { getBranchPortalOrderCustomerName, saleBelongsToBranchPortal, saleMatchesDateFilter } from '@/lib/icTransfer/branchOrderOwnership';
import { resolveDateFilterRange } from '@/lib/dateFilterRange';
import { canEditOrder } from '@/lib/icTransfer/customerOrderReview';
import { getBranchPortalDisplayName } from '@/lib/icTransfer/branchPortalScope';

const fmt = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;

const ORDER_COLUMNS = [
  'Date', 'ID', 'Customer', 'Settlement', 'Units', 'Metal (g)', 'Total AED', 'Status', 'Actions',
] as const;

type SortField = 'date' | 'customer' | 'units' | 'totalaed' | 'metal' | 'settlement';
const SORTABLE_COLUMNS: Record<string, SortField> = {
  date: 'date',
  customer: 'customer',
  units: 'units',
  totalaed: 'totalaed',
  'metal (g)': 'metal',
  'metal(g)': 'metal',
  settlement: 'settlement',
};

export default function ICTransferBranch() {
  const {
    icSales,
    icWarehouses,
    currentSlug,
    branches,
    branchDeleteICSale,
    branchRequestCancelICSale,
    user,
    icTransferSettings,
    showToast,
  } = useApp();
  const salesPaused = !icTransferSettings.salesEnabled;
  const { selectedRegionIds } = useICTransferRegionFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<ICSale | null>(null);
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [branchCustomers, setBranchCustomers] = useState<{ id: string; name: string }[]>([]);

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const currentBranch = branches.find(b => b.slug === currentSlug) ?? branches.find(b => b.id === user?.branchId);
  const branchName = currentBranch?.name || currentSlug || 'Branch Customer';
  const branchPortalDisplay = getBranchPortalDisplayName(currentBranch);
  const pageDisplay = branchPortalDisplay;
  const currentBranchId = currentBranch?.id ?? user?.branchId;

  const orderColumns = ORDER_COLUMNS;

  const getOrderCustomer = (s: ICSale) => getBranchPortalOrderCustomerName(s, branchName);

  const branchCustomerIds = useMemo(
    () => new Set(branchCustomers.map(c => c.id)),
    [branchCustomers],
  );

  const branchCustomerNames = useMemo(
    () => new Set(branchCustomers.map(c => c.name.trim().toLowerCase())),
    [branchCustomers],
  );

  const getWarehouseName = (id?: string) => icWarehouses.find(w => w.id === id)?.name || 'None';

  useEffect(() => {
    if (!currentSlug) return;
    getCustomersBySlug(currentSlug).then(res => {
      if (res.success && res.customers) {
        setBranchCustomers(res.customers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    });
  }, [currentSlug]);

  const branchSales = useMemo(() => {
    return icSales.filter(s => saleBelongsToBranchPortal(s, branchName, branchCustomerIds, branchCustomerNames));
  }, [icSales, branchName, branchCustomerIds, branchCustomerNames]);

  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    branchCustomers.forEach(c => names.add(c.name));
    branchSales.forEach(s => {
      const name = getBranchPortalOrderCustomerName(s, branchName);
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [branchCustomers, branchSales, branchName]);

  const filteredSales = useMemo(() => {
    const dateRange = resolveDateFilterRange(dateFilter, customStartDate, customEndDate);
    const q = search.trim().toLowerCase();
    const rows = branchSales.filter(s => {
      if (!saleMatchesDateFilter(s, dateRange)) return false;
      const orderCustomer = getOrderCustomer(s);
      const formattedId = getFormattedTxnId(s.id, 'sale', s, branches, branchName);
      if (q &&
          !formattedId.toLowerCase().includes(q) &&
          !s.id.toLowerCase().includes(q) &&
          !orderCustomer.toLowerCase().includes(q)) return false;
      if (customerFilter && orderCustomer !== customerFilter) return false;
      if (!matchesSaleRegionFilter(s, icWarehouses, selectedRegionIds)) {
        return false;
      }
      return true;
    });

    const dir = sortOrder === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      switch (sortField) {
        case 'customer':
          return getOrderCustomer(a).localeCompare(getOrderCustomer(b)) * dir;
        case 'units':
          return (a.units - b.units) * dir;
        case 'totalaed':
          return ((a.aedAmount || 0) - (b.aedAmount || 0)) * dir;
        case 'metal':
          return ((a.metalWeightG ?? 0) - (b.metalWeightG ?? 0)) * dir;
        case 'settlement': {
          const modeA = a.settlementMode === 'metal' ? 1 : 0;
          const modeB = b.settlementMode === 'metal' ? 1 : 0;
          return (modeA - modeB) * dir;
        }
        case 'date':
        default:
          return (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()) * dir;
      }
    });
  }, [branchSales, branches, search, customerFilter, selectedRegionIds, icWarehouses, sortField, sortOrder, branchName, dateFilter, customStartDate, customEndDate]);

  const handleHeaderClick = (column: string) => {
    const key = column.toLowerCase().replace(/\s/g, '');
    const field = SORTABLE_COLUMNS[key];
    if (!field) return;
    if (field === sortField) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<ICSale | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ICSale | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleEdit = (s: ICSale) => {
    if (!canEditOrder(s, user?.role)) return;
    setSelectedSale(s);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    await branchDeleteICSale(deleteTarget.id);
    setActionLoading(false);
    setDeleteTarget(null);
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setActionLoading(true);
    await branchRequestCancelICSale(cancelTarget.id);
    setActionLoading(false);
    setCancelTarget(null);
  };

  const handleCreateOrder = () => {
    if (salesPaused) {
      showToast('Sales are temporarily paused. New orders cannot be created right now.', 'error');
      return;
    }
    setSelectedSale(null);
    setModalOpen(true);
  };

  const handleView = (s: ICSale) => {
    setSelectedSale(s);
    setViewModalOpen(true);
  };

  const stats = React.useMemo(() => {
    const totalOrders = branchSales.length;
    const totalUnits = branchSales.reduce((acc, s) => acc + s.units, 0);
    const totalValue = branchSales.reduce((acc, s) => acc + (s.aedAmount || 0), 0);
    const avgRate = totalUnits > 0 ? totalValue / totalUnits : 0;
    const totalMetalG = sumMetalSaleWeightG(branchSales);
    const metalCount = branchSales.filter(s => s.settlementMode === 'metal').length;
    const cashCount = branchSales.filter(s => s.settlementMode !== 'metal').length;
    const pendingPayment = branchSales.filter(s => s.paymentStatus === 'pending').length;

    return {
      totalOrders,
      totalUnits,
      totalValue,
      avgRate,
      totalMetalG,
      metalCount,
      cashCount,
      pendingPayment,
    };
  }, [branchSales]);

  return (
    <PageShell>
      <PageHeader
        title={pageDisplay.title}
        actions={
          <AddButton label="Create Order" onClick={handleCreateOrder} disabled={salesPaused} />
        }
      />

      {salesPaused ? (
        <div
          role="status"
          className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
        >
          Sales are temporarily paused. New orders cannot be created right now.
        </div>
      ) : null}

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <AsicKpiStrip
        metrics={[
          {
            label: 'Sales volume',
            value: fmt(stats.totalValue),
            hint: `${stats.cashCount} IC · ${stats.metalCount} metal`,
          },
          {
            label: 'IC units',
            value: stats.totalUnits.toLocaleString(),
            hint: `Avg ${fmt(stats.avgRate)}`,
          },
          {
            label: 'Metal sold',
            value: `${stats.totalMetalG.toLocaleString('en-US', { maximumFractionDigits: 4 })} g`,
            hint: 'In selected range',
            tone: 'amber',
          },
          {
            label: 'Sales',
            value: stats.totalOrders.toLocaleString(),
            hint: `${stats.pendingPayment} pending payment`,
            tone: 'emerald',
          },
        ]}
      />

      <DataTableSection
        title="All Orders"
        columns={[...orderColumns]}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search orders..."
        onHeaderClick={handleHeaderClick}
        sortField={sortField}
        sortOrder={sortOrder}
        toolbar={
          <div className="relative">
            <select
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 focus:border-accent focus:outline-none sm:w-56"
              aria-label="Filter by customer"
            >
              <option value="">All Customers</option>
              {customerOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        }
        mobileView={
          filteredSales.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No orders found.</div>
          ) : (
            filteredSales.map(s => (
              <div
                key={s.id}
                onClick={() => handleView(s)}
                className="flex flex-col gap-3 rounded-lg border p-3 shadow-surface-xs cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{getOrderCustomer(s)}</p>
                  <p className="mt-0.5 text-xs font-mono text-slate-500">{getFormattedTxnId(s.id, 'sale', s, branches, branchName)}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{new Date(s.createdAt || '').toLocaleString()}</p>
                </div>
                <div className="flex justify-between items-center rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-500">
                  <span>{s.settlementMode === 'metal' ? 'Metal' : 'IC'} · Units: <strong className="text-slate-700">{s.units.toLocaleString()}</strong></span>
                  <span>Total: <strong className="text-slate-700">{(s.aedAmount || 0).toLocaleString()} AED</strong></span>
                </div>
                {s.settlementMode === 'metal' ? (
                  <div className="text-xs text-slate-500">
                    Metal: <strong className="text-slate-700">{(s.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} g</strong>
                  </div>
                ) : null}
                <div onClick={e => e.stopPropagation()}>
                  <BranchOrderWorkflowActions
                    sale={s}
                    inline
                    onView={handleView}
                    onResubmit={handleEdit}
                    onDelete={setDeleteTarget}
                    onCancelRequest={setCancelTarget}
                  />
                </div>
                <div className={portalMobileCardFooterClass}>
                  <div className="min-w-0">
                    <BranchOrderStatusCell sale={s} />
                  </div>
                </div>
              </div>
            ))
          )
        }
      >
        {filteredSales.map((s) => (
          <tr key={s.id} onClick={() => handleView(s)} className="cursor-pointer hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0 group">
            <td className={icTdClass('left')}>{new Date(s.createdAt || '').toLocaleDateString()}</td>
            <td className={icTdClass('left')}><span className="font-mono text-slate-500">{getFormattedTxnId(s.id, 'sale', s, branches, branchName)}</span></td>
            <td className={icTdClass('left')}><span className="font-semibold text-slate-900">{getOrderCustomer(s)}</span></td>
            <td className={icTdClass('left')}>
              {s.settlementMode === 'metal' ? 'Metal' : 'IC'}
            </td>
            <td className={icTdClass('right')}>{s.units.toLocaleString()}</td>
            <td className={icTdClass('right')}>
              {s.settlementMode === 'metal'
                ? (s.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
                : '—'}
            </td>
            <td className={icTdClass('right')}><span className="font-bold text-slate-900">{(s.aedAmount || 0).toLocaleString()}</span></td>
            <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
              <BranchOrderStatusCell sale={s} />
            </td>
            <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
              <BranchOrderWorkflowActions
                sale={s}
                inline
                onView={handleView}
                onResubmit={handleEdit}
                onDelete={setDeleteTarget}
                onCancelRequest={setCancelTarget}
              />
            </td>
          </tr>
        ))}
      </DataTableSection>

      <AddICBranchOrderModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedSale(null); }}
        initialData={selectedSale || undefined}
      />
      <ViewSaleModal
        open={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setSelectedSale(null); }}
        sale={selectedSale}
        workflowVariant="branch"
        onEdit={
          selectedSale && canEditOrder(selectedSale, user?.role) ? handleEdit : undefined
        }
        branchId={currentBranchId}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Order"
        message="Are you sure you want to delete this pending order? This action cannot be undone."
        confirmLabel="Delete Order"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!cancelTarget}
        title="Request Cancellation"
        message="Request cancellation of this accepted order? An admin will review and confirm the cancellation."
        confirmLabel="Request Cancellation"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelTarget(null)}
      />
    </PageShell>
  );
}
