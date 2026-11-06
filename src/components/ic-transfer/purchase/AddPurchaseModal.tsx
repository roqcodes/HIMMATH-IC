'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { SmoothCollapse, SmoothModeSwap } from '@/components/ui/SmoothHeight';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { ICPurchase, ICWarehouse } from '@/types';
import SettlementModeToggle from '../shared/SettlementModeToggle';
import { emptyMetalFields } from '../shared/MetalSettlementFields';
import MetalPaymentToggle from '../shared/MetalPaymentToggle';
import type { MetalPaymentMethod } from '@/lib/domain/books';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { computeICSaleAmounts, formatAmount } from '@/lib/icTransfer/rateCalculations';
import {
  applyMetalFieldChange,
  metalFieldsFromRecord,
  METAL_AED_RATE_DIVISOR,
  type ICSettlementMode,
} from '@/lib/icTransfer/metalSettlement';
import {
  buildCounterpartySearchOptions,
  buildSupplierSearchOptions,
  buildWarehouseSearchOptions,
} from '@/lib/icTransfer/entitySearchOptions';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import {
  filterCounterpartiesForAgent,
  filterCounterpartiesForPurchase,
  filterWarehousesForAdminPortal,
  filterWarehousesForBranchPortal,
} from '@/lib/icTransfer/branchPortalScope';
import { PURCHASE_COUNTERPARTY_FIELD_LABEL } from '@/lib/counterparties/labels';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import { emptyLabFields, applyLabFieldChange, labFieldsFromRecord, netMetalInr } from '@/lib/icTransfer/labTest';
import type { LabTestFieldKey } from '@/lib/icTransfer/labTest';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import {
  icPurchaseModalShell,
  icPurchaseFormModalBody,
  icFormSectionEyebrow,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
} from '../shared/icTransferFormModalLayout';

const purchaseFieldLabel = `${icPurchaseDenseLabel} mb-1`;

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ICPurchase;
  branchId?: string;
  warehouses?: ICWarehouse[];
  lockedWarehouseId?: string;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;

const leftTopGrid = 'grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2';
const leftTopGridMetal = 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2';
const leftBottomGrid = 'grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3';
const leftBottomGridMetal =
  'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 lg:items-start';
const metalAmountRows = 'flex flex-col gap-2';
const metalAmountPairRow = 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2';
const purchaseNotesInput = `${asicInput} ${icPurchaseDenseInput} !min-h-9 max-h-9 resize-none py-1 text-sm leading-snug`;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionEyebrow}>{children}</h3>;
}

function PurchaseField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <AsicFormField label={label} colSpan={12} labelClassName={purchaseFieldLabel}>
        {children}
      </AsicFormField>
    </div>
  );
}

type BreakdownItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  deduct?: boolean;
  strong?: boolean;
};

function PurchaseBreakdownPanel({
  heading,
  items,
  metalG,
  inrAmount,
  aedAmount,
  context,
  swapKey,
  notes,
  onNotesChange,
  notesDisabled,
}: {
  heading: string;
  items: BreakdownItem[];
  metalG: number;
  inrAmount: number;
  aedAmount: number;
  context?: React.ReactNode;
  swapKey: string;
  notes: string;
  onNotesChange: (value: string) => void;
  notesDisabled?: boolean;
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-4">
      <SectionEyebrow>{heading}</SectionEyebrow>
      <SmoothModeSwap mode={swapKey} className="min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50/50">
        <ul className="flex-1 space-y-0 divide-y divide-slate-200/80 px-3 py-1">
          {items.map(item => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 py-2 text-xs first:pt-2 last:pb-2"
            >
              <span className="text-slate-500">{item.label}</span>
              <span
                className={`text-right font-mono text-xs tabular-nums ${
                  item.deduct
                    ? 'font-semibold text-red-600'
                    : item.strong
                      ? 'font-bold text-slate-900'
                      : 'font-semibold text-slate-800'
                }`}
              >
                {item.value}
              </span>
            </li>
          ))}
        </ul>
        {context ? (
          <div className="border-t border-slate-200/80 px-3 py-2 text-[11px] leading-snug text-slate-500">
            {context}
          </div>
        ) : null}
        <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Metal</span>
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
              {formatAmount(metalG, 4)} g
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Amount (INR)
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
              <FmtLedgerInr amount={inrAmount} />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Amount (AED)
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
              <FmtLedgerAed amount={aedAmount} />
            </span>
          </div>
        </div>
        </div>
      </SmoothModeSwap>
      <div className="shrink-0">
        <label className={purchaseFieldLabel} htmlFor="purchase-notes">
          Notes
        </label>
        <textarea
          id="purchase-notes"
          className={`${purchaseNotesInput} mt-1 w-full`}
          rows={1}
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Internal remark…"
          disabled={notesDisabled}
        />
      </div>
    </aside>
  );
}

function formatModalTimestamp(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
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
  const [lab, setLab] = useState(emptyLabFields());
  const warehouseOptions = useMemo(() => {
    if (warehouses) return warehouses;
    if (branchId) return filterWarehousesForBranchPortal(icWarehouses, branchId);
    return filterWarehousesForAdminPortal(icWarehouses);
  }, [warehouses, icWarehouses, branchId]);
  const supplierOptions = useMemo(() => {
    const base = branchId
      ? filterCounterpartiesForPurchase(icSuppliers, branchId)
      : filterCounterpartiesForPurchase(icSuppliers);
    return base;
  }, [icSuppliers, branchId]);
  const agentOptions = useMemo(() => {
    return branchId
      ? filterCounterpartiesForAgent(icSuppliers, branchId)
      : filterCounterpartiesForAgent(icSuppliers);
  }, [icSuppliers, branchId]);
  const [units, setUnits] = useState(initialData?.units?.toString() || '');
  const [rate, setRate] = useState(initialData?.unitRate?.toString() || '');
  const [supplierId, setSupplierId] = useState(
    initialData?.counterpartyId || initialData?.supplierId || '',
  );
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [metalPayment, setMetalPayment] = useState<MetalPaymentMethod>('CASH');
  const [aedAgentId, setAedAgentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const { entityLedgerById, warehouseAvailableById, warehouseMetalGById, refresh, refreshing } =
    useICTransferModalSnapshots(open, { warehouseId });

  const supplierSearchOptions = useMemo(
    () => buildSupplierSearchOptions(supplierOptions, entityLedgerById),
    [supplierOptions, entityLedgerById],
  );
  const agentSearchOptions = useMemo(
    () => buildCounterpartySearchOptions(agentOptions, entityLedgerById),
    [agentOptions, entityLedgerById],
  );
  const warehouseSearchOptions = useMemo(
    () =>
      buildWarehouseSearchOptions(
        warehouseOptions,
        icSales,
        warehouseAvailableById,
        warehouseMetalGById,
        icPurchases,
      ),
    [warehouseOptions, icSales, icPurchases, warehouseAvailableById, warehouseMetalGById],
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
  const metalAed = metalPayment === 'AED';

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
      setMetal(
        metalFieldsFromRecord({
          metalWeightG: initialData?.metalWeightG,
          metalRateInrPerG: initialData?.metalRateInrPerG,
          metalRateAedPerG: initialData?.metalRateAedPerG,
          inrTotal: initialData?.inrTotal,
          aedTotal: initialData?.aedTotal,
        }),
      );
      setMetalPayment(normalizeMetalPaymentMethod(initialData?.metalPaymentMethod ?? 'CASH'));
      setAedAgentId(initialData?.aedAgentCounterpartyId || initialData?.aedAgentId || '');
      setLab(
        labFieldsFromRecord({
          labWeightG: initialData?.labWeightG,
          labChargeInrPerG: initialData?.labChargeInrPerG,
          labTotalInr: initialData?.labTotalInr,
        }),
      );

      if (!lockedWarehouseId && !initialData?.warehouseId && warehouseOptions.length === 1) {
        setWarehouseId(warehouseOptions[0]!.id);
      }
    }
  }, [open, initialData, lockedWarehouseId, warehouseOptions]);

  const unitNum = parseFloat(units) || 0;
  const rateNum = parseFloat(rate) || 0;
  const amounts = computeICSaleAmounts(unitNum, rateNum);
  const metalNetInr = netMetalInr(metal.inrTotal, lab.labTotalInr);
  const kpiMetalG = isMetal ? metal.metalWeightG : 0;
  const kpiInr = isMetal ? metalNetInr : amounts.inrTotal;
  const kpiAed = isMetal ? (metalAed ? metal.aedTotal : 0) : amounts.aedNetTotal;

  const onMetalField = useCallback(
    (field: 'weight' | 'rateInr' | 'sheetRateAed' | 'totalInr' | 'totalAed', raw: string) => {
      setMetal(prev => applyMetalFieldChange(prev, field, parseNum(raw)));
    },
    [],
  );

  const onLabField = useCallback((field: LabTestFieldKey, raw: string) => {
    setLab(prev => applyLabFieldChange(prev, field, parseNum(raw)));
  }, []);

  const canSubmitCash = unitNum > 0 && rateNum > 0 && supplierId && warehouseId;
  const canSubmitMetal =
    supplierId &&
    warehouseId &&
    metal.metalWeightG > 0 &&
    metal.metalRateInrPerG > 0 &&
    metal.inrTotal > 0 &&
    (!metalAed ||
      (metal.metalSheetRateAed > 0 &&
        metal.metalRateAedPerG > 0 &&
        metal.aedTotal > 0 &&
        aedAgentId.trim().length > 0));
  const canSubmit = isMetal ? canSubmitMetal : canSubmitCash;

  const breakdownItems = useMemo((): BreakdownItem[] => {
    if (!isMetal) {
      return [
        { id: 'units', label: 'Units', value: formatAmount(unitNum, 4) },
        { id: 'rate', label: 'Unit rate (AED)', value: formatAmount(rateNum) },
        {
          id: 'inr',
          label: 'Amount (INR)',
          value: <FmtLedgerInr amount={amounts.inrTotal} />,
          strong: true,
        },
        {
          id: 'aed',
          label: 'Amount (AED)',
          value: <FmtLedgerAed amount={amounts.aedNetTotal} />,
          strong: true,
        },
      ];
    }

    const items: BreakdownItem[] = [
      { id: 'w', label: 'Weight', value: `${formatAmount(metal.metalWeightG, 4)} g` },
      {
        id: 'gr',
        label: 'G rate (INR/g)',
        value: <FmtLedgerInr amount={metal.metalRateInrPerG} />,
      },
      {
        id: 'gross',
        label: 'Metal (INR)',
        value: <FmtLedgerInr amount={metal.inrTotal} />,
      },
    ];
    if (lab.labTotalInr > 0) {
      items.push({
        id: 'lab',
        label: 'Lab test',
        value: <>− <FmtLedgerInr amount={lab.labTotalInr} /></>,
        deduct: true,
      });
    }
    items.push({
      id: 'net',
      label: 'Net (INR)',
      value: <FmtLedgerInr amount={metalNetInr} />,
      strong: true,
    });
    if (metalAed) {
      items.push({
        id: 'aedr',
        label: 'Rate (AED)',
        value: formatAmount(metal.metalSheetRateAed),
      });
      items.push({
        id: 'aedt',
        label: 'Total (AED)',
        value: <FmtLedgerAed amount={metal.aedTotal} />,
        strong: true,
      });
    }
    return items;
  }, [
    isMetal,
    unitNum,
    rateNum,
    amounts.inrTotal,
    amounts.aedNetTotal,
    metal,
    lab.labTotalInr,
    metalNetInr,
    metalAed,
  ]);

  const stockContext =
    supplierId && warehouseId ? (
      <>
        On hand:{' '}
        <span className="font-mono font-medium tabular-nums text-slate-600">
          {(warehouseAvailable ?? 0).toLocaleString()}
        </span>{' '}
        units ·{' '}
        <span className="font-mono font-medium tabular-nums text-slate-600">
          {formatMetalGrams(warehouseMetalG ?? 0)}
        </span>
        {refreshing ? <span className="text-slate-400"> · updating…</span> : null}
        {' · '}
        Supplier:{' '}
        {isMetal ? (
          <span className="font-mono font-medium tabular-nums">{metalAtSupplier.toLocaleString()} g</span>
        ) : (
          <>
            <span className="font-mono font-medium tabular-nums">{totalStock.toLocaleString()}</span> units
            {averageRate > 0 ? (
              <>
                {' '}
                · avg{' '}
                <span className="font-mono font-medium tabular-nums">
                  {formatAmount(averageRate)} AED
                </span>
              </>
            ) : null}
          </>
        )}
      </>
    ) : null;

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
          metalPaymentMethod: metalPayment,
          aedAgentId: metalAed ? aedAgentId : null,
          unitRate: 0,
          units: 0,
          metalWeightG: metal.metalWeightG,
          metalRateInrPerG: metal.metalRateInrPerG,
          metalRateAedPerG: metalAed ? metal.metalRateAedPerG : 0,
          inrTotal: metal.inrTotal,
          aedTotal: metalAed ? metal.aedTotal : undefined,
          labWeightG: lab.labWeightG || undefined,
          labChargeInrPerG: lab.labChargeInrPerG || undefined,
          labTotalInr: lab.labTotalInr || undefined,
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

  const modalTitle = initialData ? 'Edit Purchase' : 'Add Purchase';

  const timestampBadge = (
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-600 sm:px-2.5 sm:text-xs">
      {now ? formatModalTimestamp(now) : '…'}
    </span>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      headerCenter={
        <SettlementModeToggle
          value={settlementMode}
          onChange={setSettlementMode}
          lockMode={lockMode}
          disabled={isSubmitting}
        />
      }
      headerTrailing={timestampBadge}
      maxWidth="max-w-6xl w-[96vw]"
      maxHeight={icPurchaseModalShell}
      heightClass="lg:h-[min(90vh,880px)]"
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:overflow-hidden`}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="ic-purchase-form"
            className={btnPrimary}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Purchase'}
          </button>
        </>
      }
    >
      <form
        id="ic-purchase-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
          <div
            className={`flex min-h-0 flex-col lg:col-span-8 lg:min-h-0 ${
              isMetal ? 'gap-2.5 lg:h-full lg:justify-between' : 'gap-1.5'
            }`}
          >
            <div className={isMetal ? leftTopGridMetal : leftTopGrid}>
              <PurchaseField label={`${PURCHASE_COUNTERPARTY_FIELD_LABEL} *`}>
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
                    inputClassName={denseInput}
                    showDetailLine={false}
                    onFocusRefresh={() => void refresh()}
                  />
                )}
              </PurchaseField>

              <PurchaseField label="Warehouse *">
                {lockedWarehouseId ? (
                  <input
                    className={`${denseInput} cursor-not-allowed bg-slate-50 text-slate-700`}
                    readOnly
                    disabled
                    value={lockedWarehouse?.name || 'Warehouse'}
                    aria-readonly
                  />
                ) : warehouseSearchOptions.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                    No warehouses configured.
                  </p>
                ) : (
                  <EntitySearchSelect
                    selectedId={warehouseId}
                    onSelectId={id => setWarehouseId(id)}
                    options={warehouseSearchOptions}
                    placeholder="Search by code or name…"
                    inputClassName={denseInput}
                    showDetailLine={false}
                    onFocusRefresh={() => void refresh()}
                  />
                )}
              </PurchaseField>

              <SmoothCollapse open={isMetal} className="sm:col-span-2">
                <div className={leftTopGridMetal}>
                  <PurchaseField label="Payment method" className="min-w-0 w-full">
                    <MetalPaymentToggle
                      value={metalPayment}
                      onChange={setMetalPayment}
                      disabled={isSubmitting}
                      hideCaption
                      fullWidth
                    />
                  </PurchaseField>
                  <SmoothCollapse open={metalAed}>
                    <PurchaseField label="Collection agent (UAE) *">
                      <EntitySearchSelect
                        selectedId={aedAgentId}
                        onSelectId={id => setAedAgentId(id)}
                        options={agentSearchOptions}
                        placeholder="Search by code or name…"
                        inputClassName={denseInput}
                        showDetailLine={false}
                        disabled={isSubmitting}
                        onFocusRefresh={() => void refresh()}
                      />
                    </PurchaseField>
                  </SmoothCollapse>
                </div>
              </SmoothCollapse>

            </div>

            <div
              className={`border-t border-slate-200 ${
                isMetal ? 'flex min-h-0 flex-col pt-2.5 lg:min-h-0 lg:flex-1 lg:justify-between' : 'pt-1.5'
              }`}
            >
              <SmoothModeSwap
                mode={settlementMode}
                className={isMetal ? 'min-h-0 lg:flex-1' : undefined}
              >
                {isMetal ? (
                  <div className="flex min-h-0 flex-col gap-3 lg:flex-1 lg:justify-between">
                    <div className={metalAmountRows}>
                      <PurchaseField label="Weight (g) *" className="max-w-md">
                        <input
                          className={denseInput}
                          type="number"
                          step="0.0001"
                          disabled={isSubmitting}
                          value={metal.metalWeightG || ''}
                          onChange={e => onMetalField('weight', e.target.value)}
                        />
                      </PurchaseField>
                      <div className={metalAmountPairRow}>
                        <PurchaseField label="G rate (INR) *">
                          <input
                            className={denseInput}
                            type="number"
                            step="0.0001"
                            disabled={isSubmitting}
                            value={metal.metalRateInrPerG || ''}
                            onChange={e => onMetalField('rateInr', e.target.value)}
                          />
                        </PurchaseField>
                        <PurchaseField label="Total (INR)">
                          <input
                            className={denseInput}
                            type="number"
                            step="0.01"
                            disabled={isSubmitting}
                            value={metal.inrTotal || ''}
                            onChange={e => onMetalField('totalInr', e.target.value)}
                          />
                        </PurchaseField>
                      </div>
                      <SmoothCollapse open={metalAed}>
                        <div className={metalAmountPairRow}>
                          <PurchaseField label="Rate (AED)">
                            <input
                              className={denseInput}
                              type="number"
                              step="0.0001"
                              disabled={isSubmitting}
                              value={metal.metalSheetRateAed || ''}
                              onChange={e => onMetalField('sheetRateAed', e.target.value)}
                              title={`AED = INR × rate ÷ ${METAL_AED_RATE_DIVISOR.toLocaleString()}`}
                            />
                          </PurchaseField>
                          <PurchaseField label="Total (AED)">
                            <input
                              className={denseInput}
                              type="number"
                              step="0.01"
                              disabled={isSubmitting}
                              value={metal.aedTotal || ''}
                              onChange={e => onMetalField('totalAed', e.target.value)}
                            />
                          </PurchaseField>
                        </div>
                      </SmoothCollapse>
                    </div>

                    <div className="shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 lg:mt-auto">
                      <div className="mb-1.5">
                        <span className={icFormSectionEyebrow}>Lab test (INR)</span>
                      </div>
                      <div className={leftBottomGridMetal}>
                        <PurchaseField label="Weight (g)">
                          <input
                            className={denseInput}
                            type="number"
                            step="0.0001"
                            disabled={isSubmitting}
                            value={lab.labWeightG || ''}
                            onChange={e => onLabField('weight', e.target.value)}
                          />
                        </PurchaseField>
                        <PurchaseField label="Charge (INR/g)">
                          <input
                            className={denseInput}
                            type="number"
                            step="0.0001"
                            disabled={isSubmitting}
                            value={lab.labChargeInrPerG || ''}
                            onChange={e => onLabField('charge', e.target.value)}
                          />
                        </PurchaseField>
                        <PurchaseField label="Total (INR)">
                          <input
                            className={denseInput}
                            type="number"
                            step="0.01"
                            disabled={isSubmitting}
                            value={lab.labTotalInr || ''}
                            onChange={e => onLabField('total', e.target.value)}
                          />
                        </PurchaseField>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={leftTopGrid}>
                    <PurchaseField label="Unit rate (AED) *">
                      <input
                        className={denseInput}
                        value={rate}
                        onChange={e => setRate(e.target.value)}
                        type="number"
                        step="any"
                        placeholder="0.00"
                      />
                    </PurchaseField>
                    <PurchaseField label="Units *">
                      <input
                        className={denseInput}
                        value={units}
                        onChange={e => setUnits(e.target.value)}
                        type="number"
                        step="any"
                        placeholder="0"
                      />
                    </PurchaseField>
                  </div>
                )}
              </SmoothModeSwap>
            </div>
          </div>

          <PurchaseBreakdownPanel
            heading="Price breakdown"
            items={breakdownItems}
            metalG={kpiMetalG}
            inrAmount={kpiInr}
            aedAmount={kpiAed}
            context={stockContext}
            swapKey={`${settlementMode}-${metalPayment}`}
            notes={notes}
            onNotesChange={setNotes}
            notesDisabled={isSubmitting}
          />
        </div>
      </form>
    </Modal>
  );
}
