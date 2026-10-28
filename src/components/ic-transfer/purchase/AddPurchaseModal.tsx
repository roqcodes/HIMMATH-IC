'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';
import { btnPrimary, btnSecondary, formInput, formSelect } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { ICPurchase, ICWarehouse } from '@/types';
import RateGroupBanner from '../shared/RateGroupBanner';
import ICSaleAmountCards from '../shared/ICSaleAmountCards';
import { computeICSaleAmounts, resolveApplicableRateGroup } from '@/lib/icTransfer/rateCalculations';
import { getAdminAssignedBranchRateGroup } from '@/lib/icTransfer/branchRateScope';
import {
  filterSuppliersForAdminPortal,
  filterSuppliersForBranchPortal,
  filterWarehousesForAdminPortal,
  filterWarehousesForBranchPortal,
} from '@/lib/icTransfer/branchPortalScope';

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ICPurchase;
  branchId?: string;
  warehouses?: ICWarehouse[];
};

const InputField = ({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 12 }) => (
  <AsicFormField label={label} colSpan={colSpan}>{children}</AsicFormField>
);

export default function AddPurchaseModal({ open, onClose, initialData, branchId, warehouses }: Props) {
  const { icSuppliers, icWarehouses, addICPurchase, updateICPurchase, icPurchases, icRateGroups, user } = useApp();
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
  const [supplierId, setSupplierId] = useState(initialData?.supplierId || '');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const selectedSupplierId = supplierOptions.find(s => s.id === supplierId || s.name === supplierId)?.id;
  const applicableGroup = branchId
    ? getAdminAssignedBranchRateGroup(icRateGroups, branchId)
    : resolveApplicableRateGroup(icRateGroups, {
        branchId: user?.branchId,
        customerId: selectedSupplierId,
      });

  const groupSaleRate = applicableGroup?.saleRate || 0;

  const selectedPurchases = icPurchases.filter(p => p.supplierId === supplierId && p.warehouseId === warehouseId);
  const totalStock = selectedPurchases.reduce((acc, p) => acc + (p.units || 0), 0);
  const averageRate = selectedPurchases.length 
    ? selectedPurchases.reduce((acc, p) => acc + (p.unitRate || 0), 0) / selectedPurchases.length 
    : 0;

  useEffect(() => {
    if (open) {
      setNow(new Date());
      setUnits(initialData?.units?.toString() || '');
      setRate(initialData?.unitRate?.toString() || '');
      setSupplierId(initialData?.supplierId || '');
      setWarehouseId(initialData?.warehouseId || '');
      setNotes(initialData?.notes || '');
    }
  }, [open, initialData]);

  const unitNum = parseFloat(units) || 0;
  const rateNum = parseFloat(rate) || groupSaleRate;
  const amounts = computeICSaleAmounts(unitNum, rateNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitNum || !rateNum || !supplierId || !warehouseId) return;
    setIsSubmitting(true);
    
    const payload = {
      supplierId,
      warehouseId,
      locationId: warehouseOptions.find(w => w.id === warehouseId)?.regionId || undefined,
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
      title={initialData ? "Edit Purchase" : "Add Purchase"}
      maxWidth="max-w-[1100px] w-[95vw]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button type="submit" form="ic-purchase-form" className={btnPrimary} disabled={isSubmitting || !unitNum || !rateNum || !supplierId || !warehouseId}>
            {isSubmitting ? 'Saving...' : (initialData ? 'Save Changes' : 'Add Purchase')}
          </button>
        </>
      }
    >
      <form id="ic-purchase-form" onSubmit={handleSubmit} className="space-y-3">
        {applicableGroup && (
          <RateGroupBanner group={applicableGroup} ratesOnly={!!branchId} />
        )}

        <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">
          <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            <svg className="size-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {now ? now.toLocaleDateString() : '...'}
          </span>
          <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
            <svg className="size-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
          </span>
        </div>

        <div className={asicFormGrid}>
          <InputField label="Supplier" colSpan={6}>
            <select className={asicInput} value={supplierId} onChange={e => setSupplierId(e.target.value)} required>
              <option value="" disabled>Select supplier</option>
              {supplierOptions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </InputField>

          <InputField label="Warehouse" colSpan={6}>
            {warehouseOptions.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                No branch warehouses configured.
              </p>
            ) : (
              <select className={asicInput} value={warehouseId} onChange={e => setWarehouseId(e.target.value)} required>
                <option value="" disabled>Select warehouse</option>
                {warehouseOptions.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
          </InputField>

          <InputField label="Unit rate (AED)" colSpan={6}>
            <input className={asicInput} value={rate} onChange={e => setRate(e.target.value)} type="number" step="any" required />
          </InputField>

          <InputField label="Units" colSpan={6}>
            <input className={asicInput} value={units} onChange={e => setUnits(e.target.value)} type="number" step="any" required />
          </InputField>

          {warehouseId && supplierId ? (
            <AsicFormField colSpan={12} className="lg:col-span-12">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                Current stock: <span className="font-semibold text-slate-900">{totalStock.toLocaleString()} units @ AED {averageRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} avg</span>
              </div>
            </AsicFormField>
          ) : null}

          <InputField label="Notes" colSpan={12}>
            <textarea className={asicTextarea} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Purchase notes..." />
          </InputField>
        </div>

        <ICSaleAmountCards
          units={unitNum}
          inrTotal={amounts.inrTotal}
          aedNetTotal={amounts.aedNetTotal}
        />
      </form>
    </Modal>
  );
}
