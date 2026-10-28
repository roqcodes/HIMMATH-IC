'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { filterWarehousesForAssignableUser } from '@/lib/icTransfer/branchPortalScope';
import Modal from '@/components/ui/Modal';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { btnPrimary, btnSecondary, formInput, formSelect } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { getCustomersBySlug, getAllCustomers } from '@/app/actions/customerActions';
import { ICSale } from '@/types';
import PrioritySelector from '../shared/PrioritySelector';
import TransactionTypeSelector from '../shared/TransactionTypeSelector';
import RateGroupBanner from '../shared/RateGroupBanner';
import ICSaleAmountCards from '../shared/ICSaleAmountCards';
import {
  computeICSaleAmounts,
  resolveApplicableRateGroup,
} from '@/lib/icTransfer/rateCalculations';
import { resolveGroupOrderRate } from '@/lib/icTransfer/ratePricing';
import { DEFAULT_IC_SALE_TRANSACTION_TYPE, type ICSaleTransactionType } from '@/lib/icTransfer/transactionTypes';
import type { OrderPriority } from '@/types/warehouse';
import ImageDropZone from '@/components/ui/ImageDropZone';
import { uploadImageToCloudinary, deleteCloudinaryImageByToken } from '@/lib/cloudinary';

type CustomerOption = { id: string; name: string; currency?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  initialData?: ICSale;
};

const InputField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
    {children}
  </div>
);

function customerEditHref(slug: string | undefined, customerId: string): string | null {
  if (!slug || slug === 'superadmin') return null;
  return `/branch/${slug}/customers/${customerId}`;
}

export default function AddSaleModal({ open, onClose, initialData }: Props) {
  const { icWarehouses, addICSale, updateICSale, icRateGroups, user, currentSlug } = useApp();

  const allowedWarehouses = useMemo(
    () => filterWarehousesForAssignableUser(icWarehouses, user),
    [icWarehouses, user],
  );
  const [units, setUnits] = useState(initialData?.units?.toString() || '');
  const [rate, setRate] = useState(initialData?.unitRate?.toString() || '');
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [transactionType, setTransactionType] = useState(initialData?.transactionType || DEFAULT_IC_SALE_TRANSACTION_TYPE);
  const [priority, setPriority] = useState<OrderPriority>(initialData?.priority || 'Normal');
  const [address, setAddress] = useState(initialData?.address || '');
  const [location, setLocation] = useState(initialData?.location || '');
  const [district, setDistrict] = useState(initialData?.district || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [deleteToken, setDeleteToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const selectedCustomer = useMemo(() => {
    if (initialData?.orderCustomerId) {
      const byOrderId = customers.find(c => c.id === initialData.orderCustomerId);
      if (byOrderId) return byOrderId;
    }
    return customers.find(c => c.id === customerName || c.name === customerName);
  }, [customers, customerName, initialData?.orderCustomerId]);

  const selectedCustomerId = selectedCustomer?.id;

  const applicableGroup = resolveApplicableRateGroup(icRateGroups, {
    branchId: user?.branchId,
    customerId: selectedCustomerId,
  });

  const groupSaleRate = applicableGroup?.saleRate || 0;

  const unitNum = parseFloat(units) || 0;

  const resolvedGroupRate = useMemo(() => {
    if (!applicableGroup) return null;
    return resolveGroupOrderRate(applicableGroup, transactionType, unitNum);
  }, [applicableGroup, transactionType, unitNum]);

  React.useEffect(() => {
    if (open) {
      setUnits(initialData?.units?.toString() || '');
      setRate(initialData?.unitRate?.toString() || '');
      setCustomerName(
        initialData?.orderCustomerName || initialData?.customerName || '',
      );
      setWarehouseId(initialData?.warehouseId || '');
      setTransactionType(initialData?.transactionType || DEFAULT_IC_SALE_TRANSACTION_TYPE);
      setPriority(initialData?.priority || 'Normal');
      setAddress(initialData?.address || '');
      setLocation(initialData?.location || '');
      setDistrict(initialData?.district || '');
      setImageUrl(initialData?.imageUrl || '');
      setDeleteToken('');

      const fetchCustomers = async () => {
        if (currentSlug && currentSlug !== 'superadmin') {
          const res = await getCustomersBySlug(currentSlug);
          if (res.success && res.customers) {
            setCustomers(res.customers);
          }
        } else {
          const res = await getAllCustomers();
          if (res.success && res.customers) {
            setCustomers(res.customers);
          }
        }
      };
      fetchCustomers();
    }
  }, [open, initialData, currentSlug]);

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

  const rateNum = parseFloat(rate) || resolvedGroupRate?.saleRate || groupSaleRate;
  const serviceChargeNum = initialData?.serviceCharge ?? 0;

  const amounts = computeICSaleAmounts(unitNum, rateNum, serviceChargeNum);

  const isByHand = transactionType === 'by_hand';
  const customerEditUrl =
    selectedCustomerId ? customerEditHref(currentSlug, selectedCustomerId) : null;

  const canSubmit = unitNum > 0 && rateNum > 0 && customerName.trim().length > 0;

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

    const recordedCustomerName = selectedCustomer?.name || customerName.trim();

    const payload = {
      customerName: recordedCustomerName,
      orderCustomerId: selectedCustomerId || undefined,
      orderCustomerName: selectedCustomerId ? recordedCustomerName : undefined,
      warehouseId,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Sale' : 'Register Sale'}
      maxWidth="max-w-[1100px] w-[95vw]"
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
      <form id="ic-sale-form" onSubmit={handleSubmit} className="space-y-5">
        {applicableGroup && <RateGroupBanner group={applicableGroup} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">Customer</h3>
            <InputField label="Customer Name">
              <ComboSearchInput
                value={customerName}
                onChange={setCustomerName}
                onSelectOption={option => setCustomerName(option.label)}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                placeholder="Search customer or type name..."
              />
            </InputField>

            <InputField label="Address / Description">
              <textarea
                className={`${formInput} resize-none`}
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Enter delivery address or description details"
                rows={3}
              />
            </InputField>

            {isByHand ? (
              <>
                <InputField label="Location">
                  <input
                    type="text"
                    className={formInput}
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Enter location"
                  />
                </InputField>
                <InputField label="District">
                  <input
                    type="text"
                    className={formInput}
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    placeholder="Enter district"
                  />
                </InputField>
              </>
            ) : null}

            <InputField label="Captured Image">
              <ImageDropZone
                imageUrl={imageUrl}
                onUpload={handleImageUpload}
                onClear={handleDeleteImage}
                isUploading={isUploading}
                emptyLabel="Upload address or payment proof image"
              />
            </InputField>
          </div>

          <div className="space-y-4 lg:col-span-7 lg:border-l lg:pl-6 lg:border-slate-100">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">Transaction Details</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Priority">
                  <PrioritySelector value={priority} onChange={setPriority} disabled={isSubmitting} />
                </InputField>

                <InputField label="Warehouse (Optional)">
                  <select
                    className={`${formSelect} h-[46px] sm:h-[54px]`}
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                  >
                    <option value="">None</option>
                    {allowedWarehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </InputField>
              </div>

              <InputField label="Transaction Type">
                <TransactionTypeSelector
                  value={transactionType}
                  onChange={handleTransactionTypeChange}
                  disabled={isSubmitting}
                />
              </InputField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Units">
                  <input className={formInput} value={units} onChange={e => setUnits(e.target.value)} type="number" step="0.01" required />
                </InputField>

                <InputField label="Unit Rate (AED)">
                  <input className={formInput} value={rate} onChange={e => setRate(e.target.value)} type="number" step="0.01" required />
                </InputField>
              </div>

            </div>

            <h3 className="border-b border-slate-100 pb-2 pt-2 text-sm font-bold text-slate-900">Calculations</h3>

            <ICSaleAmountCards
              units={unitNum}
              inrTotal={amounts.inrTotal}
              aedNetTotal={amounts.aedNetTotal}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
