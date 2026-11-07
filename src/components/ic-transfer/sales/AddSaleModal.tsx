'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import {
  buildCounterpartySearchOptions,
  buildWarehouseSearchOptions,
} from '@/lib/icTransfer/entitySearchOptions';
import {
  filterCounterpartiesForSales,
  filterCounterpartiesForAgent,
  filterWarehousesForAssignableUser,
} from '@/lib/icTransfer/branchPortalScope';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { ICSale } from '@/types';
import TransactionTypeSelector from '../shared/TransactionTypeSelector';
import SettlementModeToggle from '../shared/SettlementModeToggle';
import { emptyMetalFields } from '../shared/MetalSettlementFields';
import FormattedNumberInput from '../shared/FormattedNumberInput';
import MetalPaymentToggle from '../shared/MetalPaymentToggle';
import type { MetalPaymentMethod } from '@/lib/domain/books';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { SmoothCollapse, SmoothModeSwap } from '@/components/ui/SmoothHeight';
import {
  applyMetalFieldChange,
  computeImpliedMetalRateAedPerG,
  computeMetalAedFromInr,
  computeMetalSheetRateAed,
  metalSaleFieldsFromRecord,
  metalSheetRateFromIcUnitRate,
  METAL_AMOUNT_DECIMALS,
  METAL_WEIGHT_DECIMALS,
  type ICSettlementMode,
} from '@/lib/icTransfer/metalSettlement';
import { remainingIcStockWac } from '@/lib/icTransfer/dealProfit';
import { computeWarehouseIcUnitsOnHand } from '@/lib/icTransfer/warehouseIcStock';
import {
  applyLabFieldChange,
  emptyLabFields,
  labFieldsFromRecord,
  netMetalInr,
  type LabTestFieldKey,
} from '@/lib/icTransfer/labTest';
import { formatMetalLotLabel } from '@/lib/icTransfer/metalInventory';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { effectiveSaleCounterpartyId } from '@/lib/counterparties/effectiveId';
import {
  computeICSaleAmounts,
  formatAmount,
  INR_PER_UNIT,
  RATE_DECIMAL_PLACES,
} from '@/lib/icTransfer/rateCalculations';
import { resolveGroupOrderRate } from '@/lib/icTransfer/ratePricing';
import {
  normalizeICSaleTransactionType,
  type ICSaleTransactionType,
} from '@/lib/icTransfer/transactionTypes';
import type { OrderPriority } from '@/types/warehouse';
import ImageDropZone from '@/components/ui/ImageDropZone';
import { uploadImageToCloudinary, deleteCloudinaryImageByToken } from '@/lib/cloudinary';
import { SALE_COUNTERPARTY_FIELD_LABEL } from '@/lib/counterparties/labels';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import {
  prefetchAvailableMetalLots,
  useAvailableMetalLots,
  invalidateAvailableMetalLotsCache,
} from '@/lib/icTransfer/useAvailableMetalLots';
import { invalidateICTransferModalSnapshotCache } from '@/lib/icTransfer/useICTransferModalSnapshots';
import ICTransferBreakdownPanel, {
  type ICTransferBreakdownItem,
} from '../shared/ICTransferBreakdownPanel';
import ICTransferFormField from '../shared/ICTransferFormField';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import {
  icSaleModalShell,
  icPurchaseFormModalBody,
  icFormSectionEyebrow,
  icPurchaseDenseInput,
} from '../shared/icTransferFormModalLayout';
import {
  stringifyIcSaleFormSnapshot,
  type ICSaleFormSnapshot,
} from '@/lib/icTransfer/icTransferModalFormSnapshots';
import { pauseTransactionalRefetchForModal } from '@/lib/icTransfer/transactionalRefetchPause';

function resolveInitialCounterpartyId(
  initialData: ICSale | undefined,
  counterparties: ReturnType<typeof filterCounterpartiesForSales>,
): string {
  if (!initialData) return '';
  const direct = effectiveSaleCounterpartyId(initialData);
  if (direct && counterparties.some(c => c.id === direct)) return direct;
  if (initialData.orderCustomerId && counterparties.some(c => c.id === initialData.orderCustomerId)) {
    return initialData.orderCustomerId;
  }
  const name = (initialData.orderCustomerName || initialData.customerName || '').trim().toLowerCase();
  if (!name) return direct;
  const byName = counterparties.find(c => c.name.trim().toLowerCase() === name);
  return byName?.id || direct;
}

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ICSale;
  /** When set, warehouse is prefilled and cannot be changed (e.g. warehouse detail page). */
  lockedWarehouseId?: string;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;

/** TEMP: hide address proof dropzone + upload/paste until UI is finalized. */
const SHOW_SALE_ADDRESS_PROOF = false;

const leftTopGrid = 'grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2';
const leftTopGridMetal = 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2';
const leftBottomGridMetal =
  'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 lg:items-start';
const metalAmountRows = 'flex flex-col gap-2';
const metalAmountPairRow = 'grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2';

function formatModalTimestamp(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LotSelectLoading() {
  return (
    <div className="relative" aria-busy="true" aria-label="Loading purchase lots">
      <input
        readOnly
        disabled
        value=""
        placeholder="Loading lots…"
        className={`${denseInput} w-full cursor-wait bg-slate-50/80 opacity-90 !pr-10`}
      />
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
  </div>
);
}

export default function AddSaleModal({ open, onClose, initialData, lockedWarehouseId }: Props) {
  const {
    icWarehouses,
    icSales,
    icPurchases,
    icSuppliers,
    addICSale,
    updateICSale,
    icRateGroups,
    user,
    currentSlug,
    branches,
  } = useApp();

  const [settlementMode, setSettlementMode] = useState<ICSettlementMode>('cash');
  const [metal, setMetal] = useState(emptyMetalFields());
  const [lab, setLab] = useState(emptyLabFields());
  const isMetal = settlementMode === 'metal';
  const lockMode = Boolean(initialData?.id);

  const [units, setUnits] = useState(initialData?.units ?? 0);
  const [rate, setRate] = useState(initialData?.unitRate ?? 0);
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [transactionType, setTransactionType] = useState<ICSaleTransactionType>(() =>
    normalizeICSaleTransactionType(initialData?.transactionType),
  );
  const [priority, setPriority] = useState<OrderPriority>(initialData?.priority || 'Normal');
  const [address, setAddress] = useState(initialData?.address || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [deleteToken, setDeleteToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [metalPurchaseId, setMetalPurchaseId] = useState(initialData?.metalPurchaseId || '');
  const [metalPayment, setMetalPayment] = useState<MetalPaymentMethod>('CASH');
  const [aedAgentId, setAedAgentId] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const formInitSeqRef = useRef(0);
  const baselineFormRef = useRef('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  /** Each modal open increments so the form resets even when initialData?.id is unchanged. */
  const [saleModalOpenSession, setSaleModalOpenSession] = useState(0);

  const branchId = useMemo(() => {
    if (user?.branchId) return user.branchId;
    if (currentSlug && currentSlug !== 'superadmin') {
      return branches.find(b => b.slug === currentSlug)?.id;
    }
    return undefined;
  }, [user?.branchId, currentSlug, branches]);

  const scopedCounterparties = useMemo(() => {
    if (branchId) return filterCounterpartiesForSales(icSuppliers, branchId);
    return filterCounterpartiesForSales(icSuppliers);
  }, [icSuppliers, branchId]);

  const agentOptions = useMemo(() => {
    if (branchId) return filterCounterpartiesForAgent(icSuppliers, branchId);
    return filterCounterpartiesForAgent(icSuppliers);
  }, [icSuppliers, branchId]);

  const { entityLedgerById, warehouseAvailableById, warehouseMetalGById, refresh, refreshing } =
    useICTransferModalSnapshots(open, { warehouseId });

  const { lots: metalLots, loading: metalLotsLoading } = useAvailableMetalLots(
    open,
    warehouseId,
    initialData?.id,
  );

  useEffect(() => {
    if (metalLotsLoading || !metalPurchaseId) return;
    if (initialData?.metalPurchaseId && initialData.metalPurchaseId === metalPurchaseId) return;
    if (!metalLots.some(l => l.id === metalPurchaseId)) {
      setMetalPurchaseId('');
    }
  }, [metalLots, metalPurchaseId, metalLotsLoading, initialData?.metalPurchaseId]);

  const allowedWarehouses = useMemo(
    () => filterWarehousesForAssignableUser(icWarehouses, user),
    [icWarehouses, user],
  );
  const counterpartySearchOptions = useMemo(
    () => buildCounterpartySearchOptions(scopedCounterparties, entityLedgerById),
    [scopedCounterparties, entityLedgerById],
  );
  const agentSearchOptions = useMemo(
    () => buildCounterpartySearchOptions(agentOptions, entityLedgerById),
    [agentOptions, entityLedgerById],
  );
  const warehouseSearchOptions = useMemo(
    () =>
      buildWarehouseSearchOptions(
        allowedWarehouses,
        icSales,
        warehouseAvailableById,
        warehouseMetalGById,
        icPurchases,
      ),
    [allowedWarehouses, icSales, icPurchases, warehouseAvailableById, warehouseMetalGById],
  );

  const selectedCounterparty = useMemo(
    () => scopedCounterparties.find(c => c.id === counterpartyId) ?? null,
    [scopedCounterparties, counterpartyId],
  );

  const selectedCounterpartyOption = useMemo(
    () => counterpartySearchOptions.find(o => o.value === counterpartyId) ?? null,
    [counterpartySearchOptions, counterpartyId],
  );

  const rateGroupCustomerId = counterpartyId || undefined;

  const customerRateGroup = useMemo(() => {
    if (!rateGroupCustomerId) return undefined;
    return icRateGroups.find(g => g.customerIds?.includes(rateGroupCustomerId));
  }, [icRateGroups, rateGroupCustomerId]);

  const lockedWarehouse = useMemo(() => {
    if (!lockedWarehouseId) return null;
    return (
      allowedWarehouses.find(w => w.id === lockedWarehouseId) ||
      icWarehouses.find(w => w.id === lockedWarehouseId) ||
      null
    );
  }, [lockedWarehouseId, allowedWarehouses, icWarehouses]);

  const warehouseAvailable =
    warehouseId
      ? (warehouseAvailableById[warehouseId] ??
        computeWarehouseIcUnitsOnHand(icPurchases, icSales, warehouseId))
      : null;
  const warehouseMetalG =
    warehouseId
      ? (warehouseMetalGById[warehouseId] ??
        allowedWarehouses.find(w => w.id === warehouseId)?.currentMetalG ??
        null)
      : null;

  const warehouseGramsTrailing =
    warehouseId && warehouseAvailable != null ? formatMetalGrams(warehouseMetalG ?? 0) : undefined;

  const warehouseControl =
    lockedWarehouseId ? (
      <div className="relative">
        <input
          className={`${denseInput} w-full cursor-not-allowed bg-slate-50 pr-[4.5rem] text-slate-700`}
          readOnly
          disabled
          value={lockedWarehouse?.name || 'Warehouse'}
          aria-readonly
        />
        {warehouseGramsTrailing ? (
          <span className="pointer-events-none absolute right-3 top-1/2 max-w-[45%] -translate-y-1/2 truncate text-right text-xs font-semibold tabular-nums text-slate-500">
            {warehouseGramsTrailing}
          </span>
        ) : null}
      </div>
    ) : warehouseSearchOptions.length === 0 ? (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
        No warehouses configured — add a warehouse before recording sales.
      </p>
    ) : (
      <EntitySearchSelect
        selectedId={warehouseId}
        onSelectId={id => {
          setWarehouseId(id);
          prefetchAvailableMetalLots(id, initialData?.id);
        }}
        options={warehouseSearchOptions}
        placeholder="Search by code or name…"
        inputClassName={denseInput}
        onFocusRefresh={() => void refresh()}
        showDetailLine={false}
        inputTrailing={warehouseGramsTrailing}
      />
    );

  const metalLotOptions = useMemo(() => {
    const opts = metalLots.map(lot => ({
      value: lot.id,
      label: lot.label,
      detail: `${lot.remainingG.toLocaleString()} g remaining · INR ${lot.inrTotal.toLocaleString()} · AED ${lot.aedTotal.toLocaleString()}`,
    }));
    const linkedId = initialData?.metalPurchaseId?.trim();
    if (linkedId && !opts.some(o => o.value === linkedId)) {
      opts.unshift({
        value: linkedId,
        label: formatMetalLotLabel({
          metalWeightG: initialData?.metalWeightG,
          inrTotal: initialData?.inrTotal,
          aedTotal: (initialData?.aedAmount ?? 0) + (initialData?.serviceCharge ?? 0),
          createdAt: initialData?.createdAt,
        }),
        detail: 'Linked to this sale',
      });
    }
    return opts;
  }, [metalLots, initialData]);

  const purchaseLotControl = !warehouseId ? (
    <EntitySearchSelect
      selectedId=""
      onSelectId={() => {}}
      options={[]}
      placeholder="Select warehouse first…"
      inputClassName={denseInput}
      disabled
      showDetailLine={false}
    />
  ) : metalLotsLoading && metalLotOptions.length === 0 ? (
    <LotSelectLoading />
  ) : metalLotOptions.length === 0 ? (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
      No open metal purchases in this warehouse.
    </p>
  ) : (
    <EntitySearchSelect
      selectedId={metalPurchaseId}
      onSelectId={id => {
        setMetalPurchaseId(id);
        const lot = metalLots.find(l => l.id === id);
        if (lot) {
          setMetal(prev =>
            metalSaleFieldsFromRecord({
              metalWeightG: lot.remainingG,
              metalRateInrPerG: lot.metalRateInrPerG,
              inrTotal: lot.remainingG * (lot.metalRateInrPerG || 0),
              aedTotal: prev.aedTotal,
              unitRate: prev.metalSheetRateAed,
            }),
          );
        }
      }}
      options={metalLotOptions}
      placeholder="Select purchased metal…"
      inputClassName={denseInput}
      showDetailLine={false}
    />
  );

  const unitNum = units;
  const groupOrderRate = useMemo(() => {
    if (!customerRateGroup) return null;
    return resolveGroupOrderRate(customerRateGroup, transactionType, unitNum);
  }, [customerRateGroup, transactionType, unitNum]);

  /** Prefill cash rate from rate group when party/txn/units change — not when icRateGroups array refetches. */
  useEffect(() => {
    if (!open || isMetal || !customerRateGroup || initialData?.id) return;
    const resolved = resolveGroupOrderRate(customerRateGroup, transactionType, unitNum);
    if (resolved.saleRate > 0) {
      setRate(resolved.saleRate);
    }
  }, [
    open,
    isMetal,
    counterpartyId,
    transactionType,
    unitNum,
    customerRateGroup?.id,
    initialData?.id,
    customerRateGroup,
  ]);

  const captureSaleFormSnapshot = useCallback((): ICSaleFormSnapshot => {
    return {
      kind: 'sale',
      settlementMode,
      units,
      rate,
      customerName,
      counterpartyId,
      warehouseId,
      metalPurchaseId,
      metalPayment,
      aedAgentId,
      transactionType,
      priority,
      address,
      imageUrl,
      deleteToken,
      metal,
      lab,
    };
  }, [
    settlementMode,
    units,
    rate,
    customerName,
    counterpartyId,
    warehouseId,
    metalPurchaseId,
    metalPayment,
    aedAgentId,
    transactionType,
    priority,
    address,
    imageUrl,
    deleteToken,
    metal,
    lab,
  ]);

  const formStateRef = useRef(captureSaleFormSnapshot());
  formStateRef.current = captureSaleFormSnapshot();

  const isFormDirty = useCallback(
    () => stringifyIcSaleFormSnapshot(captureSaleFormSnapshot()) !== baselineFormRef.current,
    [captureSaleFormSnapshot],
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
    setSaleModalOpenSession(s => s + 1);
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

    const saleMetal = metalSaleFieldsFromRecord({
      metalWeightG: initialData?.metalWeightG,
      metalRateInrPerG: initialData?.metalRateInrPerG,
      metalRateAedPerG: initialData?.metalRateAedPerG,
      inrTotal: initialData?.inrTotal,
      aedTotal: (initialData?.aedAmount ?? 0) + (initialData?.serviceCharge ?? 0),
      unitRate: initialData?.unitRate,
    });

    const resolvedWarehouseId = lockedWarehouseId || initialData?.warehouseId || '';
    const resolvedCp = resolveInitialCounterpartyId(initialData, scopedCounterparties);

    if (!initialData?.id && saleMetal.metalSheetRateAed <= 0) {
      const wh = lockedWarehouseId || initialData?.warehouseId;
      if (wh) {
        const wac = remainingIcStockWac(icPurchases, icSales, wh);
        if (wac.rate > 0) {
          setMetal(
            applyMetalFieldChange(saleMetal, 'sheetRateAed', metalSheetRateFromIcUnitRate(wac.rate)),
          );
        } else {
          setMetal(saleMetal);
        }
      } else {
        setMetal(saleMetal);
      }
    } else {
      setMetal(saleMetal);
    }

    setUnits(initialData?.units ?? 0);
    setRate(initialData?.unitRate ?? 0);
    setCustomerName(initialData?.orderCustomerName || initialData?.customerName || '');
    setCounterpartyId(resolvedCp);
    setWarehouseId(resolvedWarehouseId);
    setMetalPurchaseId(initialData?.metalPurchaseId || '');
    const whForLots = lockedWarehouseId || initialData?.warehouseId;
    if (mode === 'metal' && whForLots) {
      prefetchAvailableMetalLots(whForLots, initialData?.id);
    }
    setMetalPayment(normalizeMetalPaymentMethod(initialData?.metalPaymentMethod ?? 'CASH'));
    setAedAgentId(initialData?.aedAgentCounterpartyId || initialData?.aedAgentId || '');
    const nextLab = labFieldsFromRecord({
      labWeightG: initialData?.labWeightG,
      labChargeInrPerG: initialData?.labChargeInrPerG,
      labTotalInr: initialData?.labTotalInr,
    });
    setLab(nextLab);
    setTransactionType(normalizeICSaleTransactionType(initialData?.transactionType));
    setPriority(initialData?.priority || 'Normal');
    setAddress(initialData?.address || '');
    setImageUrl(initialData?.imageUrl || '');
    setDeleteToken('');
  }, [
    open,
    saleModalOpenSession,
    initialData?.id,
    lockedWarehouseId,
    scopedCounterparties,
    icPurchases,
    icSales,
  ]);

  useEffect(() => {
    if (!open) return;
    if (lockedWarehouseId || initialData?.warehouseId) return;
    if (allowedWarehouses.length !== 1) return;
    setWarehouseId(allowedWarehouses[0]!.id);
  }, [open, allowedWarehouses, lockedWarehouseId, initialData?.warehouseId]);

  useEffect(() => {
    if (!open) return;
    const seq = formInitSeqRef.current;
    const t = window.setTimeout(() => {
      if (formInitSeqRef.current !== seq) return;
      baselineFormRef.current = stringifyIcSaleFormSnapshot(formStateRef.current);
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, saleModalOpenSession, initialData?.id]);

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const { secureUrl, deleteToken: token } = await uploadImageToCloudinary(file);
      setImageUrl(secureUrl);
      setDeleteToken(token || '');
    } catch (err) {
      console.error(err);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    if (deleteToken) {
      try {
        await deleteCloudinaryImageByToken(deleteToken);
      } catch (err) {
        console.error('Failed to delete image from Cloudinary:', err);
      }
    }
    setImageUrl('');
    setDeleteToken('');
  };

  const rateNum = rate;
  const serviceChargeNum = initialData?.serviceCharge ?? 0;

  const ratesMatchGroup =
    Boolean(customerRateGroup && groupOrderRate && groupOrderRate.saleRate > 0) &&
    Math.abs(rateNum - groupOrderRate!.saleRate) < 0.005;

  const showRateGroupLabel = Boolean(rateGroupCustomerId && customerRateGroup && ratesMatchGroup);

  const amounts = computeICSaleAmounts(unitNum, rateNum, serviceChargeNum);


  const metalAed = metalPayment === 'AED';
  const metalNetInr = netMetalInr(metal.inrTotal, lab.labTotalInr);

  const metalAedTotal = useMemo(() => {
    if (!isMetal) return metal.aedTotal;
    const sheet = metal.metalSheetRateAed;
    if (!sheet || sheet <= 0) return metal.aedTotal;
    return computeMetalAedFromInr(metalNetInr, sheet);
  }, [isMetal, metal.aedTotal, metal.metalSheetRateAed, metalNetInr]);

  useEffect(() => {
    if (!isMetal || settlementMode !== 'metal') return;
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

  const canSubmit = isMetal
    ? Boolean(
        counterpartyId &&
          warehouseId.trim().length > 0 &&
          metalPurchaseId &&
          metal.metalWeightG > 0 &&
          metal.metalRateInrPerG > 0 &&
          metal.inrTotal > 0 &&
          metal.metalSheetRateAed > 0 &&
          metalAedTotal > 0 &&
          (!metalAed || aedAgentId.trim().length > 0),
      )
    : unitNum > 0 &&
    rateNum > 0 &&
      counterpartyId &&
      warehouseId.trim().length > 0;

  const kpiMetalG = isMetal ? metal.metalWeightG : 0;
  const kpiInr = isMetal ? metalNetInr : amounts.inrTotal;
  const kpiAed = isMetal ? metalAedTotal : amounts.aedNetTotal;

  const breakdownItems = useMemo((): ICTransferBreakdownItem[] => {
    if (!isMetal) {
      return [
        { id: 'units', label: 'Units', value: formatAmount(unitNum, 4) },
        { id: 'rate', label: 'Rate (AED)', value: formatAmount(rateNum) },
        {
          id: 'txn',
          label: 'Transaction',
          value: transactionType.replace(/_/g, ' '),
        },
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

    const items: ICTransferBreakdownItem[] = [
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
        value: (
          <>
            − <FmtLedgerInr amount={lab.labTotalInr} />
          </>
        ),
        deduct: true,
      });
    }
    items.push({
      id: 'net',
      label: 'Net (INR)',
      value: <FmtLedgerInr amount={metalNetInr} />,
      strong: true,
    });
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
    return items;
  }, [
    isMetal,
    unitNum,
    rateNum,
    amounts.inrTotal,
    amounts.aedNetTotal,
    transactionType,
    metal,
    lab.labTotalInr,
    metalNetInr,
    metalAedTotal,
  ]);

  const stockContext =
    counterpartyId && warehouseId ? (
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
        {selectedCounterpartyOption?.detail ? (
          <>
            {' · '}
            <span className="text-slate-600">{selectedCounterpartyOption.detail}</span>
          </>
        ) : null}
      </>
    ) : null;

  const handleTransactionTypeChange = (value: ICSaleTransactionType) => {
    setTransactionType(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);

    const recordedCustomerName = selectedCounterparty?.name || customerName.trim();

    const payload = isMetal
      ? {
          customerName: recordedCustomerName,
          counterpartyId,
          orderCustomerName: recordedCustomerName,
          warehouseId,
          settlementMode: 'metal' as const,
          metalPurchaseId,
          metalPaymentMethod: metalPayment,
          aedAgentId: metalAed ? aedAgentId : null,
          unitRate: computeMetalSheetRateAed(metalNetInr, metalAedTotal),
          units: metalPayment === 'CASH' ? netMetalInr(metal.inrTotal, lab.labTotalInr) / INR_PER_UNIT : 0,
          metalWeightG: metal.metalWeightG,
          metalRateInrPerG: metal.metalRateInrPerG,
          metalRateAedPerG: computeImpliedMetalRateAedPerG(metal.metalWeightG, metalAedTotal),
          inrTotal: metal.inrTotal,
          aedAmount: metalAedTotal,
          labWeightG: lab.labWeightG || undefined,
          labChargeInrPerG: lab.labChargeInrPerG || undefined,
          labTotalInr: lab.labTotalInr || undefined,
          serviceCharge: 0,
          priority,
          address: address || undefined,
          imageUrl: imageUrl || undefined,
        }
      : {
      customerName: recordedCustomerName,
          counterpartyId,
          orderCustomerName: recordedCustomerName,
      warehouseId,
          settlementMode: 'cash' as const,
      transactionType,
      unitRate: rateNum,
      units: unitNum,
      aedAmount: amounts.aedNetTotal,
      serviceCharge: serviceChargeNum,
      priority,
      address: address || undefined,
      imageUrl: imageUrl || undefined,
    };

    if (initialData) {
      await updateICSale(initialData.id, payload);
    } else {
      await addICSale(payload);
    }

    invalidateICTransferModalSnapshotCache();
    invalidateAvailableMetalLotsCache();

    setIsSubmitting(false);
    onClose();
  };

  const modalTitle = initialData ? 'Edit Sale' : 'Register Sale';
  const formDisabled = isSubmitting || isUploading;

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
          disabled={formDisabled}
        />
      }
      headerTrailing={timestampBadge}
      maxWidth="max-w-6xl w-[96vw]"
      maxHeight={icSaleModalShell}
      heightClass="lg:h-[min(90vh,880px)]"
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:overflow-hidden`}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={requestClose} disabled={formDisabled}>
            Cancel
          </button>
          <button
            type="submit"
            form="ic-sale-form"
            className={btnPrimary}
            disabled={formDisabled || !canSubmit}
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Register Sale'}
          </button>
        </>
      }
    >
      <form
        id="ic-sale-form"
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
              <ICTransferFormField label={`${SALE_COUNTERPARTY_FIELD_LABEL} *`}>
                <EntitySearchSelect
                  selectedId={counterpartyId}
                  onSelectId={id => {
                    setCounterpartyId(id);
                    const cp = scopedCounterparties.find(c => c.id === id);
                    if (cp) setCustomerName(cp.name);
                    void refresh();
                  }}
                  options={counterpartySearchOptions}
                  placeholder="Search by code or name…"
                  inputClassName={denseInput}
                  onFocusRefresh={() => void refresh()}
                  showDetailLine={false}
                  disabled={formDisabled}
                />
              </ICTransferFormField>

              <ICTransferFormField label="Warehouse *">{warehouseControl}</ICTransferFormField>

              <ICTransferFormField label="Address / description" className="sm:col-span-2">
                {SHOW_SALE_ADDRESS_PROOF ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-stretch">
              <textarea
                      id="sale-address"
                      className={`${denseInput} h-[4.875rem] resize-none py-1.5 text-sm leading-snug`}
                      rows={3}
                value={address}
                onChange={e => setAddress(e.target.value)}
                      placeholder="Delivery address or description"
                      disabled={formDisabled}
                    />
                    <div className="flex h-[4.875rem] min-w-0 flex-col">
                      <ImageDropZone
                        compact
                        fillHeight
                        className="h-full min-h-0"
                        imageUrl={imageUrl}
                        onUpload={handleImageUpload}
                        onClear={handleDeleteImage}
                        isUploading={isUploading}
                        disabled={formDisabled}
                        emptyLabel="Drop or click for proof"
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    id="sale-address"
                    type="text"
                    className={`${denseInput} w-full`}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Delivery address or description"
                    disabled={formDisabled}
                  />
                )}
              </ICTransferFormField>

              <SmoothCollapse open={isMetal} className="sm:col-span-2">
                <div className={leftTopGridMetal}>
                  <ICTransferFormField label="Payment method" className="min-w-0 w-full">
                    <MetalPaymentToggle
                      value={metalPayment}
                      onChange={setMetalPayment}
                      disabled={formDisabled}
                      hideCaption
                      fullWidth
                    />
                  </ICTransferFormField>
                  <SmoothCollapse open={metalAed}>
                    <ICTransferFormField label="Collection agent (UAE) *">
                      <EntitySearchSelect
                        selectedId={aedAgentId}
                        onSelectId={id => setAedAgentId(id)}
                        options={agentSearchOptions}
                        placeholder="Search by code or name…"
                        inputClassName={denseInput}
                        showDetailLine={false}
                        disabled={formDisabled}
                        onFocusRefresh={() => void refresh()}
                      />
                    </ICTransferFormField>
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
                      <div className={metalAmountPairRow}>
                        <ICTransferFormField label="Purchase lot *">
                          {purchaseLotControl}
                        </ICTransferFormField>
                        <ICTransferFormField label="Weight (g) *">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_WEIGHT_DECIMALS}
                            readOnly
                            disabled
                            value={metal.metalWeightG}
                            onNumericChange={() => {}}
                            aria-readonly
                          />
                        </ICTransferFormField>
                      </div>
                      <div className={metalAmountPairRow}>
                        <ICTransferFormField label="G rate (INR) *">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={formDisabled}
                            value={metal.metalRateInrPerG}
                            onNumericChange={n => onMetalField('rateInr', n)}
                          />
                        </ICTransferFormField>
                        <ICTransferFormField label="Total (INR)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={formDisabled}
                            value={metal.inrTotal}
                            onNumericChange={n => onMetalField('totalInr', n)}
                          />
                        </ICTransferFormField>
                      </div>
                      <div className={metalAmountPairRow}>
                        <ICTransferFormField label="Rate (AED) *">
                          <FormattedNumberInput
                            className={denseInput}
                            book="aed"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={formDisabled}
                            value={metal.metalSheetRateAed}
                            onNumericChange={n => onMetalField('sheetRateAed', n)}
                            title="AED = INR × rate ÷ 1,000 (e.g. 6,995,940 × 36.35 ÷ 1,000 = 254,302.42)"
                          />
                        </ICTransferFormField>
                        <ICTransferFormField label="Total (AED) *">
                          <FormattedNumberInput
                            className={denseInput}
                            book="aed"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={formDisabled}
                            value={metal.aedTotal}
                            onNumericChange={n => onMetalField('totalAed', n)}
                          />
                        </ICTransferFormField>
                      </div>
          </div>

                    <div className="shrink-0 rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 lg:mt-auto">
                      <div className="mb-1.5">
                        <span className={icFormSectionEyebrow}>Lab test (INR)</span>
                      </div>
                      <div className={leftBottomGridMetal}>
                        <ICTransferFormField label="Weight (g)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_WEIGHT_DECIMALS}
                            disabled={formDisabled}
                            value={lab.labWeightG}
                            onNumericChange={n => onLabField('weight', n)}
                          />
                        </ICTransferFormField>
                        <ICTransferFormField label="Charge (INR/g)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={formDisabled}
                            value={lab.labChargeInrPerG}
                            onNumericChange={n => onLabField('charge', n)}
                          />
                        </ICTransferFormField>
                        <ICTransferFormField label="Total (INR)">
                          <FormattedNumberInput
                            className={denseInput}
                            book="inr"
                            maxFractionDigits={METAL_AMOUNT_DECIMALS}
                            disabled={formDisabled}
                            value={lab.labTotalInr}
                            onNumericChange={n => onLabField('total', n)}
                          />
                        </ICTransferFormField>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className={metalAmountPairRow}>
                      <ICTransferFormField label="Rate (AED) *">
                        <div className="flex items-stretch gap-2">
                          <FormattedNumberInput
                            className={`${denseInput} min-w-0 flex-1`}
                            book="aed"
                            maxFractionDigits={RATE_DECIMAL_PLACES}
                            disabled={formDisabled}
                            value={rate}
                            onNumericChange={setRate}
                            title="AED = rate × 100 × units (e.g. 50 × 36.2 × 100 = 181,000 AED)"
                            placeholder={
                              customerRateGroup
                                ? 'Filled from rate group when available'
                                : 'Enter rate'
                            }
                          />
                          {showRateGroupLabel && customerRateGroup ? (
                            <span
                              className="inline-flex max-w-[9rem] shrink-0 items-center self-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold leading-tight text-slate-600"
                              title={`Rate group: ${customerRateGroup.name}`}
                            >
                              <span className="line-clamp-2 text-center">{customerRateGroup.name}</span>
                            </span>
                          ) : null}
                        </div>
                      </ICTransferFormField>

                      <ICTransferFormField label="Units *">
                        <FormattedNumberInput
                          className={denseInput}
                          book="aed"
                          maxFractionDigits={RATE_DECIMAL_PLACES}
                          disabled={formDisabled}
                          value={units}
                          onNumericChange={setUnits}
                        />
                      </ICTransferFormField>
              </div>

                    <ICTransferFormField label="Transaction type">
                <TransactionTypeSelector
                  value={transactionType}
                  onChange={handleTransactionTypeChange}
                  disabled={isSubmitting}
                />
                    </ICTransferFormField>
              </div>
                )}
              </SmoothModeSwap>
            </div>
          </div>

          <ICTransferBreakdownPanel
            heading="Price breakdown"
            items={breakdownItems}
            metalG={kpiMetalG}
            inrAmount={kpiInr}
            aedAmount={kpiAed}
            swapKey={`${settlementMode}-${metalPayment}`}
            context={stockContext}
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
