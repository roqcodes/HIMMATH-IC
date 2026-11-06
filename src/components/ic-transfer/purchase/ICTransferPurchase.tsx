'use client';

import React, { useMemo, useState } from 'react';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { resolveDateFilterRange, isDateInRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import { toBusinessDate } from '@/lib/businessTime';
import ICTransferDealBookKpiStrips from '@/components/ic-transfer/shared/ICTransferDealBookKpiStrips';
import { computePurchaseBookKpis, countPurchasesInRange } from '@/lib/icTransfer/dealBookKpis';
import { useICTransferRegionFilter } from '@/components/ic-transfer/shared/ICTransferFilterProvider';
import { matchesSelectedRegions } from '@/lib/icTransfer/regionFilter';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { useApp } from '@/context/AppContext';
import {
  AddButton,
  PageHeader,
  PageShell,
  useICTransferFilters,
} from '../ui';
import {
  filterPurchasesForBranchPortal,
  filterCounterpartiesForPurchase,
  filterWarehousesForBranchPortal,
  filterWarehousesForAdminPortal,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { portalMobileCardFooterClass } from '@/lib/icTransfer/layoutConstants';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import { formatDealTableAed, formatDealTableInr, purchaseDealAed, purchaseDealInr } from '@/lib/icTransfer/dealTableDisplay';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import { dealAgentDisplayName, dealAgentPartyId } from '@/lib/counterparties/dealAgent';
import DealAgentHint from '@/components/ic-transfer/shared/DealAgentHint';
import AddPurchaseModal from './AddPurchaseModal';
import ViewPurchaseModal from './ViewPurchaseModal';
import { ICPurchase } from '@/types';
import ICTransferDataTableShell, {
  ICTransferTableFilterSelect,
  type ICTransferTableColumn,
  icTdClass,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';
import { ICTransferEditIconButton, ICTransferViewIconButton } from '@/components/ic-transfer/shared/ICTransferTableActions';
import { DealInvoiceIconButtons, DealInvoiceTextButtons } from '@/components/ic-transfer/invoice/DealInvoiceButtons';

const fmt = (n: number) => `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2 })}`;

const PURCHASE_TABLE_COLUMNS: ICTransferTableColumn[] = [
  { id: 'Date', label: 'Date', align: 'left' },
  { id: 'ID', label: 'ID', align: 'left' },
  { id: 'Supplier', label: 'Supplier', align: 'left' },
  { id: 'Warehouse', label: 'Warehouse', align: 'left' },
  { id: 'Settlement', label: 'Settlement', align: 'left' },
  { id: 'Units', label: 'Units', align: 'right' },
  { id: 'Metal (g)', label: 'Metal (g)', align: 'right' },
  { id: 'Total INR', label: 'INR', align: 'right' },
  { id: 'Total AED', label: 'AED', align: 'right' },
  { id: 'Actions', label: 'Actions', align: 'center', sortable: false },
];

type Props = {
  portalMode?: ICTransferPortalMode;
  branchId?: string;
};

export default function ICTransferPurchase({ portalMode = 'admin', branchId }: Props) {
  const { icPurchases, icSuppliers, icWarehouses, user, currentSlug } = useApp();
  const branchSlugForLinks =
    portalMode === 'branch' && currentSlug !== 'superadmin' ? currentSlug : undefined;
  const scopedBranchId =
    portalMode === 'branch' && branchId
      ? branchId
      : user?.role === 'branch_manager'
        ? user.branchId
        : undefined;
  const isBranchScoped = !!scopedBranchId;

  const scopedWarehouses = useMemo(() => {
    if (!isBranchScoped) return filterWarehousesForAdminPortal(icWarehouses);
    return filterWarehousesForBranchPortal(icWarehouses, scopedBranchId);
  }, [icWarehouses, isBranchScoped, scopedBranchId]);

  const scopedPurchases = useMemo(() => {
    if (!isBranchScoped) return icPurchases;
    return filterPurchasesForBranchPortal(icPurchases, icWarehouses, scopedBranchId);
  }, [icPurchases, icWarehouses, isBranchScoped, scopedBranchId]);

  const scopedSuppliers = useMemo(() => {
    if (isBranchScoped) return filterCounterpartiesForPurchase(icSuppliers, scopedBranchId);
    return filterCounterpartiesForPurchase(icSuppliers);
  }, [icSuppliers, isBranchScoped, scopedBranchId]);
  const { selectedRegionIds } = useICTransferRegionFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<ICPurchase | null>(null);
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('All');
  const [filterSupplier, setFilterSupplier] = useState('All');
  const [filterSettlement, setFilterSettlement] = useState<'All' | 'cash' | 'metal'>('All');
  const [sortField, setSortField] = useState('Date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const getSupplierName = (id: string) =>
    scopedSuppliers.find(s => s.id === id)?.name || icSuppliers.find(s => s.id === id)?.name || id;

  const getWarehouseName = (id?: string) => {
    if (!id) return '—';
    return (
      scopedWarehouses.find(w => w.id === id)?.name ||
      icWarehouses.find(w => w.id === id)?.name ||
      '—'
    );
  };

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const rangeLabel = useMemo(
    () => getDateFilterLabel(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const purchaseBookKpis = useMemo(
    () => computePurchaseBookKpis(scopedPurchases, range),
    [scopedPurchases, range],
  );

  const purchaseCountHint = useMemo(() => {
    const { cash, metal } = countPurchasesInRange(scopedPurchases, range);
    return `${cash} IC · ${metal} metal`;
  }, [scopedPurchases, range]);

  const filteredPurchases = useMemo(() => {
    return scopedPurchases.filter(p => {
      const formattedId = getFormattedTxnId(p.id, 'purchase', p);
      if (
        search &&
        !formattedId.toLowerCase().includes(search.toLowerCase()) &&
        !p.id.toLowerCase().includes(search.toLowerCase()) &&
        !getSupplierName(effectivePurchaseCounterpartyId(p) || '').toLowerCase().includes(search.toLowerCase()) &&
        !dealAgentDisplayName(p, getSupplierName).toLowerCase().includes(search.toLowerCase()) &&
        !getWarehouseName(p.warehouseId).toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (!matchesSelectedRegions(p.locationId, selectedRegionIds)) return false;
      if (p.createdAt && range.startDate) {
        if (!isDateInRange(toBusinessDate(p.createdAt, 'Asia/Dubai'), range)) return false;
      }
      if (
        filterSupplier !== 'All' &&
        effectivePurchaseCounterpartyId(p) !== filterSupplier &&
        dealAgentPartyId(p) !== filterSupplier &&
        p.aedAgentCounterpartyId !== filterSupplier
      ) {
        return false;
      }
      if (filterSettlement !== 'All') {
        const mode = p.settlementMode === 'metal' ? 'metal' : 'cash';
        if (mode !== filterSettlement) return false;
      }
      if (filterWarehouse !== 'All') {
        if (filterWarehouse === 'None') return !p.warehouseId;
        return p.warehouseId === filterWarehouse;
      }
      return true;
    });
  }, [
    scopedPurchases,
    search,
    selectedRegionIds,
    dateFilter,
    customStartDate,
    customEndDate,
    filterSupplier,
    filterSettlement,
    filterWarehouse,
    icSuppliers,
    scopedSuppliers,
    scopedWarehouses,
    icWarehouses,
  ]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'Date' ? 'desc' : 'asc');
    }
  };

  const sortedPurchases = useMemo(() => {
    const sorted = [...filteredPurchases];
    sorted.sort((a, b) => {
      let valA: string | number;
      let valB: string | number;

      switch (sortField) {
        case 'ID':
          valA = getFormattedTxnId(a.id, 'purchase', a);
          valB = getFormattedTxnId(b.id, 'purchase', b);
          break;
        case 'Supplier':
          valA = getSupplierName(effectivePurchaseCounterpartyId(a));
          valB = getSupplierName(effectivePurchaseCounterpartyId(b));
          break;
        case 'Warehouse':
          valA = getWarehouseName(a.warehouseId);
          valB = getWarehouseName(b.warehouseId);
          break;
        case 'Metal (g)':
          valA = Number(a.metalWeightG || 0);
          valB = Number(b.metalWeightG || 0);
          break;
        case 'Settlement':
          valA = a.settlementMode === 'metal' ? 1 : 0;
          valB = b.settlementMode === 'metal' ? 1 : 0;
          break;
        case 'Units':
          valA = Number(a.units || 0);
          valB = Number(b.units || 0);
          break;
        case 'Total AED':
          valA = purchaseDealAed(a);
          valB = purchaseDealAed(b);
          break;
        case 'Total INR':
          valA = purchaseDealInr(a);
          valB = purchaseDealInr(b);
          break;
        case 'Date':
        default:
          valA = new Date(a.createdAt || '').getTime();
          valB = new Date(b.createdAt || '').getTime();
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredPurchases, sortField, sortOrder]);

  const extraAgentFilterOptions = useMemo(() => {
    const known = new Set(scopedSuppliers.map(s => s.id));
    const extras: { id: string; name: string }[] = [];
    for (const p of scopedPurchases) {
      const id = p.aedAgentCounterpartyId;
      if (!id || known.has(id)) continue;
      known.add(id);
      extras.push({ id, name: p.aedAgentName || getSupplierName(id) });
    }
    extras.sort((a, b) => a.name.localeCompare(b.name));
    return extras;
  }, [scopedPurchases, scopedSuppliers, icSuppliers]);

  const handleEdit = (p: ICPurchase) => {
    setSelectedPurchase(p);
    setModalOpen(true);
  };

  const handleView = (p: ICPurchase) => {
    setSelectedPurchase(p);
    setViewModalOpen(true);
  };

  const tableFilters = (
    <>
      <ICTransferTableFilterSelect
        value={filterSupplier}
        onChange={setFilterSupplier}
        aria-label="Filter by supplier"
        className="min-w-[9.5rem]"
      >
        <option value="All">All suppliers</option>
        {scopedSuppliers.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        {extraAgentFilterOptions.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </ICTransferTableFilterSelect>
      <ICTransferTableFilterSelect
        value={filterWarehouse}
        onChange={setFilterWarehouse}
        aria-label="Filter by warehouse"
        className="min-w-[9.5rem]"
      >
        <option value="All">All warehouses</option>
        <option value="None">No warehouse</option>
        {scopedWarehouses.map(w => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </ICTransferTableFilterSelect>
      <ICTransferTableFilterSelect
        value={filterSettlement}
        onChange={v => setFilterSettlement(v as 'All' | 'cash' | 'metal')}
        aria-label="Filter by settlement"
        className="min-w-[8rem]"
      >
        <option value="All">All settlement</option>
        <option value="cash">Cash</option>
        <option value="metal">Metal</option>
      </ICTransferTableFilterSelect>
    </>
  );

  return (
    <PageShell>
      <PageHeader
        title="Purchases"
        actions={<AddButton label="Add Purchase" onClick={() => setModalOpen(true)} />}
      />

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <ICTransferDealBookKpiStrips
        books={purchaseBookKpis}
        rangeLabel={rangeLabel}
        flow="purchase"
        countHint={purchaseCountHint}
      />

      <ICTransferDataTableShell
        title="All Purchases"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search purchases…"
        filters={tableFilters}
        columns={PURCHASE_TABLE_COLUMNS}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        isEmpty={sortedPurchases.length === 0}
        emptyMessage="No purchases found."
        mobileView={
          sortedPurchases.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No purchases found.</div>
          ) : (
            sortedPurchases.map(p => (
              <div
                key={p.id}
                onClick={() => handleView(p)}
                className="flex cursor-pointer flex-col gap-3 rounded-lg border border-slate-200 p-3 shadow-sm transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{getSupplierName(effectivePurchaseCounterpartyId(p) || '')}</p>
                  <DealAgentHint deal={p} nameOf={getSupplierName} branchSlug={branchSlugForLinks} />
                  <p className="mt-0.5 font-mono text-xs text-slate-500">
                    {getFormattedTxnId(p.id, 'purchase', p)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(p.createdAt || '').toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Warehouse:{' '}
                    <span className="font-medium text-slate-700">{getWarehouseName(p.warehouseId)}</span>
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50/70 p-2.5 text-xs text-slate-500">
                  <span>
                    Units: <strong className="text-slate-700">{p.units.toLocaleString()}</strong>
                  </span>
                  <span>
                    AED: <strong className="text-slate-700">{formatDealTableAed(purchaseDealAed(p))}</strong>
                  </span>
                </div>
                <div className={portalMobileCardFooterClass} onClick={e => e.stopPropagation()}>
                  <DealInvoiceTextButtons purchase={p} />
                  <button
                    type="button"
                    onClick={() => handleView(p)}
                    className="ml-auto shrink-0 text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          )
        }
      >
        {sortedPurchases.map(p => (
          <tr
            key={p.id}
            onClick={() => handleView(p)}
            className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80"
          >
            <td className={icTdClass('left')}>
              <div className="leading-tight">
                <div className="text-xs font-medium text-slate-800">
                  {new Date(p.createdAt || '').toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-[10px] text-slate-400">
                  {new Date(p.createdAt || '').toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            </td>
            <td className={icTdClass('left')}>
              <span className="font-mono text-xs text-slate-500">{getFormattedTxnId(p.id, 'purchase', p)}</span>
            </td>
            <td className={icTdClass('left')}>
              <div className="min-w-[120px]">
                <CounterpartyLink
                  counterpartyId={effectivePurchaseCounterpartyId(p)}
                  name={getSupplierName(effectivePurchaseCounterpartyId(p) || '')}
                  branchSlug={branchSlugForLinks}
                  stopPropagation
                />
                <DealAgentHint deal={p} nameOf={getSupplierName} branchSlug={branchSlugForLinks} />
              </div>
            </td>
            <td className={icTdClass('left')}>
              <WarehouseLink
                warehouseId={p.warehouseId}
                name={getWarehouseName(p.warehouseId)}
                branchSlug={branchSlugForLinks ?? ''}
                stopPropagation
              />
            </td>
            <td className={icTdClass('left')}>
              <span className="text-xs font-medium text-slate-700">
                {formatSettlementModeLabel(p.settlementMode, p.metalPaymentMethod)}
              </span>
            </td>
            <td className={icTdClass('right')}>
              <span className="font-mono tabular-nums">
                {p.settlementMode === 'metal' ? '—' : p.units.toLocaleString()}
              </span>
            </td>
            <td className={icTdClass('right')}>
              <span className="font-mono tabular-nums text-amber-800">
                {p.settlementMode === 'metal'
                  ? (p.metalWeightG ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })
                  : '—'}
              </span>
            </td>
            <td className={icTdClass('right')}>
              <span className="font-mono tabular-nums text-indigo-900 dark:text-indigo-300">
                {formatDealTableInr(purchaseDealInr(p))}
              </span>
            </td>
            <td className={icTdClass('right')}>
              <span className="font-mono font-medium tabular-nums text-slate-900">
                {formatDealTableAed(purchaseDealAed(p))}
              </span>
            </td>
            <td className={icTdClass('center')} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-center gap-0.5">
                <ICTransferViewIconButton onClick={() => handleView(p)} />
                <DealInvoiceIconButtons purchase={p} />
                <ICTransferEditIconButton onClick={() => handleEdit(p)} />
              </div>
            </td>
          </tr>
        ))}
      </ICTransferDataTableShell>

      <AddPurchaseModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedPurchase(null);
        }}
        initialData={selectedPurchase || undefined}
        branchId={scopedBranchId}
        warehouses={isBranchScoped ? scopedWarehouses : undefined}
      />
      <ViewPurchaseModal
        open={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setSelectedPurchase(null);
        }}
        purchase={selectedPurchase}
      />
    </PageShell>
  );
}
