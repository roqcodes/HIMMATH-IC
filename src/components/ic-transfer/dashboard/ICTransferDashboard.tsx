'use client';

import React, { useMemo, useState, useEffect } from 'react';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { ChartCard, PageShell } from '../ui';
import { useApp } from '@/context/AppContext';
import { getCustomersBySlug } from '@/app/actions/customerActions';
import { resolveDateFilterRange, isDateInRange } from '@/lib/dateFilterRange';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { useICTransferRegionFilter } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import { matchesSaleRegionFilter, matchesSelectedRegions } from '@/lib/icTransfer/regionFilter';
import { scopeSalesForBranchAdmin, saleMatchesDateFilter } from '@/lib/icTransfer/branchOrderOwnership';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import { sumMetalSaleWeightG, sumMetalWeightG } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { computeDealProfit } from '@/lib/icTransfer/dealProfit';
import { formatAEDStr } from '@/lib/format';
import { useDateFilterState } from '@/hooks/useDateFilterState';

function TrendChart({ data }: { data: { label: string; purchases: number; sales: number }[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.purchases, d.sales]), 1);

  return (
    <ChartCard 
      title="Volume Trends"
      legend={
        <div className="flex gap-4 text-xs font-semibold">
           <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-accent"></span>Purchases</span>
           <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-400"></span>Sales</span>
        </div>
      }
    >
      <div className="flex h-40 items-end gap-1.5 px-1 pb-5 border-b border-slate-100 sm:h-44">
        {data.length === 0 ? (
          <div className="w-full flex items-center justify-center text-sm text-slate-400 h-full pb-6">No data available in this period</div>
        ) : data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end items-center h-full relative group">
             <div className="w-full flex justify-center items-end gap-[1px] sm:gap-1 h-full min-h-[1px]">
               <div 
                 className="w-1/2 max-w-[24px] bg-accent rounded-t-[3px] transition-all duration-300 group-hover:opacity-80 relative" 
                 style={{ height: `${Math.max((d.purchases / maxVal) * 100, 1)}%` }} 
                 title={`Purchases: ${formatAEDStr(d.purchases)}`}
               />
               <div 
                 className="w-1/2 max-w-[24px] bg-emerald-400 rounded-t-[3px] transition-all duration-300 group-hover:opacity-80 relative" 
                 style={{ height: `${Math.max((d.sales / maxVal) * 100, 1)}%` }} 
                 title={`Sales: ${formatAEDStr(d.sales)}`}
               />
             </div>
             <span className="text-[10px] font-medium text-slate-400 absolute -bottom-5 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120%] text-center">
               {d.label}
             </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function RankingList({
  title,
  data,
  colorClass = 'bg-accent',
}: {
  title: string;
  data: { name: string; volume: number; percentage: number }[];
  colorClass?: string;
}) {
  return (
    <ChartCard title={title}>
      <div className="flex flex-col gap-3">
        {data.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No data available</p>
        ) : (
          data.slice(0, 6).map((d, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-end justify-between gap-2 text-xs font-medium text-slate-700">
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 font-mono tabular-nums text-slate-900">{formatAEDStr(d.volume)}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
                  style={{ width: `${Math.max(d.percentage, 2)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </ChartCard>
  );
}

export default function ICTransferDashboard() {
  const { icPurchases, icSales, icSuppliers, icRegions, icWarehouses, branches, allBranches, currentSlug } = useApp();
  const { selectedRegionIds } = useICTransferRegionFilter();
  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
  const branchName = branches.find(b => b.slug === currentSlug)?.name
    || allBranches.find(b => b.slug === currentSlug)?.name
    || currentSlug
    || '';

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useDateFilterState();
  const [branchCustomers, setBranchCustomers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!branchSlug) return;
    getCustomersBySlug(branchSlug).then(res => {
      if (res.success && res.customers) {
        setBranchCustomers(res.customers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    });
  }, [branchSlug]);

  const branchCustomerIds = useMemo(
    () => new Set(branchCustomers.map(c => c.id)),
    [branchCustomers],
  );

  const branchCustomerNames = useMemo(
    () => new Set(branchCustomers.map(c => c.name.trim().toLowerCase())),
    [branchCustomers],
  );

  const scopedSales = useMemo(() => {
    if (!branchSlug) return icSales;
    return scopeSalesForBranchAdmin(
      icSales,
      branchName,
      branchCustomerIds,
      branchCustomerNames,
      allBranches,
    );
  }, [icSales, branchSlug, branchName, branchCustomerIds, branchCustomerNames, allBranches]);

  const range = useMemo(() => resolveDateFilterRange(dateFilter, customStartDate, customEndDate), [dateFilter, customStartDate, customEndDate]);

  const { filteredPurchases, filteredSales } = useMemo(() => {
    const isFiltered = (dateStr: string) => !range.startDate && !range.endDate ? true : isDateInRange(dateStr, range);
    
    const activeBranch = branches.find(b => b.slug === currentSlug)
      || allBranches.find(b => b.slug === currentSlug);
    const activeBranchId = activeBranch?.id;

    const allowedWarehouseIds = new Set(
      icWarehouses
        .filter(w => !branchSlug ? !w.branchId : w.branchId === activeBranchId)
        .map(w => w.id)
    );

    return {
      filteredPurchases: icPurchases.filter(
        p =>
          isFiltered(p.createdAt || '') &&
          matchesSelectedRegions(p.locationId, selectedRegionIds) &&
          (!p.warehouseId || allowedWarehouseIds.has(p.warehouseId)),
      ),
      filteredSales: scopedSales.filter(
        s =>
          saleMatchesDateFilter(s, range) &&
          matchesSaleRegionFilter(s, icWarehouses, selectedRegionIds) &&
          (!s.warehouseId || allowedWarehouseIds.has(s.warehouseId)),
      ),
    };
  }, [icPurchases, scopedSales, icWarehouses, range, selectedRegionIds, branchSlug, branches, allBranches, currentSlug]);

  const { kpis, trendData, supplierData, regionData } = useMemo(() => {
    let totalPurchaseVol = 0;
    let totalSalesVol = 0;
    let pendingPayables = 0;
    let pendingReceivables = 0;
    let totalCommission = 0;

    const trendMap: Record<string, { purchases: number, sales: number }> = {};
    const supplierMap: Record<string, number> = {};
    const regionMap: Record<string, number> = {};

    // Grouping by day if the range is short (<= 31 days), otherwise by month
    let groupByMonth = false;
    if (range.startDate && range.endDate) {
      const diffTime = Math.abs(new Date(range.endDate).getTime() - new Date(range.startDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 35) groupByMonth = true;
    } else if (dateFilter === 'all-time' || dateFilter === 'last-3-months' || dateFilter === 'this-year') {
      groupByMonth = true;
    }

    const getGroupKey = (dateStr: string) => {
      const d = new Date(dateStr);
      if (groupByMonth) {
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    filteredPurchases.forEach(p => {
      const aed = p.aedTotal || 0;
      totalPurchaseVol += aed;
      if (p.paymentStatus === 'pending') pendingPayables += aed;
      
      const supplier = icSuppliers.find(s => s.id === effectivePurchaseCounterpartyId(p));
      if (supplier?.commission) {
         totalCommission += (p.units * supplier.commission);
      }

      const key = getGroupKey(p.createdAt || '');
      if (!trendMap[key]) trendMap[key] = { purchases: 0, sales: 0 };
      trendMap[key].purchases += aed;

      const supName = supplier?.name || 'Unknown Supplier';
      supplierMap[supName] = (supplierMap[supName] || 0) + aed;

      const locName = icRegions.find(r => r.id === p.locationId)?.name || 'Unknown Location';
      regionMap[locName] = (regionMap[locName] || 0) + aed;
    });

    filteredSales.forEach(s => {
      const aed = s.aedAmount || 0;
      totalSalesVol += aed;
      if (s.paymentStatus === 'pending') pendingReceivables += aed;

      const key = getGroupKey(s.createdAt || '');
      if (!trendMap[key]) trendMap[key] = { purchases: 0, sales: 0 };
      trendMap[key].sales += aed;

      const warehouse = icWarehouses.find(w => w.id === s.warehouseId);
      const locName = warehouse ? icRegions.find(r => r.id === warehouse.regionId)?.name || 'Unknown Location' : 'Unknown Location';
      regionMap[locName] = (regionMap[locName] || 0) + aed;
    });

    // Format Trend Data
    const sortedKeys = Object.keys(trendMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const trendDataArray = sortedKeys.map(k => ({
      label: k,
      purchases: trendMap[k].purchases,
      sales: trendMap[k].sales
    }));

    // Format Supplier Data
    const maxSupplierVol = Math.max(...Object.values(supplierMap), 1);
    const supplierDataArray = Object.entries(supplierMap)
      .map(([name, volume]) => ({ name, volume, percentage: (volume / maxSupplierVol) * 100 }))
      .sort((a, b) => b.volume - a.volume);

    // Format Region Data
    const maxRegionVol = Math.max(...Object.values(regionMap), 1);
    const regionDataArray = Object.entries(regionMap)
      .map(([name, volume]) => ({ name, volume, percentage: (volume / maxRegionVol) * 100 }))
      .sort((a, b) => b.volume - a.volume);

    const activeBranch = branches.find(b => b.slug === currentSlug)
      || allBranches.find(b => b.slug === currentSlug);
    const activeBranchId = activeBranch?.id;

    const allowedWarehouseIds = new Set(
      icWarehouses
        .filter(w => !branchSlug ? !w.branchId : w.branchId === activeBranchId)
        .map(w => w.id),
    );
    const metalOnHand = icWarehouses
      .filter(w => allowedWarehouseIds.has(w.id))
      .reduce((sum, w) => sum + Number(w.currentMetalG ?? 0), 0);
    const metalPurchasedG = sumMetalWeightG(filteredPurchases);
    const metalSoldG = sumMetalSaleWeightG(filteredSales);
    const cashPurchases = filteredPurchases.filter(p => p.settlementMode !== 'metal').length;
    const metalPurchases = filteredPurchases.filter(p => p.settlementMode === 'metal').length;
    const cashSales = filteredSales.filter(s => s.settlementMode !== 'metal').length;
    const metalSales = filteredSales.filter(s => s.settlementMode === 'metal').length;
    const dealPl = computeDealProfit({
      purchases: icPurchases.filter(p => !p.warehouseId || allowedWarehouseIds.has(p.warehouseId)),
      sales: scopedSales.filter(s => !s.warehouseId || allowedWarehouseIds.has(s.warehouseId)),
      range,
    });

    return {
      kpis: {
        totalPurchaseVol,
        totalSalesVol,
        pendingPayables,
        pendingReceivables,
        totalCommission,
        metalOnHand,
        metalPurchasedG,
        metalSoldG,
        cashPurchases,
        metalPurchases,
        cashSales,
        metalSales,
        cashGrossProfitAed: dealPl.cashGrossProfitAed,
        metalProfitAed: dealPl.metalProfitAed,
        metalProfitInr: dealPl.metalProfitInr,
        txnCount: filteredPurchases.length + filteredSales.length,
      },
      trendData: trendDataArray,
      supplierData: supplierDataArray,
      regionData: regionDataArray
    };
  }, [filteredPurchases, filteredSales, icPurchases, scopedSales, icSuppliers, icRegions, icWarehouses, branchSlug, branches, allBranches, currentSlug, range, dateFilter]);

  return (
    <PageShell>
      <AsicPageHeader title="Dashboard" />

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <AsicKpiStrip
        columns={3}
        metrics={[
          {
            label: 'Purchase volume',
            value: formatAEDStr(kpis.totalPurchaseVol),
            hint: `${kpis.cashPurchases} IC · ${kpis.metalPurchases} metal`,
          },
          {
            label: 'Sales volume',
            value: formatAEDStr(kpis.totalSalesVol),
            hint: `${kpis.cashSales} IC · ${kpis.metalSales} metal`,
            tone: 'emerald',
          },
          {
            label: 'Metal on hand',
            value: `${kpis.metalOnHand.toLocaleString('en-US', { maximumFractionDigits: 4 })} g`,
            hint: 'Across scoped warehouses',
            tone: 'amber',
          },
          {
            label: 'IC gross profit',
            value: formatAEDStr(kpis.cashGrossProfitAed),
            hint: 'WAC on cash IC sales',
            tone: kpis.cashGrossProfitAed >= 0 ? 'emerald' : 'red',
          },
          {
            label: 'Metal P&L',
            value: formatAEDStr(kpis.metalProfitAed),
            hint: `${kpis.metalSoldG.toLocaleString('en-US', { maximumFractionDigits: 2 })} g · sale − purchase AED`,
            tone: kpis.metalProfitAed >= 0 ? 'emerald' : 'red',
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <TrendChart data={trendData} />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-3">
          <RankingList title="Top Suppliers (By Volume)" data={supplierData} colorClass="bg-accent" />
          <RankingList title="Warehouse Activity (By Volume)" data={regionData} colorClass="bg-emerald-400" />
        </div>
      </div>
    </PageShell>
  );
}
