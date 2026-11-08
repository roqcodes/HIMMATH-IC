'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AsicFormField from '@/components/asic/AsicFormField';
import { SmoothCollapse, SmoothModeSwap } from '@/components/ui/SmoothHeight';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { ICPurchase, ICWarehouse } from '@/types';
import SettlementModeToggle from '../shared/SettlementModeToggle';
import { emptyMetalFields } from '../shared/MetalSettlementFields';
import FormattedNumberInput from '../shared/FormattedNumberInput';
import MetalPaymentToggle from '../shared/MetalPaymentToggle';
import type { MetalPaymentMethod } from '@/lib/domain/books';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import {
  computeICSaleAmounts,
  formatAmount,
  RATE_DECIMAL_PLACES,
} from '@/lib/icTransfer/rateCalculations';
import {
  applyMetalFieldChange,
  computeImpliedMetalRateAedPerG,
  computeMetalAedFromInr,
  computeMetalSheetRateAed,
  metalFieldsFromRecord,
  METAL_AED_RATE_DIVISOR,
  METAL_AMOUNT_DECIMALS,
  METAL_WEIGHT_DECIMALS,
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
import PartyLedgerStrip from '../shared/PartyLedgerStrip';
import type { LabTestFieldKey } from '@/lib/icTransfer/labTest';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import {
  icPurchaseModalShell,
  icPurchaseFormModalBody,
  icFormSectionEyebrow,
  icPurchaseDenseInput,
  icPurchaseDenseLabel,
} from '../shared/icTransferFormModalLayout';
import {
  stringifyIcPurchaseFormSnapshot,
  type ICPurchaseFormSnapshot,
} from '@/lib/icTransfer/icTransferModalFormSnapshots';
import { pauseTransactionalRefetchForModal } from '@/lib/icTransfer/transactionalRefetchPause';

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
  ledger,
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
  ledger?: React.ReactNode;
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
      {ledger}
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
  const [units, setUnits] = useState(initialData?.units ?? 0);
  const [rate, setRate] = useState(initialData?.unitRate ?? 0);
  const [supplierId, setSupplierId] = useState(
    initialData?.counterpartyId || initialData?.supplierId || '',
  );
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [metalPayment, setMetalPayment] = useState<MetalPaymentMethod>('CASH');
  const [aedAgentId, setAedAgentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const formInitSeqRef = useRef(0);
  const baselineFormRef = useRef('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  /** Increments each time the modal opens so we reset form even when initialData?.id is unchanged (e.g. add twice). */
  const [purchaseModalOpenSession, setPurchaseModalOpenSession] = useState(0);

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
  const selectedSupplier = useMemo(
    () => supplierOptions.find(s => s.id === supplierId) ?? null,
    [supplierOptions, supplierId],
  );

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

  const capturePurchaseFormSnapshot = useCallback((): ICPurchaseFormSnapshot => {
    return {
      kind: 'purchase',
      settlementMode,
      units,
      rate,
      supplierId,
      warehouseId,
      notes,
      metalPayment,
      aedAgentId,
      metal,
      lab,
    };
  }, [settlementMode, units, rate, supplierId, warehouseId, notes, metalPayment, aedAgentId, metal, lab]);

  const formStateRef = useRef(capturePurchaseFormSnapshot());
  formStateRef.current = capturePurchaseFormSnapshot();

  const isFormDirty = useCallback(
    () => stringifyIcPurchaseFormSnapshot(capturePurchaseFormSnapshot()) !== baselineFormRef.current,
    [capturePurchaseFormSnapshot],
  );

  const requestClose = useCallback(() => {
    if (!isFormDirty()) {
      onClose();
      return;
    }
    setDiscardConfirmOpen(true);
  }, [onClose, isFormDirty]);

  const confirmDiscardClose = useCallback(() => {
    setDiscardConfirmOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setDiscardConfirmOpen(false);
      return;
    }
    setPurchaseModalOpenSession(s => s + 1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    return pauseTransactionalRefetchForModal();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    ++formInitSeqRef.current;

    setNow(new Date());
    const mode = initialData?.settlementMode === 'metal' ? 'metal' : 'cash';
    setSettlementMode(mode);

    const resolvedWarehouseId = lockedWarehouseId || initialData?.warehouseId || '';

    setUnits(initialData?.units ?? 0);
    setRate(initialData?.unitRate ?? 0);
    setSupplierId(initialData?.counterpartyId || initialData?.supplierId || '');
    setWarehouseId(resolvedWarehouseId);
    setNotes(initialData?.notes || '');
    const nextMetal = metalFieldsFromRecord({
      metalWeightG: initialData?.metalWeightG,
      metalRateInrPerG: initialData?.metalRateInrPerG,
      metalRateAedPerG: initialData?.metalRateAedPerG,
      inrTotal: initialData?.inrTotal,
      aedTotal: initialData?.aedTotal,
    });
    setMetal(nextMetal);
    const nextMetalPayment = normalizeMetalPaymentMethod(initialData?.metalPaymentMethod ?? 'CASH');
    setMetalPayment(nextMetalPayment);
    setAedAgentId(initialData?.aedAgentCounterpartyId || initialData?.aedAgentId || '');
    const nextLab = labFieldsFromRecord({
      labWeightG: initialData?.labWeightG,
      labChargeInrPerG: initialData?.labChargeInrPerG,
      labTotalInr: initialData?.labTotalInr,
    });
    setLab(nextLab);

  }, [open, purchaseModalOpenSession, initialData?.id, lockedWarehouseId]);

  /** Auto-pick lone warehouse after options load — without resetting whole form on icPurchases refresh. */
  useEffect(() => {
    if (!open) return;
    if (lockedWarehouseId || initialData?.warehouseId) return;
    if (warehouseOptions.length !== 1) return;
    setWarehouseId(warehouseOptions[0]!.id);
  }, [open, warehouseOptions, lockedWarehouseId, initialData?.warehouseId]);

  useEffect(() => {
    if (!open) return;
    const seq = formInitSeqRef.current;
    const t = window.setTimeout(() => {
      if (formInitSeqRef.current !== seq) return;
      baselineFormRef.current = stringifyIcPurchaseFormSnapshot(formStateRef.current);
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, purchaseModalOpenSession, initialData?.id]);

  const unitNum = units;
  const rateNum = rate;
  const amounts = computeICSaleAmounts(unitNum, rateNum);
  const metalNetInr = netMetalInr(metal.inrTotal, lab.labTotalInr);

  const metalAedTotal = useMemo(() => {
    if (!isMetal || !metalAed) return metal.aedTotal;
    const sheet = metal.metalSheetRateAed;
    if (!sheet || sheet <= 0) return metal.aedTotal;
    return computeMetalAedFromInr(metalNetInr, sheet);
  }, [isMetal, metalAed, metal.aedTotal, metal.metalSheetRateAed, metalNetInr]);

  useEffect(() => {
    if (!isMetal || !metalAed || settlementMode !== 'metal') return;
    const sheet = metal.metalSheetRateAed;
    if (!sheet || sheet <= 0 || !metal.inrTotal) return;
    const nextAed = computeMetalAedFromInr(metalNetInr, sheet);
    const nextPerG = computeImpliedMetalRateAedPerG(metal.metalWeightG, nextAed);
    setMetal(prev => {
      if (
        Math.abs((prev.aedTotal || 0) - nextAed) < 0.0001 &&
        Math.abs((prev.metalRateAedPerG || 0) - nextPerG) < 0.0001
      ) {
        return prev;
      }
      return { ...prev, aedTotal: nextAed, metalRateAedPerG: nextPerG };
    });
  }, [
    isMetal,
    metalAed,
    settlementMode,
    metal.metalSheetRateAed,
    metal.inrTotal,
    metal.metalWeightG,
    metalNetInr,
  ]);

  const kpiMetalG = isMetal ? metal.metalWeightG : 0;
  const kpiInr = isMetal ? metalNetInr : amounts.inrTotal;
  const kpiAed = isMetal ? (metalAed ? metalAedTotal : 0) : amounts.aedNetTotal;

  const onMetalField = useCallback(
    (field: 'weight' | 'rateInr' | 'sheetRateAed' | 'totalInr' | 'totalAed', n: number) => {
      setMetal(prev => applyMetalFieldChange(prev, field, n));
    },
    [],
  );

  const onLabField = useCallback((field: LabTestFieldKey, n: number) => {
    setLab(prev => applyLabFieldChange(prev, field, n));
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
        metalAedTotal > 0 &&
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
        value: <FmtLedgerAed amount={metalAedTotal} />,
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
    metalAedTotal,
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
    if (!canSubmit || isSubmitting) return;
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
          metalRateAedPerG: metalAed
            ? computeImpliedMetalRateAedPerG(metal.metalWeightG, metalAedTotal)
            : 0,
          inrTotal: metal.inrTotal,
          aedTotal: metalAed ? metalAedTotal : undefined,
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

    const ok = initialData
      ? await updateICPurchase(initialData.id, payload)
      : await addICPurchase(payload);

    setIsSubmitting(false);
    if (!ok) return;
    onClose();
  };

  const modalTitle = initialData ? 'Edit Purchase' : 'Add Purchase';

  const timestampBadge = (
    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium tabular-nums text-slate-600 sm:px-2.5 sm:text-xs">
      {now ? formatModalTimestamp(now) : '…'}
    </span>
  );

  return (
    <>
    <Modal
      open={open}
      onRequestClose={requestClose}
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
          <button type="button" className={btnSecondary} onClick={requestClose} disabled={isSubmitting}>
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
                        <FormattedNumberInput
                          className={denseInput}
                          book="inr"
                          maxFractionDigits={METAL_WEIGHT_DECIMALS}
                          disabled={isSubmitting}
                          value={metal.metalWeightG}
                          onNumericChange={n => onMetalField('weight', n)}
                        />
                      </PurchaseField>
                      <div className={metalAmountPairRow}>
                        <PurchaseField label="G rate (INR) *">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={isSubmitting}
                            value={metal.metalRateInrPerG}
                            onNumericChange={n => onMetalField('rateInr', n)}
                          />
                        </PurchaseField>
                        <PurchaseField label="Total (INR)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={isSubmitting}
                            value={metal.inrTotal}
                            onNumericChange={n => onMetalField('totalInr', n)}
                          />
                        </PurchaseField>
                      </div>
                      <SmoothCollapse open={metalAed}>
                        <div className={metalAmountPairRow}>
                          <PurchaseField label="Rate (AED)">
                            <FormattedNumberInput
                              className={denseInput}
                              book="aed"
                              maxFractionDigits={METAL_AMOUNT_DECIMALS}
                              disabled={isSubmitting}
                              value={metal.metalSheetRateAed}
                              onNumericChange={n => onMetalField('sheetRateAed', n)}
                              title={`AED = INR × rate ÷ ${METAL_AED_RATE_DIVISOR.toLocaleString()}`}
                            />
                          </PurchaseField>
                          <PurchaseField label="Total (AED)">
                            <FormattedNumberInput
                              className={denseInput}
                              book="aed"
                              maxFractionDigits={METAL_AMOUNT_DECIMALS}
                              disabled={isSubmitting}
                              value={metal.aedTotal}
                              onNumericChange={n => onMetalField('totalAed', n)}
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
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_WEIGHT_DECIMALS}
                            disabled={isSubmitting}
                            value={lab.labWeightG}
                            onNumericChange={n => onLabField('weight', n)}
                          />
                        </PurchaseField>
                        <PurchaseField label="Charge (INR/g)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={isSubmitting}
                            value={lab.labChargeInrPerG}
                            onNumericChange={n => onLabField('charge', n)}
                          />
                        </PurchaseField>
                        <PurchaseField label="Total (INR)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={isSubmitting}
                            value={lab.labTotalInr}
                            onNumericChange={n => onLabField('total', n)}
                          />
                        </PurchaseField>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={leftTopGrid}>
                    <PurchaseField label="Unit rate (AED) *">
                      <FormattedNumberInput
                        className={denseInput}
                        book="aed"
                        maxFractionDigits={RATE_DECIMAL_PLACES}
                        disabled={isSubmitting}
                        value={rate}
                        onNumericChange={setRate}
                        placeholder="0"
                      />
                    </PurchaseField>
                    <PurchaseField label="Units *">
                      <FormattedNumberInput
                        className={denseInput}
                        book="aed"
                        maxFractionDigits={RATE_DECIMAL_PLACES}
                        disabled={isSubmitting}
                        value={units}
                        onNumericChange={setUnits}
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
            ledger={
              supplierId ? (
                <PartyLedgerStrip
                  counterpartyId={supplierId}
                  partyLabel={selectedSupplier?.name}
                  book={isMetal ? 'INR' : 'AED'}
                />
              ) : undefined
            }
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
    <ConfirmModal
      open={discardConfirmOpen}
      zIndexClass="z-[450]"
      title="Discard changes?"
      message="You have unsaved changes. Close without saving?"
      variant="warning"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onConfirm={confirmDiscardClose}
      onCancel={() => setDiscardConfirmOpen(false)}
    />
    </>
  );
}
