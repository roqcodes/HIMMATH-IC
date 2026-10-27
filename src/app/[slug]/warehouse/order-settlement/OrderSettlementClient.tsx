'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import WarehousePortalShell from '@/components/warehouse/WarehousePortalShell';
import { asicBtnPrimary } from '@/components/asic/ui';
import SalesTableShell, {
  salesTableClass,
  salesTableEmptyClass,
  salesTableRowInteractiveClass,
  salesTableTdClass,
  salesTableThSortableClass,
  salesTableTheadRowClass,
  salesTableSelectClass,
} from '@/components/ic-transfer/shared/SalesTableShell';
import { fetchDeliveryAgentOrders } from '@/app/actions/warehouseActions';
import { formatDateTime } from '@/lib/format';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import OrderDetailsModal from '../settlement/OrderDetailsModal';
import DateFilterBar from '@/components/ui/DateFilterBar';
import { normalizeOrderStatus, isDeliveryAgentRejected } from '@/lib/icTransfer/orderStatus';
import { WarehouseOrderStatusCard } from '@/components/warehouse/WarehouseOrderStatusCell';
import { PriorityBadge, SkeletonRows } from '@/components/warehouse/shared';
import { comparePriority, highPriorityRowClass, highPriorityCardClass } from '@/lib/icTransfer/orderPriority';
import { formatUnits, getRemainingUnits, isSaleCompleted } from '@/lib/icTransfer/saleUnits';
import { resolveDateRange } from '@/lib/warehouseDateUtils';
import WarehouseKpiGrid from '@/components/warehouse/WarehouseKpiGrid';
import { computeDeliveryAgentKpis } from '@/lib/warehouse/kpiMetrics';
import { warehouseOrderMatchesSearch } from '@/lib/warehouse/orderSearch';
import { useAutoRefreshData } from '@/hooks/useAutoRefreshData';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { useDateFilterState } from '@/hooks/useDateFilterState';
import type { WarehouseOrder } from '@/types/warehouse';

type TabKey = 'All' | 'Pending' | 'AwaitingAdmin' | 'Completed' | 'Rejected';
type SortField = 'Date' | 'Order ID' | 'Units' | 'Remaining' | 'Priority' | 'Status';

export default function OrderSettlementClient({ branchSlug }: { branchSlug: string }) {
  const { user, showToast, branches, refetchData } = useApp();

  const [orders, setOrders]   = useState<WarehouseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<TabKey>('All');
  const [search, setSearch]   = useState('');
  const [filterPriority, setFilterPriority] = useState('All');

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useDateFilterState();

  // Sort
  const [sortField, setSortField] = useState<SortField>('Priority');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal
  const [selectedOrder,    setSelectedOrder]    = useState<WarehouseOrder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!user?.email) return;
    if (!silent) setLoading(true);
    const { dateFrom, dateTo } = resolveDateRange(dateFilter, customStartDate, customEndDate);
    const res = await fetchDeliveryAgentOrders(user.email, { dateFrom, dateTo });
    if (res.success && res.data) {
      setOrders(res.data as WarehouseOrder[]);
    } else if (!silent) {
      showToast(res.error || 'Failed to load delivery orders', 'error');
    }
    if (!silent) setLoading(false);
  }, [user?.email, showToast, dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  useAutoRefreshData({
    enabled: !!user?.email,
    refetch: () => loadData(true),
  });

  usePageRefresh(() => loadData(true));

  const handleSort = (field: SortField) => {
    setSortField(f => {
      if (f === field) { setSortOrder(o => (o === 'asc' ? 'desc' : 'asc')); return f; }
      setSortOrder('asc');
      return field;
    });
  };

  const filteredOrders = useMemo<WarehouseOrder[]>(() => {
    return orders.filter(o => {
      const status = normalizeOrderStatus(o.order_status);
      const matchTab =
        tab === 'All'
          ? true
          : tab === 'Pending'
          ? status === 'wh_processing'
          : tab === 'AwaitingAdmin'
            ? status === 'delivery_pending_admin'
            : tab === 'Completed'
              ? isSaleCompleted(o.order_status)
              : isDeliveryAgentRejected(o.order_status);
      const matchSearch = warehouseOrderMatchesSearch(o, search, {
        branches,
        includeAgent: false,
        includeDelivered: false,
      });
      const matchPriority = filterPriority === 'All' || (o.priority || 'Normal') === filterPriority;
      return matchTab && matchSearch && matchPriority;
    });
  }, [orders, tab, search, filterPriority, branches]);

  const sortedOrders = useMemo<WarehouseOrder[]>(() => {
    return [...filteredOrders].sort((a, b) => {
      let vA: any, vB: any;
      switch (sortField) {
        case 'Order ID': vA = getFormattedTxnId(a.id, 'sale', a, branches); vB = getFormattedTxnId(b.id, 'sale', b, branches); break;
        case 'Units':    vA = Number(a.units);                                 vB = Number(b.units);                                 break;
        case 'Remaining': vA = getRemainingUnits(Number(a.units), a.collected_units, a.order_status);
                          vB = getRemainingUnits(Number(b.units), b.collected_units, b.order_status); break;
        case 'Priority': return comparePriority(a.priority, b.priority, sortOrder);
        case 'Status':   vA = a.order_status || 'pending';                  vB = b.order_status || 'pending';                  break;
        default:         vA = new Date(a.created_at).getTime();                vB = new Date(b.created_at).getTime();
      }
      if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
      if (vA > vB) return sortOrder === 'asc' ? 1 : -1;
      const priDiff = comparePriority(a.priority, b.priority, 'asc');
      if (priDiff !== 0) return priDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredOrders, sortField, sortOrder, branches]);

  const allCount         = orders.length;
  const pendingCount   = orders.filter(o => normalizeOrderStatus(o.order_status) === 'wh_processing').length;
  const awaitingAdminCount = orders.filter(o => o.order_status === 'delivery_pending_admin').length;
  const completedCount = orders.filter(o => isSaleCompleted(o.order_status)).length;
  const rejectedCount  = orders.filter(o => isDeliveryAgentRejected(o.order_status)).length;

  const kpiMetrics = useMemo(() => computeDeliveryAgentKpis(orders), [orders]);

  const COLS: { label: SortField; align: 'left' | 'right' | 'center' }[] = [
    { label: 'Date',      align: 'left'   },
    { label: 'Order ID',  align: 'left'   },
    { label: 'Units',      align: 'right'  },
    { label: 'Remaining',  align: 'right'  },
    { label: 'Priority',  align: 'center' },
    { label: 'Status',    align: 'center' },
  ];

  return (
    <WarehousePortalShell title="Settlement" subtitle="Delivery agent — assigned orders and settlement">

      {/* Date Filter */}
      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <WarehouseKpiGrid metrics={kpiMetrics} variant="delivery" />

      <div className="flex flex-col gap-3 mt-2">
        <SalesTableShell
          tabs={[
            { id: 'All', label: 'All Orders', count: allCount },
            { id: 'Pending', label: 'Pending', count: pendingCount },
            { id: 'Completed', label: 'Completed', count: completedCount },
            { id: 'AwaitingAdmin', label: 'Awaiting Admin', count: awaitingAdminCount },
            { id: 'Rejected', label: 'Rejected', count: rejectedCount },
          ]}
          activeTab={tab}
          onTabChange={id => setTab(id as TabKey)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search date, ID, units, status…"
          filters={
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className={salesTableSelectClass}>
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          }
          mobileContent={
            <div className="flex flex-col gap-3 py-4 max-sm:px-0 px-4">
              {loading ? (
                <div className="flex flex-col gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-slate-100" />)}</div>
              ) : sortedOrders.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">No orders found.</div>
              ) : (
                sortedOrders.map(order => {
                  const remaining = getRemainingUnits(Number(order.units), order.collected_units, order.order_status);
                  return (
                    <div
                      key={order.id}
                      onClick={() => { setSelectedOrder(order); setDetailsModalOpen(true); }}
                      className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-4 shadow-surface-xs transition-colors hover:bg-slate-50 ${highPriorityCardClass(order.priority)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-900">{getFormattedTxnId(order.id, 'sale', order, branches)}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(order.created_at)}</p>
                        </div>
                        <PriorityBadge priority={order.priority} />
                      </div>
                      <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-500">
                        <span>Units: <strong className="text-slate-700">{formatUnits(order.units)}</strong></span>
                        <span>To deliver: <strong className="text-amber-600">{formatUnits(remaining)}</strong></span>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-50 pt-2">
                        <div className="min-w-0" onClick={e => e.stopPropagation()}>
                          <WarehouseOrderStatusCard order={order} />
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-xs font-bold text-accent hover:text-accent/80"
                          onClick={e => { e.stopPropagation(); setSelectedOrder(order); setDetailsModalOpen(true); }}
                        >
                          Update / View Details →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          }
        >
          <table className={`${salesTableClass} min-w-[760px]`}>
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
                <SkeletonRows cols={6} />
              ) : sortedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className={salesTableEmptyClass}>
                    No {tab.toLowerCase()} orders found for this date range.
                  </td>
                </tr>
              ) : (
                sortedOrders.map(order => {
                  const remaining = getRemainingUnits(Number(order.units), order.collected_units, order.order_status);
                  return (
                    <tr
                      key={order.id}
                      className={`${salesTableRowInteractiveClass} ${highPriorityRowClass(order.priority)}`}
                      data-interactive-row
                      onClick={() => { setSelectedOrder(order); setDetailsModalOpen(true); }}
                    >
                      <td className={`${salesTableTdClass} font-medium text-slate-900`}>{formatDateTime(order.created_at)}</td>
                      <td className={`${salesTableTdClass} font-mono font-medium text-slate-900`}>
                        {getFormattedTxnId(order.id, 'sale', order, branches)}
                        {order.derived_from_sale_id ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-indigo-600">(split)</span>
                        ) : null}
                      </td>
                      <td className={`${salesTableTdClass} text-right text-slate-600`}>{formatUnits(order.units)}</td>
                      <td className={`${salesTableTdClass} text-right font-semibold text-amber-600`}>{formatUnits(remaining)}</td>
                      <td className={`${salesTableTdClass} text-center`}><PriorityBadge priority={order.priority} /></td>
                      <td className={`${salesTableTdClass} text-center`} onClick={e => e.stopPropagation()}>
                        <WarehouseOrderStatusCard order={order} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </SalesTableShell>
      </div>

      {detailsModalOpen && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          isDeliveryView={true}
          onClose={() => setDetailsModalOpen(false)}
          onSuccess={() => { setDetailsModalOpen(false); loadData(); refetchData(); }}
        />
      )}
    </WarehousePortalShell>
  );
}
