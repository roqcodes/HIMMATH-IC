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
import ICTransferModalFormFooter from '@/components/ic-transfer/shared/ICTransferModalFormFooter';
import { useApp } from '@/context/AppContext';
import { ICSale, type ICWarehouse } from '@/types';
import TransactionTypeSelector from '../shared/TransactionTypeSelector';
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
import { metalSaleFieldsFromMetalLotSelection } from '@/lib/icTransfer/metalLotCost';
import { SmoothCollapse, SmoothModeSwap } from '@/components/ui/SmoothHeight';
import {
  applyMetalFieldChange,
  computeImpliedMetalRateAedPerG,
  computeMetalAedFromInr,
  grossMetalAedFromNetBooked,
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
  labFieldsFromMetalLotSelection,
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
import ManagerCustomerFields from '@/components/ic-transfer/shared/ManagerCustomerFields';
import { useICTransferModalSnapshots } from '@/lib/icTransfer/useICTransferModalSnapshots';
import {
  prefetchAvailableMetalLots,
  useAvailableMetalLots,
  invalidateAvailableMetalLotsCache,
} from '@/lib/icTransfer/useAvailableMetalLots';
import { invalidateICTransferModalSnapshotCache } from '@/lib/icTransfer/useICTransferModalSnapshots';
import ICTransferBreakdownPanel from '../shared/ICTransferBreakdownPanel';
import {
  buildCashBreakdownModel,
  buildMetalBreakdownModel,
} from '@/lib/icTransfer/breakdownViewModel';
import PartyLedgerStrip from '../shared/PartyLedgerStrip';
import WarehouseOnHandStrip from '../shared/WarehouseOnHandStrip';
import { unitsToInrAmount } from '@/lib/domain/books';
import ICTransferFormField from '../shared/ICTransferFormField';
import {
  icSaleModalShell,
  icPurchaseFormModalBody,
  icFormLeftPanelClass,
  icFormModalGridClass,
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
  /** Branch portal scope for managers/customers (warehouse detail passes admin `undefined`). */
  branchId?: string;
  warehouses?: ICWarehouse[];
  /** When set, warehouse is prefilled and cannot be changed (e.g. warehouse detail page). */
  lockedWarehouseId?: string;
};

const denseInput = `${asicInput} ${icPurchaseDenseInput}`;

/** TEMP: hide address proof dropzone + upload/paste until UI is finalized. */
const SHOW_SALE_ADDRESS_PROOF = false;

const leftTopGrid = 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2';
const leftTopGridMetal = 'grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2';
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

export default function AddSaleModal({
  open,
  onClose,
  initialData,
  branchId: branchIdProp,
  warehouses,
  lockedWarehouseId,
}: Props) {
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
    showToast,
  } = useApp();

  const [settlementMode, setSettlementMode] = useState<ICSettlementMode>('cash');
  const [metal, setMetal] = useState(emptyMetalFields());
  const [lab, setLab] = useState(emptyLabFields());
  const isMetal = settlementMode === 'metal';
  const lockMode = Boolean(initialData?.id);

  const [units, setUnits] = useState(initialData?.units ?? 0);
  const [rate, setRate] = useState(initialData?.unitRate ?? 0);
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [managerId, setManagerId] = useState('');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const activeWarehouseId = lockedWarehouseId || warehouseId;
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
  const [splitInrPaid, setSplitInrPaid] = useState(0);
  const [splitAedPaid, setSplitAedPaid] = useState(0);
  const [aedAgentId, setAedAgentId] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const formInitSeqRef = useRef(0);
  const baselineFormRef = useRef('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  /** Each modal open increments so the form resets even when initialData?.id is unchanged. */
  const [saleModalOpenSession, setSaleModalOpenSession] = useState(0);

  const routeBranchId = useMemo(() => {
    if (user?.branchId) return user.branchId;
    if (currentSlug && currentSlug !== 'superadmin') {
      return branches.find(b => b.slug === currentSlug)?.id;
    }
    return undefined;
  }, [user?.branchId, currentSlug, branches]);

  const branchId = lockedWarehouseId ? branchIdProp : (branchIdProp ?? routeBranchId);

  const scopedCounterparties = useMemo(() => {
    const scoped = branchId
      ? filterCounterpartiesForSales(icSuppliers, branchId, managerId || undefined)
      : filterCounterpartiesForSales(icSuppliers, undefined, managerId || undefined);
    return scoped;
  }, [icSuppliers, branchId, managerId]);

  const agentOptions = useMemo(() => {
    if (branchId) return filterCounterpartiesForAgent(icSuppliers, branchId);
    return filterCounterpartiesForAgent(icSuppliers);
  }, [icSuppliers, branchId]);

  const { entityLedgerById, warehouseAvailableById, warehouseMetalGById, refresh, refreshing } =
    useICTransferModalSnapshots(open, { warehouseId: activeWarehouseId });

  const { lots: metalLots, loading: metalLotsLoading } = useAvailableMetalLots(
    open,
    activeWarehouseId,
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
  const warehouseOptions = useMemo(() => {
    if (warehouses?.length) return warehouses;
    return allowedWarehouses;
  }, [warehouses, allowedWarehouses]);
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

  const rateGroupCustomerId = counterpartyId || undefined;

  const customerRateGroup = useMemo(() => {
    if (!rateGroupCustomerId) return undefined;
    return icRateGroups.find(g => g.customerIds?.includes(rateGroupCustomerId));
  }, [icRateGroups, rateGroupCustomerId]);

  const lockedWarehouse = useMemo(() => {
    if (!lockedWarehouseId) return null;
    return (
      warehouseOptions.find(w => w.id === lockedWarehouseId) ||
      icWarehouses.find(w => w.id === lockedWarehouseId) ||
      null
    );
  }, [lockedWarehouseId, warehouseOptions, icWarehouses]);

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
        setCounterpartyId('');
        setCustomerName('');
      }
      return;
    }
    if (allowedManagerIds.length === 0) {
      if (managerId) {
        setManagerId('');
        setCounterpartyId('');
        setCustomerName('');
      }
      return;
    }
    if (managerId && !allowedManagerIds.includes(managerId)) {
      setManagerId('');
      setCounterpartyId('');
      setCustomerName('');
    }
  }, [activeWarehouseId, allowedManagerIds, managerId]);

  useEffect(() => {
    if (!open || !activeWarehouseId) return;
    if (allowedManagerIds?.length === 1 && !managerId) {
      setManagerId(allowedManagerIds[0]!);
    }
  }, [open, activeWarehouseId, allowedManagerIds, managerId]);

  const warehouseAvailable =
    warehouseId
      ? (warehouseAvailableById[warehouseId] ??
        computeWarehouseIcUnitsOnHand(
          icPurchases,
          icSales,
          warehouseId,
          allowedWarehouses.find(w => w.id === warehouseId)?.openingStock ??
            icWarehouses.find(w => w.id === warehouseId)?.openingStock ??
            0,
        ))
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
          const sellG = lot.remainingG;
          setMetal(metalSaleFieldsFromMetalLotSelection(lot, sellG));
          setLab(labFieldsFromMetalLotSelection(lot, sellG));
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
      splitInrPaid,
      splitAedPaid,
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
    splitInrPaid,
    splitAedPaid,
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

  // Reset form only when the modal opens (or edit target changes), not when manager/customer scope changes.
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
      labTotalInr: initialData?.labTotalInr,
    });

    const resolvedWarehouseId = lockedWarehouseId || initialData?.warehouseId || '';
    const initManagerId = initialData?.managerId || '';
    const initCounterparties = branchId
      ? filterCounterpartiesForSales(icSuppliers, branchId, initManagerId || undefined)
      : filterCounterpartiesForSales(icSuppliers, undefined, initManagerId || undefined);
    const resolvedCp = resolveInitialCounterpartyId(initialData, initCounterparties);

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
    setManagerId(initManagerId);
    setCounterpartyId(resolvedCp);
    setWarehouseId(resolvedWarehouseId);
    setMetalPurchaseId(initialData?.metalPurchaseId || '');
    const whForLots = lockedWarehouseId || initialData?.warehouseId;
    if (mode === 'metal' && whForLots) {
      prefetchAvailableMetalLots(whForLots, initialData?.id);
    }
    setMetalPayment(normalizeMetalPaymentMethod(initialData?.metalPaymentMethod ?? 'CASH'));
    setSplitInrPaid(Number(initialData?.splitInrPaid) || 0);
    setSplitAedPaid(Number(initialData?.splitAedPaid) || 0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only reset; matches AddPurchaseModal
  }, [open, saleModalOpenSession, initialData?.id, lockedWarehouseId]);

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


  const metalAed = needsMetalAedAgent(metalPayment);
  const metalSplit = metalPayment === 'SPLIT';
  const metalNetInr = netMetalInr(metal.inrTotal, lab.labTotalInr);

  const metalAedTotal = useMemo(() => {
    if (!isMetal) return metal.aedTotal;
    const sheet = metal.metalSheetRateAed;
    if (!sheet || sheet <= 0) return metal.aedTotal;
    return computeMetalAedFromInr(metalNetInr, sheet);
  }, [isMetal, metal.aedTotal, metal.metalSheetRateAed, metalNetInr]);

  useEffect(() => {
    if (!metalSplit) return;
    setSplitAedPaid(complementSplitAed(splitInrPaid, metal.inrTotal, metalAedTotal));
  }, [metalSplit, metal.inrTotal, metalAedTotal]);

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

  const metalAgentOk = metalAedAgentSatisfied(metalPayment, aedAgentId);
  const agentFieldInvalid = isMetal && metalAed && !metalAgentOk;

  const warehouseReady = Boolean(activeWarehouseId?.trim());
  const canSubmit = isMetal
    ? Boolean(
        managerId &&
          counterpartyId &&
          warehouseReady &&
          metalPurchaseId &&
          metal.metalWeightG > 0 &&
          metal.metalRateInrPerG > 0 &&
          metal.inrTotal > 0 &&
          metal.metalSheetRateAed > 0 &&
          metalAedTotal > 0 &&
          metalAgentOk &&
          (!metalSplit || (splitInrPaid > 0 && splitAedPaid > 0)),
      )
    : unitNum > 0 &&
    rateNum > 0 &&
      managerId &&
      counterpartyId &&
      warehouseReady;

  const priceBreakdown = useMemo(() => {
    if (!isMetal) {
      return buildCashBreakdownModel({
        unitNum,
        rateNum,
        inrTotal: amounts.inrTotal,
        aedTotal: amounts.aedNetTotal,
        transactionTypeLabel: transactionType,
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
    transactionType,
    metal,
    lab.labTotalInr,
    metalNetInr,
    metalAed,
    metalAedTotal,
    metalSplit,
    splitInrPaid,
    splitAedPaid,
  ]);

  const handleTransactionTypeChange = (value: ICSaleTransactionType) => {
    setTransactionType(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isMetal && !metalAedAgentSatisfied(metalPayment, aedAgentId)) {
      showToast(METAL_AED_AGENT_REQUIRED_MSG, 'error');
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);

    const recordedCustomerName = selectedCounterparty?.name || customerName.trim();

    const payload = isMetal
      ? {
      customerName: recordedCustomerName,
          counterpartyId,
          managerId,
          orderCustomerName: recordedCustomerName,
      warehouseId,
          settlementMode: 'metal' as const,
          metalPurchaseId,
          metalPaymentMethod: metalPayment,
          aedAgentId: metalAed ? aedAgentId : null,
          splitInrPaid: metalSplit ? splitInrPaid : null,
          splitAedPaid: metalSplit ? splitAedPaid : null,
          unitRate: metal.metalSheetRateAed || computeMetalSheetRateAed(metalNetInr, metalAedTotal),
          units: metalPayment === 'CASH' ? netMetalInr(metal.inrTotal, lab.labTotalInr) / INR_PER_UNIT : 0,
          metalWeightG: metal.metalWeightG,
          metalRateInrPerG: metal.metalRateInrPerG,
          metalRateAedPerG: computeImpliedMetalRateAedPerG(metal.metalWeightG, metalAedTotal),
          inrTotal: metal.inrTotal,
          aedAmount: grossMetalAedFromNetBooked(metalAedTotal, metal.inrTotal, lab.labTotalInr),
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
          managerId,
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

    const ok = initialData
      ? await updateICSale(initialData.id, payload)
      : await addICSale(payload);

    setIsSubmitting(false);
    if (!ok) return;

    invalidateICTransferModalSnapshotCache();
    invalidateAvailableMetalLotsCache();
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
      bodyClassName={`${icPurchaseFormModalBody} !px-5 !py-2 lg:!overflow-hidden`}
      footerClassName="flex shrink-0 border-t border-slate-200 bg-white p-2 sm:p-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
      footer={
        <ICTransferModalFormFooter
          onCancel={requestClose}
          cancelDisabled={formDisabled}
          submitFormId="ic-sale-form"
          submitLabel={isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Register Sale'}
          submitDisabled={formDisabled || !canSubmit}
        />
      }
    >
      <form
        id="ic-sale-form"
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-1 flex-col lg:min-h-0"
      >
        <div className={icFormModalGridClass}>
          <div className={`${icFormLeftPanelClass} ${isMetal ? 'gap-2.5' : 'gap-1.5'}`}>
            <div className={isMetal ? leftTopGridMetal : leftTopGrid}>
              <ICTransferFormField label="Warehouse *" className="sm:col-span-2">
                {warehouseControl}
              </ICTransferFormField>

              <ManagerCustomerFields
                branchId={branchId}
                mode="sale"
                managerId={managerId}
                customerId={counterpartyId}
                allowedManagerIds={allowedManagerIds}
                onManagerChange={id => {
                  setManagerId(id);
                  setCounterpartyId('');
                  setCustomerName('');
                }}
                onCustomerChange={id => {
                  setCounterpartyId(id);
                  const cp = scopedCounterparties.find(c => c.id === id);
                  if (cp) setCustomerName(cp.name);
                  void refresh();
                }}
                entityLedgerById={entityLedgerById}
                disabled={formDisabled || !activeWarehouseId}
              />

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
                        inputClassName={
                          agentFieldInvalid
                            ? `${denseInput} border-red-300 ring-1 ring-red-200 focus-visible:border-red-400 focus-visible:ring-red-200`
                            : denseInput
                        }
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
              className={`border-t border-slate-200 ${isMetal ? 'flex flex-col pt-2.5' : 'pt-1.5'}`}
            >
              <SmoothModeSwap mode={settlementMode}>
                {isMetal ? (
                  <div className="flex flex-col gap-3">
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
                      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5">
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
            ledger={
              warehouseId || counterpartyId ? (
                <div className="flex flex-col gap-2">
                  {warehouseId ? (
                    <WarehouseOnHandStrip
                      inrAmount={unitsToInrAmount(warehouseAvailable ?? 0)}
                      metalG={warehouseMetalG ?? 0}
                      refreshing={refreshing}
                    />
                  ) : null}
                  {counterpartyId ? (
                    <PartyLedgerStrip
                      counterpartyId={counterpartyId}
                      partyLabel={selectedCounterparty?.name || customerName}
                      book={isMetal ? 'INR' : 'AED'}
                      balances={entityLedgerById[counterpartyId]}
                    />
                  ) : null}
                </div>
              ) : undefined
            }
            breakdown={priceBreakdown}
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
                    disabled: formDisabled,
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
