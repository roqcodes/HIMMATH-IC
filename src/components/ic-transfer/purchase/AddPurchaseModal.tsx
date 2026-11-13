'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AsicFormField from '@/components/asic/AsicFormField';
import { SmoothCollapse, SmoothModeSwap } from '@/components/ui/SmoothHeight';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { asicInput } from '@/components/asic/ui';
import ICTransferModalFormFooter from '@/components/ic-transfer/shared/ICTransferModalFormFooter';
import { useApp } from '@/context/AppContext';
import { ICPurchase, ICWarehouse } from '@/types';
import SettlementModeToggle from '../shared/SettlementModeToggle';
import { emptyMetalFields } from '../shared/MetalSettlementFields';
import FormattedNumberInput from '../shared/FormattedNumberInput';
import MetalPaymentToggle from '../shared/MetalPaymentToggle';
import type { MetalPaymentMethod } from '@/lib/domain/books';
import {
  METAL_AED_AGENT_REQUIRED_MSG,
  metalAedAgentSatisfied,
  needsMetalAedAgent,
  normalizeMetalPaymentMethod,
} from '@/lib/domain/books';
import { complementSplitAed, defaultSplitAmounts } from '@/lib/icTransfer/metalSplit';
import {
  computeICSaleAmounts,
  formatAmount,
  RATE_DECIMAL_PLACES,
} from '@/lib/icTransfer/rateCalculations';
import {
  applyMetalFieldChange,
  computeImpliedMetalRateAedPerG,
  computeMetalAedFromInr,
  grossMetalAedFromNetBooked,
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
import ManagerCustomerFields from '@/components/ic-transfer/shared/ManagerCustomerFields';
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import { emptyLabFields, applyLabFieldChange, labFieldsFromRecord, netMetalInr } from '@/lib/icTransfer/labTest';
import PartyLedgerStrip from '../shared/PartyLedgerStrip';
import WarehouseOnHandStrip from '../shared/WarehouseOnHandStrip';
import { unitsToInrAmount } from '@/lib/domain/books';
import type { LabTestFieldKey } from '@/lib/icTransfer/labTest';
import {
  buildCashBreakdownModel,
  buildMetalBreakdownModel,
} from '@/lib/icTransfer/breakdownViewModel';
import ICTransferBreakdownPanel from '../shared/ICTransferBreakdownPanel';
import {
  icPurchaseModalShell,
  icPurchaseFormModalBody,
  icFormLeftPanelClass,
  icFormModalGridClass,
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

const leftTopGrid = 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2';
const leftTopGridMetal = 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2';
const leftBottomGrid = 'grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3';
const leftBottomGridMetal =
  'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 lg:items-start';
const metalAmountRows = 'flex flex-col gap-2';
const metalAmountPairRow = 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2';
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
    showToast,
  } = useApp();
  const [settlementMode, setSettlementMode] = useState<ICSettlementMode>('cash');
  const [metal, setMetal] = useState(emptyMetalFields());
  const [lab, setLab] = useState(emptyLabFields());
  const warehouseOptions = useMemo(() => {
    if (warehouses) return warehouses;
    if (branchId) return filterWarehousesForBranchPortal(icWarehouses, branchId);
    return filterWarehousesForAdminPortal(icWarehouses);
  }, [warehouses, icWarehouses, branchId]);
  const [managerId, setManagerId] = useState(initialData?.managerId || '');
  const supplierOptions = useMemo(() => {
    return branchId
      ? filterCounterpartiesForPurchase(icSuppliers, branchId, managerId || undefined)
      : filterCounterpartiesForPurchase(icSuppliers, undefined, managerId || undefined);
  }, [icSuppliers, branchId, managerId]);
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
  const [splitInrPaid, setSplitInrPaid] = useState(0);
  const [splitAedPaid, setSplitAedPaid] = useState(0);
  const [aedAgentId, setAedAgentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const formInitSeqRef = useRef(0);
  const baselineFormRef = useRef('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  /** Increments each time the modal opens so we reset form even when initialData?.id is unchanged (e.g. add twice). */
  const [purchaseModalOpenSession, setPurchaseModalOpenSession] = useState(0);

  const activeWarehouseIdForSnapshots = lockedWarehouseId || warehouseId;
  const { entityLedgerById, warehouseAvailableById, warehouseMetalGById, refresh, refreshing } =
    useICTransferModalSnapshots(open, { warehouseId: activeWarehouseIdForSnapshots });

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

  const activeWarehouseId = lockedWarehouseId || warehouseId;
  const scopedWarehouse = useMemo(() => {
    if (!activeWarehouseId) return null;
    return (
      icWarehouses.find(w => w.id === activeWarehouseId) ||
      warehouseOptions.find(w => w.id === activeWarehouseId) ||
      lockedWarehouse
    );
  }, [icWarehouses, warehouseOptions, lockedWarehouse, activeWarehouseId]);
  const allowedManagerIds = !activeWarehouseId
    ? null
    : scopedWarehouse?.managerIds?.length
      ? scopedWarehouse.managerIds
      : [];

  useEffect(() => {
    if (allowedManagerIds === null) {
      if (managerId) {
        setManagerId('');
        setSupplierId('');
      }
      return;
    }
    if (allowedManagerIds.length === 0) {
      if (managerId) {
        setManagerId('');
        setSupplierId('');
      }
      return;
    }
    if (managerId && !allowedManagerIds.includes(managerId)) {
      setManagerId('');
      setSupplierId('');
    }
  }, [activeWarehouseId, allowedManagerIds, managerId]);

  useEffect(() => {
    if (!open || !activeWarehouseId) return;
    if (allowedManagerIds?.length === 1 && !managerId) {
      setManagerId(allowedManagerIds[0]!);
    }
  }, [open, activeWarehouseId, allowedManagerIds, managerId]);

  const isMetal = settlementMode === 'metal';
  const lockMode = Boolean(initialData?.id);
  const metalAed = needsMetalAedAgent(metalPayment);
  const metalSplit = metalPayment === 'SPLIT';
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
      splitInrPaid,
      splitAedPaid,
    };
  }, [settlementMode, units, rate, supplierId, warehouseId, notes, metalPayment, aedAgentId, metal, lab, splitInrPaid, splitAedPaid]);

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
    setManagerId(initialData?.managerId || '');
    setSupplierId(initialData?.counterpartyId || initialData?.supplierId || '');
    setWarehouseId(resolvedWarehouseId);
    setNotes(initialData?.notes || '');
    const nextMetal = metalFieldsFromRecord({
      metalWeightG: initialData?.metalWeightG,
      metalRateInrPerG: initialData?.metalRateInrPerG,
      metalRateAedPerG: initialData?.metalRateAedPerG,
      inrTotal: initialData?.inrTotal,
      aedTotal: initialData?.aedTotal,
      unitRate: initialData?.unitRate,
      labTotalInr: initialData?.labTotalInr,
    });
    setMetal(nextMetal);
    const nextMetalPayment = normalizeMetalPaymentMethod(initialData?.metalPaymentMethod ?? 'CASH');
    setMetalPayment(nextMetalPayment);
    setSplitInrPaid(Number(initialData?.splitInrPaid) || 0);
    setSplitAedPaid(Number(initialData?.splitAedPaid) || 0);
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
    if (!metalSplit) return;
    setSplitAedPaid(complementSplitAed(splitInrPaid, metal.inrTotal, metalAedTotal));
  }, [metalSplit, metal.inrTotal, metalAedTotal]);

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

  const onMetalField = useCallback(
    (field: 'weight' | 'rateInr' | 'sheetRateAed' | 'totalInr' | 'totalAed', n: number) => {
      setMetal(prev => applyMetalFieldChange(prev, field, n));
    },
    [],
  );

  const onLabField = useCallback((field: LabTestFieldKey, n: number) => {
    setLab(prev => applyLabFieldChange(prev, field, n));
  }, []);

  const metalAgentOk = metalAedAgentSatisfied(metalPayment, aedAgentId);
  const agentFieldInvalid = isMetal && metalAed && !metalAgentOk;

  const canSubmitCash = unitNum > 0 && rateNum > 0 && managerId && supplierId && warehouseId;
  const canSubmitMetal =
    managerId &&
    supplierId &&
    warehouseId &&
    metal.metalWeightG > 0 &&
    metal.metalRateInrPerG > 0 &&
    metal.inrTotal > 0 &&
    metalAgentOk &&
    (!metalAed ||
      (metal.metalSheetRateAed > 0 && metal.metalRateAedPerG > 0 && metalAedTotal > 0)) &&
    (!metalSplit || (splitInrPaid > 0 && splitAedPaid > 0));
  const canSubmit = isMetal ? canSubmitMetal : canSubmitCash;

  const priceBreakdown = useMemo(() => {
    if (!isMetal) {
      return buildCashBreakdownModel({
        unitNum,
        rateNum,
        inrTotal: amounts.inrTotal,
        aedTotal: amounts.aedNetTotal,
      });
    }
    return buildMetalBreakdownModel({
      metalWeightG: metal.metalWeightG,
      metalRateInrPerG: metal.metalRateInrPerG,
      metalInrTotal: metal.inrTotal,
      labTotalInr: lab.labTotalInr,
      metalNetInr,
      metalAedTotal,
      sheetRateAed: metal.metalSheetRateAed,
      showAedColumn: metalAed,
      splitInrPaid: metalSplit ? splitInrPaid : null,
      splitAedPaid: metalSplit ? splitAedPaid : null,
    });
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
    metalSplit,
    splitInrPaid,
    splitAedPaid,
  ]);

  const stockContext =
    supplierId && warehouseId ? (
      <>
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
    if (isSubmitting) return;
    if (isMetal && !metalAedAgentSatisfied(metalPayment, aedAgentId)) {
      showToast(METAL_AED_AGENT_REQUIRED_MSG, 'error');
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);

    const locationId = warehouseId
      ? warehouseOptions.find(w => w.id === warehouseId)?.regionId || undefined
      : undefined;

    const payload: Omit<ICPurchase, 'id' | 'createdAt'> = isMetal
      ? {
          counterpartyId: supplierId,
          managerId,
          warehouseId: warehouseId || undefined,
          locationId,
          settlementMode: 'metal',
          metalPaymentMethod: metalPayment,
          aedAgentId: metalAed ? aedAgentId : null,
          splitInrPaid: metalSplit ? splitInrPaid : null,
          splitAedPaid: metalSplit ? splitAedPaid : null,
          unitRate: metalAed ? metal.metalSheetRateAed : 0,
          units: 0,
          metalWeightG: metal.metalWeightG,
          metalRateInrPerG: metal.metalRateInrPerG,
          metalRateAedPerG: metalAed
            ? computeImpliedMetalRateAedPerG(metal.metalWeightG, metalAedTotal)
            : 0,
          inrTotal: metal.inrTotal,
          aedTotal: metalAed
            ? grossMetalAedFromNetBooked(metalAedTotal, metal.inrTotal, lab.labTotalInr)
            : undefined,
          labWeightG: lab.labWeightG || undefined,
          labChargeInrPerG: lab.labChargeInrPerG || undefined,
          labTotalInr: lab.labTotalInr || undefined,
          notes,
        }
      : {
          counterpartyId: supplierId,
          managerId,
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
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:!overflow-hidden`}
      footerClassName="flex shrink-0 border-t border-slate-200 bg-white p-2 sm:p-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
      footer={
        <ICTransferModalFormFooter
          onCancel={requestClose}
          cancelDisabled={isSubmitting}
          submitFormId="ic-purchase-form"
          submitLabel={isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Add Purchase'}
          submitDisabled={isSubmitting || !canSubmit}
          notes={notes}
          onNotesChange={setNotes}
          notesDisabled={isSubmitting}
          notesId="purchase-notes"
          notesPlaceholder="Internal remark…"
        />
      }
    >
      <form
        id="ic-purchase-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
      >
        <div className={icFormModalGridClass}>
          <div className={`${icFormLeftPanelClass} ${isMetal ? 'gap-2.5' : 'gap-1.5'}`}>
            <div className={isMetal ? leftTopGridMetal : leftTopGrid}>
              <PurchaseField label="Warehouse *" className="sm:col-span-2">
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

              <ManagerCustomerFields
                branchId={branchId}
                mode="purchase"
                managerId={managerId}
                customerId={supplierId}
                allowedManagerIds={allowedManagerIds}
                onManagerChange={id => {
                  setManagerId(id);
                  setSupplierId('');
                }}
                onCustomerChange={setSupplierId}
                entityLedgerById={entityLedgerById}
                disabled={isSubmitting || !activeWarehouseId}
              />

              <SmoothCollapse open={isMetal} className="sm:col-span-2">
                <div className={leftTopGridMetal}>
                  <PurchaseField label="Payment method" className="min-w-0 w-full">
                    <MetalPaymentToggle
                      value={metalPayment}
                      onChange={next => {
                        setMetalPayment(next);
                        if (!needsMetalAedAgent(next)) {
                          setAedAgentId('');
                        }
                        if (next === 'SPLIT') {
                          const seeded = defaultSplitAmounts(metal.inrTotal, metal.aedTotal);
                          setSplitInrPaid(seeded.paidInr);
                          setSplitAedPaid(seeded.paidAed);
                        }
                      }}
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
                        inputClassName={
                          agentFieldInvalid
                            ? `${denseInput} border-red-300 ring-1 ring-red-200 focus-visible:border-red-400 focus-visible:ring-red-200`
                            : denseInput
                        }
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
              className={`border-t border-slate-200 ${isMetal ? 'flex flex-col pt-2.5' : 'pt-1.5'}`}
            >
              <SmoothModeSwap mode={settlementMode}>
                {isMetal ? (
                  <div className="flex flex-col gap-3">
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
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5">
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

          <ICTransferBreakdownPanel
            heading="Price breakdown"
            ledger={
              warehouseId || supplierId ? (
                <div className="flex flex-col gap-2">
                  {warehouseId ? (
                    <WarehouseOnHandStrip
                      inrAmount={unitsToInrAmount(warehouseAvailable ?? 0)}
                      metalG={warehouseMetalG ?? 0}
                      refreshing={refreshing}
                    />
                  ) : null}
                  {supplierId ? (
                    <PartyLedgerStrip
                      counterpartyId={supplierId}
                      partyLabel={selectedSupplier?.name}
                      book={isMetal ? 'INR' : 'AED'}
                      balances={entityLedgerById[supplierId]}
                    />
                  ) : null}
                </div>
              ) : undefined
            }
            breakdown={priceBreakdown}
            context={stockContext}
            swapKey={`${settlementMode}-${metalPayment}`}
            splitPaidEdit={
              metalSplit && metalAed
                ? {
                    paidInr: splitInrPaid,
                    paidAed: splitAedPaid,
                    totalInr: metal.inrTotal,
                    totalAed: metalAedTotal,
                    onChange: ({ paidInr, paidAed }) => {
                      setSplitInrPaid(paidInr);
                      setSplitAedPaid(paidAed);
                    },
                    disabled: isSubmitting,
                  }
                : undefined
            }
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
