'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { ICPurchase, ICWarehouse } from '@/types';
import ICSaleAmountCards from '../shared/ICSaleAmountCards';
import SettlementModeToggle from '../shared/SettlementModeToggle';
import MetalSettlementFields, { emptyMetalFields } from '../shared/MetalSettlementFields';
import { computeICSaleAmounts } from '@/lib/icTransfer/rateCalculations';
import type { ICSettlementMode } from '@/lib/icTransfer/metalSettlement';
import {
  buildSupplierSearchOptions,
  buildWarehouseSearchOptions,
} from '@/lib/icTransfer/entitySearchOptions';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import {
  filterSuppliersForAdminPortal,
  filterSuppliersForBranchPortal,
  filterWarehousesForAdminPortal,
  filterWarehousesForBranchPortal,
} from '@/lib/icTransfer/branchPortalScope';
import { PURCHASE_COUNTERPARTY_FIELD_LABEL } from '@/lib/counterparties/labels';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import SettlementModePanel from '../shared/SettlementModePanel';
import {
  icPurchaseModalShell,
  icPurchaseStockContextMinH,
  icFormModalBody,
  icFormSectionHeading,
  icFormColumnGap,
  icFormGridGap,
} from '../shared/icTransferFormModalLayout';

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ICPurchase;
  branchId?: string;
  warehouses?: ICWarehouse[];
  lockedWarehouseId?: string;
};

const InputField = ({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12 }) => (
  <AsicFormField label={label} colSpan={colSpan}>{children}</AsicFormField>
);

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionHeading}>{children}</h3>;
}

export default function AddPurchaseModal({
  open,
  onClose,
  initialData,
  branchId,
  warehouses,
  lockedWarehouseId,
}: Props) {
  const {
    icSuppliers,
    icWarehouses,
    icSales,
    addICPurchase,
    updateICPurchase,
    icPurchases,
  } = useApp();
  const [settlementMode, setSettlementMode] = useState<ICSettlementMode>('cash');
  const [metal, setMetal] = useState(emptyMetalFields());
  const warehouseOptions = useMemo(() => {
    if (warehouses) return warehouses;
    if (branchId) return filterWarehousesForBranchPortal(icWarehouses, branchId);
    return filterWarehousesForAdminPortal(icWarehouses);
  }, [warehouses, icWarehouses, branchId]);
  const supplierOptions = useMemo(() => {
    if (branchId) return filterSuppliersForBranchPortal(icSuppliers, branchId);
    return filterSuppliersForAdminPortal(icSuppliers);
  }, [icSuppliers, branchId]);
  const [units, setUnits] = useState(initialData?.units?.toString() || '');
  const [rate, setRate] = useState(initialData?.unitRate?.toString() || '');
  const [supplierId, setSupplierId] = useState(
    initialData?.counterpartyId || initialData?.supplierId || '',
  );
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const snapshotKey = `${supplierId}|${warehouseId}`;
  const { supplierBalances, warehouseAvailableById, warehouseMetalGById, refresh, refreshing } =
    useICTransferModalSnapshots(open, snapshotKey);

  const supplierSearchOptions = useMemo(
    () => buildSupplierSearchOptions(supplierOptions, supplierBalances),
    [supplierOptions, supplierBalances],
  );
  const warehouseSearchOptions = useMemo(
    () =>
      buildWarehouseSearchOptions(warehouseOptions, icSales, warehouseAvailableById, warehouseMetalGById),
    [warehouseOptions, icSales, warehouseAvailableById, warehouseMetalGById],
  );

  const lockedWarehouse = useMemo(() => {
    if (!lockedWarehouseId) return null;
    return (
      warehouseOptions.find(w => w.id === lockedWarehouseId) ||
      icWarehouses.find(w => w.id === lockedWarehouseId) ||
      null
    );
  }, [lockedWarehouseId, warehouseOptions, icWarehouses]);

  const isMetal = settlementMode === 'metal';
  const lockMode = Boolean(initialData?.id);

  const selectedPurchases = icPurchases.filter(p => {
    if (effectivePurchaseCounterpartyId(p) !== supplierId) return false;
    if (warehouseId) return p.warehouseId === warehouseId;
    return true;
  });
  const totalStock = selectedPurchases.reduce((acc, p) => acc + (p.units || 0), 0);
  const averageRate = selectedPurchases.length
    ? selectedPurchases.reduce((acc, p) => acc + (p.unitRate || 0), 0) / selectedPurchases.length
    : 0;

  const warehouseAvailable =
    warehouseId && warehouseAvailableById[warehouseId] !== undefined
      ? warehouseAvailableById[warehouseId]
      : null;
  const warehouseMetalG =
    warehouseId && warehouseMetalGById[warehouseId] !== undefined
      ? warehouseMetalGById[warehouseId]
      : null;
  const metalAtSupplier = selectedPurchases
    .filter(p => p.settlementMode === 'metal')
    .reduce((acc, p) => acc + (p.metalWeightG || 0), 0);

  useEffect(() => {
    if (open) {
      setNow(new Date());
      const mode = initialData?.settlementMode === 'metal' ? 'metal' : 'cash';
      setSettlementMode(mode);
      setUnits(initialData?.units?.toString() || '');
      setRate(initialData?.unitRate?.toString() || '');
      setSupplierId(initialData?.counterpartyId || initialData?.supplierId || '');
      setWarehouseId(lockedWarehouseId || initialData?.warehouseId || '');
      setNotes(initialData?.notes || '');
      setMetal({
        metalWeightG: initialData?.metalWeightG ?? 0,
        metalRateInrPerG: initialData?.metalRateInrPerG ?? 0,
        metalRateAedPerG: initialData?.metalRateAedPerG ?? 0,
        inrTotal: initialData?.inrTotal ?? 0,
        aedTotal: initialData?.aedTotal ?? 0,
      });

      if (!lockedWarehouseId && !initialData?.warehouseId && warehouseOptions.length === 1) {
        setWarehouseId(warehouseOptions[0]!.id);
      }
    }
  }, [open, initialData, lockedWarehouseId, warehouseOptions]);

  const unitNum = parseFloat(units) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amounts = computeICSaleAmounts(unitNum, rateNum);

  const canSubmitCash = unitNum > 0 && rateNum > 0 && supplierId && warehouseId;
  const canSubmitMetal =
    supplierId &&
    warehouseId &&
    metal.metalWeightG > 0 &&
    metal.metalRateInrPerG > 0 &&
    metal.metalRateAedPerG > 0 &&
    metal.inrTotal > 0 &&
    metal.aedTotal > 0;
  const canSubmit = isMetal ? canSubmitMetal : canSubmitCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    const locationId = warehouseId
      ? warehouseOptions.find(w => w.id === warehouseId)?.regionId || undefined
      : undefined;

    const payload: Omit<ICPurchase, 'id' | 'createdAt'> = isMetal
      ? {
          counterpartyId: supplierId,
          warehouseId: warehouseId || undefined,
          locationId,
          settlementMode: 'metal',
          paymentMethod: 'AED',
          unitRate: 0,
          units: 0,
          metalWeightG: metal.metalWeightG,
          metalRateInrPerG: metal.metalRateInrPerG,
          metalRateAedPerG: metal.metalRateAedPerG,
          inrTotal: metal.inrTotal,
          aedTotal: metal.aedTotal,
          notes,
        }
      : {
          counterpartyId: supplierId,
          warehouseId: warehouseId || undefined,
          locationId,
          settlementMode: 'cash',
          unitRate: rateNum,
          units: unitNum,
          notes,
          aedTotal: amounts.aedNetTotal,
        };

    if (initialData) {
      await updateICPurchase(initialData.id, payload);
    } else {
      await addICPurchase(payload);
    }

    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Purchase' : 'Add Purchase'}
      maxWidth="max-w-[1100px] w-[95vw]"
      maxHeight={icPurchaseModalShell}
      bodyClassName={icFormModalBody}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" form="ic-purchase-form" className={btnPrimary} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Purchase'}
          </button>
        </>
      }
    >
      <form id="ic-purchase-form" onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SettlementModeToggle
            value={settlementMode}
            onChange={setSettlementMode}
            lockMode={lockMode}
            disabled={isSubmitting}
          />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-elevated)]">
              {now ? now.toLocaleDateString() : '…'}
            </span>
            <span className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-elevated)]">
              {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…'}
            </span>
          </div>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-12 lg:items-start ${icFormGridGap}`}>
          <div className={`flex min-h-0 flex-col lg:col-span-5 ${icFormColumnGap}`}>
            <SectionHeading>{PURCHASE_COUNTERPARTY_FIELD_LABEL} &amp; warehouse</SectionHeading>

            <InputField label={`${PURCHASE_COUNTERPARTY_FIELD_LABEL} *`} colSpan={12}>
              {supplierSearchOptions.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  No suppliers available.
                </p>
              ) : (
                <EntitySearchSelect
                  selectedId={supplierId}
                  onSelectId={id => setSupplierId(id)}
                  options={supplierSearchOptions}
                  placeholder="Search by code or name…"
                  onFocusRefresh={() => void refresh()}
                />
              )}
            </InputField>

            <InputField label="Warehouse *" colSpan={12}>
              {lockedWarehouseId ? (
                <input
                  className={`${asicInput} cursor-not-allowed bg-slate-50 text-slate-700`}
                  readOnly
                  disabled
                  value={lockedWarehouse?.name || 'Warehouse'}
                  aria-readonly
                />
              ) : warehouseSearchOptions.length === 0 ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                  No warehouses configured — add a warehouse before recording stock.
                </p>
              ) : (
                <EntitySearchSelect
                  selectedId={warehouseId}
                  onSelectId={id => setWarehouseId(id)}
                  options={warehouseSearchOptions}
                  placeholder="Search by code or name…"
                  onFocusRefresh={() => void refresh()}
                />
              )}
            </InputField>

            <div
              className={`rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs leading-snug text-slate-600 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-elevated)] ${icPurchaseStockContextMinH}`}
            >
              {supplierId && warehouseId ? (
                <>
                  <p className="font-semibold uppercase tracking-wide text-slate-500">Stock at warehouse</p>
                  {isMetal ? (
                    <p className="mt-0.5 text-sm text-slate-800 dark:text-[var(--theme-text)]">
                      <span className="font-mono font-semibold tabular-nums">
                        {(warehouseMetalG ?? 0).toLocaleString()}
                      </span>{' '}
                      g metal on hand
                      {refreshing ? <span className="ml-1 text-[11px] font-normal text-slate-400">· updating…</span> : null}
                    </p>
                  ) : warehouseAvailable != null ? (
                    <p className="mt-0.5 text-sm text-slate-800 dark:text-[var(--theme-text)]">
                      <span className="font-mono font-semibold tabular-nums">{warehouseAvailable.toLocaleString()}</span>{' '}
                      units available to sell
                      {refreshing ? <span className="ml-1 text-[11px] font-normal text-slate-400">· updating…</span> : null}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-sm text-slate-400">Loading warehouse availability…</p>
                  )}
                  <p className="mt-0.5 text-sm text-slate-800 dark:text-[var(--theme-text)]">
                    Supplier history:{' '}
                    {isMetal ? (
                      <>
                        <span className="font-mono font-semibold tabular-nums">{metalAtSupplier.toLocaleString()}</span> g
                      </>
                    ) : (
                      <>
                        <span className="font-mono font-semibold tabular-nums">{totalStock.toLocaleString()}</span> units
                        {' · '}
                        avg{' '}
                        <span className="font-mono font-semibold tabular-nums">
                          AED {averageRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-400">Select supplier and warehouse to see on-hand context.</p>
              )}
            </div>

            <div className="flex flex-col gap-1 border-t border-slate-100 pt-1.5 dark:border-[var(--theme-border)]">
              <SectionHeading>Notes</SectionHeading>
              <textarea
                className={`${asicTextarea} min-h-[3.25rem] resize-none py-1.5 text-sm`}
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional reference, payment detail, or internal remark…"
              />
            </div>
          </div>

          <div className={`flex flex-col lg:col-span-7 lg:border-l lg:border-slate-100 lg:pl-5 dark:lg:border-[var(--theme-border)] ${icFormColumnGap}`}>
            <SectionHeading>{isMetal ? 'Metal settlement' : 'Purchase amounts'}</SectionHeading>

            <SettlementModePanel
              active={settlementMode}
              metal={<MetalSettlementFields value={metal} onChange={setMetal} disabled={isSubmitting} />}
              cash={
                <>
                  <div className={asicFormGrid}>
                    <InputField label="Unit rate (AED) *" colSpan={6}>
                      <input
                        className={asicInput}
                        value={rate}
                        onChange={e => setRate(e.target.value)}
                        type="number"
                        step="any"
                        placeholder="0.00"
                      />
                    </InputField>
                    <InputField label="Units *" colSpan={6}>
                      <input
                        className={asicInput}
                        value={units}
                        onChange={e => setUnits(e.target.value)}
                        type="number"
                        step="any"
                        placeholder="0"
                      />
                    </InputField>
                  </div>
                  <ICSaleAmountCards
                    units={unitNum}
                    inrTotal={amounts.inrTotal}
                    aedNetTotal={amounts.aedNetTotal}
                  />
                </>
              }
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
