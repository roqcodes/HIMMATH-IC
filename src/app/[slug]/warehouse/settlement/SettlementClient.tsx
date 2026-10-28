'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import WarehousePortalShell from '@/components/warehouse/WarehousePortalShell';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import SalesTableShell, {
  salesTableClass,
  salesTableEmptyClass,
  salesTableRowInteractiveClass,
  salesTableTdClass,
  salesTableThSortableClass,
  salesTableTheadRowClass,
  salesTableSelectClass,
} from '@/components/ic-transfer/shared/SalesTableShell';
import {
  fetchWarehouseOrders,
  fetchWarehouseUndeliveredOrders,
  fetchDeliveryAgents,
  warehouseRejectOrder,
} from '@/app/actions/warehouseActions';
import { formatDateTime } from '@/lib/format';
import AssignDeliveryAgentModal from './AssignDeliveryAgentModal';
import WarehouseAcceptOrderModal from './WarehouseAcceptOrderModal';
import OrderDetailsModal from './OrderDetailsModal';
import DateFilterBar from '@/components/ui/DateFilterBar';
import { PriorityBadge, SkeletonRows } from '@/components/warehouse/shared';
import { WarehouseOrderStatusCard, WarehouseOrderWorkflowActions, WarehouseAgentNameCell } from '@/components/warehouse/WarehouseOrderStatusCell';
import RejectRemarkModal from '@/components/ic-transfer/shared/RejectRemarkModal';
import { isWarehouseRejected, isWarehouseDirectDeliverOrder } from '@/lib/icTransfer/orderStatus';
import { comparePriority, highPriorityRowClass, highPriorityCardClass } from '@/lib/icTransfer/orderPriority';
import { formatUnits, getDeliveredUnits, getRemainingUnits, isSaleCompleted } from '@/lib/icTransfer/saleUnits';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import WarehouseKpiGrid from '@/components/warehouse/WarehouseKpiGrid';
import { computeWarehouseSettlementKpis } from '@/lib/warehouse/kpiMetrics';
import { warehouseOrderMatchesSearch } from '@/lib/warehouse/orderSearch';
import { resolveDateRange } from '@/lib/warehouseDateUtils';
import { useAutoRefreshData } from '@/hooks/useAutoRefreshData';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useDateFilterState } from '@/hooks/useDateFilterState';

import type { WarehouseOrder, DeliveryAgent } from '@/types/warehouse';

type TabKey = 'All' | 'Pending' | 'Deliver' | 'AwaitingAdmin' | 'Completed' | 'Rejected';

type SortField =
  | 'Date'
  | 'Order ID'
  | 'Units'
  | 'Delivered'
  | 'Remaining'
  | 'Priority'
  | 'Status'
  | 'Actions'
  | 'Agent';

export default function SettlementClient({ branchSlug }: { branchSlug: string }) {
  const { user, showToast, icWarehouses, refetchData, branches } = useApp();

  const [orders, setOrders]   = useState<WarehouseOrder[]>([]);
  const [undeliveredOrders, setUndeliveredOrders] = useState<WarehouseOrder[]>([]);
  const [agents, setAgents]   = useState<DeliveryAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<TabKey>('All');
  const [search, setSearch]   = useState('');

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useDateFilterState();

  // Column filters
  const [filterAgent,    setFilterAgent]    = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');

  // Sort
  const [sortField, setSortField] = useState<SortField>('Priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [acceptModalOpen,  setAcceptModalOpen]  = useState(false);
  const [assignModalOpen,  setAssignModalOpen]  = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsEditable,  setDetailsEditable]  = useState(false);
  const [selectedOrder,    setSelectedOrder]    = useState<WarehouseOrder | null>(null);
  const [rejectOrder,      setRejectOrder]      = useState<WarehouseOrder | null>(null);
  const [rejectLoading,    setRejectLoading]    = useState(false);

  // RBAC: warehouse_* can assign agents; delivery_* cannot
  const isDeliveryRole  = user?.role?.startsWith('delivery_');
  const isWarehouseRole = user?.role?.startsWith('warehouse_') || user?.role === 'branch_manager' || user?.role === 'admin';
  const canAssignAgents = isWarehouseRole && !isDeliveryRole;

  const rawRoleId   = (user?.role?.startsWith('warehouse_') || user?.role?.startsWith('delivery_')) ? user.role.split('_')[1] : null;
  const warehouseId = rawRoleId ? icWarehouses.find((w: any) => w.id.startsWith(rawRoleId))?.id : null;

  const loadData = useCallback(async (silent = false) => {
    if (!warehouseId) {
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const { dateFrom, dateTo } = resolveDateRange(dateFilter, customStartDate, customEndDate);
    const [ordersRes, undeliveredRes, agentsRes] = await Promise.all([
      fetchWarehouseOrders(warehouseId, { dateFrom, dateTo }),
      fetchWarehouseUndeliveredOrders(warehouseId),
      fetchDeliveryAgents(warehouseId),
    ]);

    if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data as WarehouseOrder[]);
    else if (!silent) showToast(ordersRes.error || 'Failed to fetch orders', 'error');

    if (undeliveredRes.success && undeliveredRes.data) {
      setUndeliveredOrders(undeliveredRes.data as WarehouseOrder[]);
    }

    if (agentsRes.success && agentsRes.data) setAgents(agentsRes.data as DeliveryAgent[]);

    if (!silent) setLoading(false);
  }, [warehouseId, showToast, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  useAutoRefreshData({
    enabled: !!warehouseId,
    refetch: () => loadData(true),
  });

  usePageRefresh(() => loadData(true));

  const openAcceptModal = (order: WarehouseOrder) => {
    setSelectedOrder(order);
    setAcceptModalOpen(true);
  };

  const openAssignModal = (order: WarehouseOrder) => {
    setSelectedOrder(order);
    setAssignModalOpen(true);
  };

  const openDetailsModal = (order: WarehouseOrder, editable = false) => {
    setSelectedOrder(order);
    setDetailsEditable(editable);
    setDetailsModalOpen(true);
  };

  const handleWarehouseReject = async (remarks: string) => {
    if (!rejectOrder) return;
    setRejectLoading(true);
    const res = await warehouseRejectOrder(rejectOrder.id, remarks, user?.email || 'warehouse');
    setRejectLoading(false);
    if (res.success) {
      showToast('Order rejected', 'success');
      setRejectOrder(null);
      loadData();
    } else {
      showToast(res.error || 'Failed to reject order', 'error');
    }
  };

  const handleSort = (field: SortField) => {
    setSortField(f => {
      if (f === field) { setSortOrder(o => (o === 'asc' ? 'desc' : 'asc')); return f; }
      setSortOrder('asc');
      return field;
    });
  };

  const workflowContextForOrder = useCallback((order: WarehouseOrder): 'pending' | 'deliver' => {
    if (
      isWarehouseDirectDeliverOrder({
        orderStatus: order.order_status ?? undefined,
        deliveryAgentId: order.delivery_agent_id ?? undefined,
      })
    ) {
      return 'deliver';
    }
    return 'pending';
  }, []);

  const isDeliverTabContext = useCallback(
    (order: WarehouseOrder) => tab === 'Deliver' || (tab === 'All' && workflowContextForOrder(order) === 'deliver'),
    [tab, workflowContextForOrder],
  );

  /* ─── filtering ─────────────────────────────────────────── */
  const filteredOrders = useMemo<WarehouseOrder[]>(() => {
    return orders
      .filter(o => {
        if (tab === 'All') return true;
        const directDeliver = isWarehouseDirectDeliverOrder({
          orderStatus: o.order_status ?? undefined,
          deliveryAgentId: o.delivery_agent_id ?? undefined,
        });
        if (tab === 'Pending') {
          return !isSaleCompleted(o.order_status)
            && o.order_status !== 'delivery_pending_admin'
            && !isWarehouseRejected(o.order_status)
            && !directDeliver;
        }
        if (tab === 'Deliver') {
          return directDeliver;
        }
        if (tab === 'AwaitingAdmin') {
          return o.order_status === 'delivery_pending_admin';
        }
        if (tab === 'Completed') {
          return isSaleCompleted(o.order_status);
        }
        return isWarehouseRejected(o.order_status);
      })
      .filter(o => {
        if (filterAgent === 'Unassigned') return !o.delivery_agent_id;
        if (filterAgent !== 'All')        return o.delivery_agent_id === filterAgent;
        return true;
      })
      .filter(o => {
        if (filterPriority !== 'All') return (o.priority || 'Normal') === filterPriority;
        return true;
      })
      .filter(o => warehouseOrderMatchesSearch(o, search, { branches }));
  }, [orders, tab, search, filterAgent, filterPriority, branches]);

  /* ─── sorting ────────────────────────────────────────────── */
  const sortedOrders = useMemo<WarehouseOrder[]>(() => {
    return [...filteredOrders].sort((a, b) => {
      let vA: any, vB: any;
      switch (sortField) {
        case 'Order ID':          vA = getFormattedTxnId(a.id, 'sale', a, branches); vB = getFormattedTxnId(b.id, 'sale', b, branches); break;
        case 'Units':             vA = Number(a.units);              vB = Number(b.units);              break;
        case 'Delivered':         vA = getDeliveredUnits(Number(a.units), a.collected_units, a.order_status);
                                  vB = getDeliveredUnits(Number(b.units), b.collected_units, b.order_status); break;
        case 'Remaining':         vA = getRemainingUnits(Number(a.units), a.collected_units, a.order_status);
                                  vB = getRemainingUnits(Number(b.units), b.collected_units, b.order_status); break;
        case 'Priority':          return comparePriority(a.priority, b.priority, sortOrder);
        case 'Status':            vA = a.order_status || 'pending'; vB = b.order_status || 'pending'; break;
        case 'Actions':           return 0;
        case 'Agent':             vA = a.delivery_agent_name || ''; vB = b.delivery_agent_name || ''; break;
        default:                  vA = new Date(a.created_at).getTime(); vB = new Date(b.created_at).getTime();
      }
      if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
      if (vA > vB) return sortOrder === 'asc' ? 1 : -1;
      const priDiff = comparePriority(a.priority, b.priority, 'asc');
      if (priDiff !== 0) return priDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredOrders, sortField, sortOrder, branches]);
  const allCount = orders.length;
  const pendingCount = orders.filter(o => {
    const directDeliver = isWarehouseDirectDeliverOrder({
      orderStatus: o.order_status ?? undefined,
      deliveryAgentId: o.delivery_agent_id ?? undefined,
    });
    return !isSaleCompleted(o.order_status)
      && o.order_status !== 'delivery_pending_admin'
      && !isWarehouseRejected(o.order_status)
      && !directDeliver;
  }).length;
  const deliverCount = orders.filter(o =>
    isWarehouseDirectDeliverOrder({
      orderStatus: o.order_status ?? undefined,
      deliveryAgentId: o.delivery_agent_id ?? undefined,
    }),
  ).length;
  const awaitingAdminCount = orders.filter(o => o.order_status === 'delivery_pending_admin').length;
  const completedCount = orders.filter(o => isSaleCompleted(o.order_status)).length;
  const rejectedCount = orders.filter(o => isWarehouseRejected(o.order_status)).length;

  const tabEmptyLabel =
    tab === 'All'
      ? ''
      : tab === 'Pending'
      ? 'pending'
      : tab === 'Deliver'
        ? 'direct delivery'
        : tab === 'AwaitingAdmin'
          ? 'awaiting admin verification'
          : tab === 'Completed'
            ? 'completed'
            : 'rejected';

  const COLS: { label: SortField; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Date',       align: 'left'   },
    { label: 'Order ID',   align: 'left'   },
    { label: 'Units',      align: 'right'  },
    { label: 'Delivered',  align: 'right'  },
    { label: 'Remaining',  align: 'right'  },
    { label: 'Priority',   align: 'center' },
    { label: 'Agent',      align: 'left'   },
    { label: 'Status',     align: 'center' },
    { label: 'Actions',    align: 'center' },
  ];

  const warehouseStock = useMemo(() => {
    if (!warehouseId) return null;
    const warehouse = icWarehouses.find(w => w.id === warehouseId);
    return warehouse?.currentStock ?? 0;
  }, [warehouseId, icWarehouses]);

  const kpiMetrics = useMemo(
    () => computeWarehouseSettlementKpis(orders, warehouseStock, undeliveredOrders),
    [orders, warehouseStock, undeliveredOrders],
  );

  return (
    <WarehousePortalShell title="Order Fulfillment">


      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <WarehouseKpiGrid metrics={kpiMetrics} />

      <div className="flex flex-col gap-3">
        <SalesTableShell
          tabs={[
            { id: 'All', label: 'All Orders', count: allCount },
            { id: 'Pending', label: 'Pending Orders', count: pendingCount },
            { id: 'Deliver', label: 'Deliver', count: deliverCount },
            { id: 'Rejected', label: 'Rejected', count: rejectedCount },
            { id: 'AwaitingAdmin', label: 'Awaiting Admin', count: awaitingAdminCount },
            { id: 'Completed', label: 'Completed Orders', count: completedCount },
          ]}
          activeTab={tab}
          onTabChange={id => setTab(id as TabKey)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search date, ID, units, agent, status…"
          filters={
            <>
              <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className={salesTableSelectClass}>
                <option value="All">All Agents</option>
                <option value="Unassigned">Unassigned</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={salesTableSelectClass}>
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
              </select>
            </>
          }
          mobileContent={
            <div className="flex flex-col gap-3 py-4 max-sm:px-0 px-4">
              {loading ? (
                <div className="flex flex-col gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
                  ))}
                </div>
              ) : sortedOrders.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No orders found.</div>
              ) : (
                sortedOrders.map(order => {
                  const delivered = getDeliveredUnits(Number(order.units), order.collected_units, order.order_status);
                  const remaining = getRemainingUnits(Number(order.units), order.collected_units, order.order_status);
                  return (
                    <div
                      key={order.id}
                      onClick={() => openDetailsModal(order, isDeliverTabContext(order))}
                      className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-4 shadow-surface-xs transition-colors hover:bg-slate-50 ${highPriorityCardClass(order.priority)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-sm font-semibold text-slate-900">{getFormattedTxnId(order.id, 'sale', order, branches)}</span>
                          <span className="text-xs text-slate-400">{formatDateTime(order.created_at)}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <PriorityBadge priority={order.priority} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-500">
                        <span>Units: <strong className="text-slate-700">{formatUnits(order.units)}</strong></span>
                        <WarehouseAgentNameCell order={order} />
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-500">
                        <span>Delivered: <strong className="text-emerald-600">{formatUnits(delivered)}</strong></span>
                        <span>Remaining: <strong className="text-amber-600">{formatUnits(remaining)}</strong></span>
                      </div>
                      <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                        <WarehouseOrderWorkflowActions
                          order={order}
                          canAssignAgents={canAssignAgents}
                          context={isDeliverTabContext(order) ? 'deliver' : 'pending'}
                          onReject={e => { e.stopPropagation(); setRejectOrder(order); }}
                          onAccept={e => { e.stopPropagation(); openAcceptModal(order); }}
                          onAssign={e => { e.stopPropagation(); openAssignModal(order); }}
                          onRecordDelivery={e => { e.stopPropagation(); openDetailsModal(order, true); }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-50 pt-2">
                        <div className="min-w-0" onClick={e => e.stopPropagation()}>
                          <WarehouseOrderStatusCard order={order} />
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); openDetailsModal(order, isDeliverTabContext(order)); }}
                          className="shrink-0 text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          }
        >
          <table className={`${salesTableClass} min-w-[900px]`}>
            <thead>
              <tr className={salesTableTheadRowClass}>
                {COLS.map(col => {
                  const isSorted = sortField === col.label;
                  return (
                    <th
                      key={col.label}
                      onClick={() => handleSort(col.label)}
                      className={`${salesTableThSortableClass} ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}
                    >
                      <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                        <span>{col.label}</span>
                        {isSorted ? <span className="text-[10px] text-slate-400">{sortOrder === 'asc' ? '▲' : '▼'}</span> : null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows cols={9} />
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className={salesTableEmptyClass}>
                    {tab === 'All'
                      ? 'No orders found for this date range.'
                      : `No ${tabEmptyLabel} orders found for this date range.`}
                  </td>
                </tr>
              ) : (
                sortedOrders.map(order => {
                  const delivered = getDeliveredUnits(Number(order.units), order.collected_units, order.order_status);
                  const remaining = getRemainingUnits(Number(order.units), order.collected_units, order.order_status);
                  return (
                    <tr
                      key={order.id}
                      onClick={() => openDetailsModal(order, isDeliverTabContext(order))}
                      className={`${salesTableRowInteractiveClass} ${highPriorityRowClass(order.priority)}`}
                      data-interactive-row
                    >
                      <td className={`${salesTableTdClass} font-medium text-slate-900`}>{formatDateTime(order.created_at)}</td>
                      <td className={`${salesTableTdClass} font-mono font-medium text-slate-900`}>
                        {getFormattedTxnId(order.id, 'sale', order, branches)}
                        {order.derived_from_sale_id ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-indigo-600">(split)</span>
                        ) : null}
                      </td>
                      <td className={`${salesTableTdClass} text-right text-slate-600`}>{formatUnits(order.units)}</td>
                      <td className={`${salesTableTdClass} text-right font-semibold text-emerald-600`}>{formatUnits(delivered)}</td>
                      <td className={`${salesTableTdClass} text-right font-semibold text-amber-600`}>{formatUnits(remaining)}</td>
                      <td className={`${salesTableTdClass} text-center`}><PriorityBadge priority={order.priority} /></td>
                      <td className={salesTableTdClass}>
                        <WarehouseAgentNameCell order={order} />
                      </td>
                      <td className={`${salesTableTdClass} text-center`} onClick={e => e.stopPropagation()}>
                        <WarehouseOrderStatusCard order={order} />
                      </td>
                      <td className={`${salesTableTdClass} text-center`} onClick={e => e.stopPropagation()}>
                        <WarehouseOrderWorkflowActions
                          order={order}
                          canAssignAgents={canAssignAgents}
                          context={isDeliverTabContext(order) ? 'deliver' : 'pending'}
                          onReject={e => { e.stopPropagation(); setRejectOrder(order); }}
                          onAccept={e => { e.stopPropagation(); openAcceptModal(order); }}
                          onAssign={e => { e.stopPropagation(); openAssignModal(order); }}
                          onRecordDelivery={e => { e.stopPropagation(); openDetailsModal(order, true); }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </SalesTableShell>
      </div>

      {/* Modals */}
      {acceptModalOpen && selectedOrder && (
        <WarehouseAcceptOrderModal
          order={selectedOrder}
          agents={agents}
          onClose={() => setAcceptModalOpen(false)}
          onSuccess={route => {
            setAcceptModalOpen(false);
            if (route === 'direct') setTab('Deliver');
            loadData();
          }}
        />
      )}
      {assignModalOpen && selectedOrder && (
        <AssignDeliveryAgentModal
          order={selectedOrder}
          agents={agents}
          onClose={() => setAssignModalOpen(false)}
          onSuccess={() => { setAssignModalOpen(false); loadData(); }}
        />
      )}
      {detailsModalOpen && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isDeliveryView={isDeliveryRole ?? false}
          isWarehouseDirectDeliver={detailsEditable}
          onClose={() => setDetailsModalOpen(false)}
          onSuccess={() => { setDetailsModalOpen(false); loadData(); refetchData(); }}
        />
      )}
      <RejectRemarkModal
        open={!!rejectOrder}
        loading={rejectLoading}
        title="Reject Order"
        description="Provide a reason for rejecting this order. The admin will be notified to reassign or reject."
        onConfirm={handleWarehouseReject}
        onCancel={() => setRejectOrder(null)}
      />
    </WarehousePortalShell>
  );
}
