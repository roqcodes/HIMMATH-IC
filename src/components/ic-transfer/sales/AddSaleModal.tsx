'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import {
  buildCounterpartySearchOptions,
  buildWarehouseSearchOptions,
} from '@/lib/icTransfer/entitySearchOptions';
import {
  filterSuppliersForAdminPortal,
  filterSuppliersForBranchPortal,
  filterWarehousesForAssignableUser,
} from '@/lib/icTransfer/branchPortalScope';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary, formInput } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { listAvailableMetalLotsAction, type AvailableMetalLot } from '@/app/actions/icTransferActions';
import { ICSale, ICSupplier } from '@/types';
import TransactionTypeSelector from '../shared/TransactionTypeSelector';
import ICSaleAmountCards from '../shared/ICSaleAmountCards';
import SettlementModeToggle from '../shared/SettlementModeToggle';
import MetalSettlementFields, { emptyMetalFields } from '../shared/MetalSettlementFields';
import { metalFieldsFromRecord, type ICSettlementMode } from '@/lib/icTransfer/metalSettlement';
import {
  computeICSaleAmounts,
  formatRateInputValue,
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
import SettlementModePanel from '../shared/SettlementModePanel';
import {
  icSaleModalShell,
  icWarehouseStockBannerMinH,
  icFormModalBody,
  icSaleFormModalBody,
  icSaleFormGridClass,
  icFormSectionHeading,
  icFormColumnGap,
  icFormGridGap,
} from '../shared/icTransferFormModalLayout';

function resolveInitialCounterpartyId(initialData: ICSale | undefined): string {
  return initialData?.counterpartyId || '';
}

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ICSale;
  /** When set, warehouse is prefilled and cannot be changed (e.g. warehouse detail page). */
  lockedWarehouseId?: string;
};

const InputField = ({
  label,
  children,
  className = '',
  fill = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Grow to fill parent; use in equal-height stacks. */
  fill?: boolean;
}) => (
  <div className={`flex min-h-0 flex-col gap-1 ${fill ? 'min-h-0 flex-1' : ''} ${className}`}>
    <label className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
    {fill ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
  </div>
);

function customerEditHref(slug: string | undefined, customerId: string): string | null {
  if (!slug || slug === 'superadmin') return null;
  return `/branch/${slug}/customers/${customerId}`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className={`shrink-0 ${icFormSectionHeading}`}>{children}</h3>;
}

export default function AddSaleModal({ open, onClose, initialData, lockedWarehouseId }: Props) {
  const { icWarehouses, icSales, icSuppliers, addICSale, updateICSale, icRateGroups, user, currentSlug, branches } =
    useApp();

  const [settlementMode, setSettlementMode] = useState<ICSettlementMode>('cash');
  const [metal, setMetal] = useState(emptyMetalFields());
  const isMetal = settlementMode === 'metal';
  const lockMode = Boolean(initialData?.id);

  const [units, setUnits] = useState(initialData?.units?.toString() || '');
  const [rate, setRate] = useState(initialData?.unitRate?.toString() || '');
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [transactionType, setTransactionType] = useState<ICSaleTransactionType>(() =>
    normalizeICSaleTransactionType(initialData?.transactionType),
  );
  const [priority, setPriority] = useState<OrderPriority>(initialData?.priority || 'Normal');
  const [address, setAddress] = useState(initialData?.address || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [district, setDistrict] = useState(initialData?.district || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [deleteToken, setDeleteToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [metalPurchaseId, setMetalPurchaseId] = useState(initialData?.metalPurchaseId || '');
  const [metalLots, setMetalLots] = useState<AvailableMetalLot[]>([]);
  const branchId = useMemo(() => {
    if (user?.branchId) return user.branchId;
    if (currentSlug && currentSlug !== 'superadmin') {
      return branches.find(b => b.slug === currentSlug)?.id;
    }
    return undefined;
  }, [user?.branchId, currentSlug, branches]);

  const scopedCounterparties = useMemo(() => {
    if (branchId) return filterSuppliersForBranchPortal(icSuppliers, branchId);
    return filterSuppliersForAdminPortal(icSuppliers);
  }, [icSuppliers, branchId]);

  const snapshotKey = `${counterpartyId}|${warehouseId}`;
  const { customerBalances, warehouseAvailableById, warehouseMetalGById, refresh, refreshing } =
    useICTransferModalSnapshots(open, snapshotKey);

  const allowedWarehouses = useMemo(
    () => filterWarehousesForAssignableUser(icWarehouses, user),
    [icWarehouses, user],
  );
  const counterpartySearchOptions = useMemo(
    () => buildCounterpartySearchOptions(scopedCounterparties, customerBalances),
    [scopedCounterparties, customerBalances],
  );
  const warehouseSearchOptions = useMemo(
    () =>
      buildWarehouseSearchOptions(allowedWarehouses, icSales, warehouseAvailableById, warehouseMetalGById),
    [allowedWarehouses, icSales, warehouseAvailableById, warehouseMetalGById],
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

  const warehouseField = (
    <InputField label="Warehouse *">
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
          No warehouses configured — add a warehouse before recording sales.
        </p>
      ) : (
        <EntitySearchSelect
          selectedId={warehouseId}
          onSelectId={id => setWarehouseId(id)}
          options={warehouseSearchOptions}
          placeholder="Search by code or name…"
          inputClassName={asicInput}
          onFocusRefresh={() => void refresh()}
        />
      )}
    </InputField>
  );

  const warehouseAvailable =
    warehouseId && warehouseAvailableById[warehouseId] !== undefined
      ? warehouseAvailableById[warehouseId]
      : null;
  const warehouseMetalG =
    warehouseId && warehouseMetalGById[warehouseId] !== undefined
      ? warehouseMetalGById[warehouseId]
      : null;
  const metalLotOptions = useMemo(
    () =>
      metalLots.map(lot => ({
        value: lot.id,
        label: lot.label,
        detail: `${lot.remainingG.toLocaleString()} g remaining · INR ${lot.inrTotal.toLocaleString()} · AED ${lot.aedTotal.toLocaleString()}`,
      })),
    [metalLots],
  );

  const unitNum = parseFloat(units) || 0;
  const groupOrderRate = useMemo(() => {
    if (!customerRateGroup) return null;
    return resolveGroupOrderRate(customerRateGroup, transactionType, unitNum);
  }, [customerRateGroup, transactionType, unitNum]);

  React.useEffect(() => {
    if (!open) return;
    if (isMetal || !customerRateGroup) return;
    const resolved = resolveGroupOrderRate(customerRateGroup, transactionType, unitNum);
    if (resolved.saleRate > 0) {
      setRate(formatRateInputValue(resolved.saleRate));
    }
  }, [open, customerRateGroup?.id, transactionType, unitNum, isMetal]);

  React.useEffect(() => {
    if (open) {
      const mode = initialData?.settlementMode === 'metal' ? 'metal' : 'cash';
      setSettlementMode(mode);
      setMetal(metalFieldsFromRecord({
        metalWeightG: initialData?.metalWeightG,
        metalRateInrPerG: initialData?.metalRateInrPerG,
        metalRateAedPerG: initialData?.metalRateAedPerG,
        inrTotal: initialData?.inrTotal,
        aedTotal: (initialData?.aedAmount ?? 0) + (initialData?.serviceCharge ?? 0),
      }));
      setUnits(initialData?.units?.toString() || '');
      setRate(initialData?.unitRate?.toString() || '');
      setCustomerName(
        initialData?.orderCustomerName || initialData?.customerName || '',
      );
      setCounterpartyId(resolveInitialCounterpartyId(initialData));
      setWarehouseId(lockedWarehouseId || initialData?.warehouseId || '');
      setMetalPurchaseId(initialData?.metalPurchaseId || '');
      setTransactionType(normalizeICSaleTransactionType(initialData?.transactionType));
      setPriority(initialData?.priority || 'Normal');
      setAddress(initialData?.address || '');
      setLocation(initialData?.location || '');
      setDistrict(initialData?.district || '');
      setImageUrl(initialData?.imageUrl || '');
      setDeleteToken('');

      if (!lockedWarehouseId && !initialData?.warehouseId && allowedWarehouses.length === 1) {
        setWarehouseId(allowedWarehouses[0]!.id);
      }
    }
  }, [open, initialData, lockedWarehouseId, allowedWarehouses, scopedCounterparties]);

  React.useEffect(() => {
    if (!open || !isMetal || !warehouseId) {
      setMetalLots([]);
      return;
    }
    let cancelled = false;
    void listAvailableMetalLotsAction(warehouseId, initialData?.id).then(lots => {
      if (cancelled) return;
      setMetalLots(lots);
      if (metalPurchaseId && !lots.some(l => l.id === metalPurchaseId)) {
        setMetalPurchaseId('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, isMetal, warehouseId, initialData?.id]);

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

  const rateNum = parseFloat(rate) || 0;
  const serviceChargeNum = initialData?.serviceCharge ?? 0;

  const ratesMatchGroup =
    Boolean(customerRateGroup && groupOrderRate && groupOrderRate.saleRate > 0) &&
    Math.abs(rateNum - groupOrderRate!.saleRate) < 0.005;

  const showRateGroupLabel = Boolean(rateGroupCustomerId && customerRateGroup && ratesMatchGroup);

  const amounts = computeICSaleAmounts(unitNum, rateNum, serviceChargeNum);

  const isByHand = transactionType === 'by_hand';
  const customerEditUrl = null;

  const canSubmit = isMetal
    ? counterpartyId &&
      warehouseId.trim().length > 0 &&
      Boolean(metalPurchaseId) &&
      metal.metalWeightG > 0 &&
      metal.metalRateInrPerG > 0 &&
      metal.metalSheetRateAed > 0 &&
      metal.metalRateAedPerG > 0 &&
      metal.inrTotal > 0 &&
      metal.aedTotal > 0
    : unitNum > 0 &&
      rateNum > 0 &&
      counterpartyId &&
      warehouseId.trim().length > 0;

  const handleTransactionTypeChange = (value: ICSaleTransactionType) => {
    setTransactionType(value);
    if (value !== 'by_hand') {
      setLocation('');
      setDistrict('');
    }
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
          unitRate: 0,
          units: 0,
          metalWeightG: metal.metalWeightG,
          metalRateInrPerG: metal.metalRateInrPerG,
          metalRateAedPerG: metal.metalRateAedPerG,
          inrTotal: metal.inrTotal,
          aedAmount: metal.aedTotal,
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
          location: isByHand ? location.trim() || undefined : undefined,
          district: isByHand ? district.trim() || undefined : undefined,
          imageUrl: imageUrl || undefined,
        };

    if (initialData) {
      await updateICSale(initialData.id, payload);
    } else {
      await addICSale(payload);
    }

    setIsSubmitting(false);
    onClose();
  };

  const warehouseStockBanner = (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-1.5 text-xs text-slate-600 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-elevated)] ${icWarehouseStockBannerMinH} ${warehouseId && warehouseAvailable != null ? '' : 'border-dashed border-slate-100 bg-transparent dark:border-[var(--theme-border)]'}`}
    >
      {warehouseId ? (
        <p>
          <span className="font-semibold uppercase tracking-wide text-slate-500">Warehouse stock · </span>
          {isMetal ? (
            <>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-[var(--theme-text)]">
                {(warehouseMetalG ?? 0).toLocaleString()}
              </span>{' '}
              g metal
            </>
          ) : (
            <>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-[var(--theme-text)]">
                {(warehouseAvailable ?? 0).toLocaleString()}
              </span>{' '}
              units available
            </>
          )}
          {refreshing ? <span className="text-slate-400"> · updating…</span> : null}
        </p>
      ) : (
        <p className="text-slate-400">Select a warehouse to see stock.</p>
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Sale' : 'Register Sale'}
      maxWidth="max-w-[1100px] w-[95vw]"
      maxHeight={icSaleModalShell}
      bodyClassName={icSaleFormModalBody}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSubmitting || isUploading}>Cancel</button>
          <button
            type="submit"
            form="ic-sale-form"
            className={btnPrimary}
            disabled={isSubmitting || isUploading || !canSubmit}
          >
            {isSubmitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Register Sale')}
          </button>
        </>
      }
    >
      <form id="ic-sale-form" onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-2 lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <SettlementModeToggle
            value={settlementMode}
            onChange={setSettlementMode}
            lockMode={lockMode}
            disabled={isSubmitting || isUploading}
          />
        </div>
        <div className={`${icSaleFormGridClass} ${icFormGridGap}`}>
          <div className={`flex min-h-0 flex-col lg:col-span-5 lg:min-h-full ${icFormColumnGap}`}>
            <SectionHeading>{SALE_COUNTERPARTY_FIELD_LABEL}</SectionHeading>
            <InputField label={SALE_COUNTERPARTY_FIELD_LABEL} className="shrink-0">
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
                inputClassName={asicInput}
                onFocusRefresh={() => void refresh()}
              />
              <p
                className={`mt-1 min-h-[1.125rem] text-xs text-slate-500 dark:text-[var(--theme-text-secondary)] ${selectedCounterpartyOption?.detail ? '' : 'invisible'}`}
                aria-hidden={!selectedCounterpartyOption?.detail}
              >
                {selectedCounterpartyOption?.detail
                  ? `${selectedCounterpartyOption.detail}${refreshing ? ' · updating…' : ''}`
                  : '\u00a0'}
              </p>
            </InputField>

            <InputField label="Address / Description" className="shrink-0">
              <textarea
                className={`${formInput} min-h-[3.25rem] resize-none py-1.5 text-sm`}
                rows={2}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Enter delivery address or description details"
              />
            </InputField>

            <InputField label="Captured Image" fill className="min-h-[5rem] lg:min-h-0">
              <ImageDropZone
                fillHeight
                compact
                className="min-h-0 flex-1"
                imageUrl={imageUrl}
                onUpload={handleImageUpload}
                onClear={handleDeleteImage}
                isUploading={isUploading}
                emptyLabel="Upload address or payment proof"
              />
            </InputField>
          </div>

          <div className={`flex min-h-0 flex-col lg:col-span-7 lg:min-h-full lg:border-l lg:border-slate-100 lg:pl-5 dark:lg:border-[var(--theme-border)] ${icFormColumnGap}`}>
            <SectionHeading>{isMetal ? 'Metal settlement' : 'Transaction details'}</SectionHeading>

            {warehouseStockBanner}

            <SettlementModePanel
              active={settlementMode}
              metal={
                <>
                  {warehouseField}
                  <InputField label="Purchase lot *">
                    {metalLotOptions.length === 0 ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                        No open metal purchases in this warehouse.
                      </p>
                    ) : (
                      <EntitySearchSelect
                        selectedId={metalPurchaseId}
                        onSelectId={id => {
                          setMetalPurchaseId(id);
                          const lot = metalLots.find(l => l.id === id);
                          if (lot) {
                            setMetal(metalFieldsFromRecord({
                              metalWeightG: lot.remainingG,
                              metalRateInrPerG: lot.metalRateInrPerG,
                              metalRateAedPerG: lot.metalRateAedPerG,
                              inrTotal: lot.inrTotal,
                              aedTotal: lot.aedTotal,
                            }));
                          }
                        }}
                        options={metalLotOptions}
                        placeholder="Select purchased metal…"
                        inputClassName={asicInput}
                      />
                    )}
                  </InputField>
                  <p className="text-xs text-slate-500 dark:text-[var(--theme-text-secondary)]">
                    Customer pays the total AED amount. IC Funds posts receivable and metal P&amp;L on completion.
                  </p>
                  <MetalSettlementFields
                    value={metal}
                    onChange={setMetal}
                    disabled={isSubmitting || isUploading}
                    lockWeight
                  />
                </>
              }
              cash={
                <>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <InputField label="Unit Rate (AED)">
                        <div className="flex items-stretch gap-2">
                          <input
                            className={`${formInput} min-w-0 flex-1`}
                            value={rate}
                            onChange={e => setRate(e.target.value)}
                            type="number"
                            step="0.01"
                            placeholder={
                              customerRateGroup ? 'Filled from rate group when available' : 'Enter unit rate'
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
                      </InputField>

                      <InputField label="Units">
                        <input className={formInput} value={units} onChange={e => setUnits(e.target.value)} type="number" step="0.01" />
                      </InputField>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <InputField label="Transaction type">
                        <TransactionTypeSelector
                          value={transactionType}
                          onChange={handleTransactionTypeChange}
                          disabled={isSubmitting}
                        />
                      </InputField>

                      {warehouseField}
                    </div>
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
