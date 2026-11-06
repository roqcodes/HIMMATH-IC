'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { btnPrimary, btnSecondary, formInput } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { getCustomersBySlug } from '@/app/actions/customerActions';
import { ICSale } from '@/types';
import { SALE_COUNTERPARTY_FIELD_LABEL } from '@/lib/counterparties/labels';
import { canEditOrder } from '@/lib/icTransfer/customerOrderReview';
import { hasICSaleEditableFieldsChanged, type ICSaleContentFields } from '@/lib/icTransfer/saleChanges';
import { WorkflowNotice } from '../shared/orderWorkflow';
import RateGroupBanner from '../shared/RateGroupBanner';
import CopyOrderDetailsButton from '../shared/CopyOrderDetailsButton';
import TransactionTypeSelector from '../shared/TransactionTypeSelector';
import { computeICSaleAmounts, formatAmount } from '@/lib/icTransfer/rateCalculations';
import { resolveGroupOrderRate } from '@/lib/icTransfer/ratePricing';
import InrAmountInWords from '../shared/InrAmountInWords';
import { DEFAULT_IC_SALE_TRANSACTION_TYPE, normalizeICSaleTransactionType, transactionTypeRequiresBank, type ICSaleTransactionType } from '@/lib/icTransfer/transactionTypes';
import { resolveBranchOrderRates } from '@/lib/icTransfer/branchRateScope';
import ImageDropZone from '@/components/ui/ImageDropZone';
import { uploadImageToCloudinary, deleteCloudinaryImageByToken } from '@/lib/cloudinary';
import {
  buildCustomerSearchOptions,
  entitySearchOptionsToComboOptions,
} from '@/lib/icTransfer/entitySearchOptions';

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

export default function AddICBranchOrderModal({ open, onClose, initialData }: Props) {
  const { addICSale, resubmitICSale, branches, currentSlug, icRateGroups, user, showToast } = useApp();
  const isBranchManager = user?.role === 'branch_manager';
  const [units, setUnits] = useState(initialData?.units?.toString() || '');
  const [transactionType, setTransactionType] = useState<ICSaleTransactionType>(() =>
    normalizeICSaleTransactionType(initialData?.transactionType),
  );
  const [bank, setBank] = useState(initialData?.bank || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || '');
  const [deleteToken, setDeleteToken] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [editBaseline, setEditBaseline] = useState<Pick<
    ICSaleContentFields,
    'units' | 'transactionType' | 'address' | 'imageUrl' | 'bank'
  > | null>(null);
  const [handleAtBranch, setHandleAtBranch] = useState(false);

  // Retrieve branch info
  const currentBranch =
    branches.find(b => b.slug === currentSlug)
    ?? (user?.branchId ? branches.find(b => b.id === user.branchId) : undefined);
  const branchName = currentBranch?.name || currentSlug || 'Branch Customer';
  const currentBranchId = currentBranch?.id;

  const branchCustomerIdSet = useMemo(() => new Set(customers.map(c => c.id)), [customers]);

  const branchCustomerSearchOptions = useMemo(
    () => buildCustomerSearchOptions(customers),
    [customers],
  );
  const branchCustomerComboOptions = useMemo(
    () => entitySearchOptionsToComboOptions(branchCustomerSearchOptions),
    [branchCustomerSearchOptions],
  );

  const orderRates = useMemo(() => {
    const customerId = selectedCustomerId || undefined;
    const branchId = currentBranchId ?? user?.branchId;
    return resolveBranchOrderRates(icRateGroups, {
      branchId,
      customerId,
      branchCustomerIds: branchCustomerIdSet,
    });
  }, [
    icRateGroups,
    currentBranchId,
    user?.branchId,
    selectedCustomerId,
    branchCustomerIdSet,
  ]);

  const applicableGroup = orderRates.group;

  const resolvedBranchRate = useMemo(() => {
    if (!applicableGroup) return { saleRate: 0, conversionRate: 1 };
    return resolveGroupOrderRate(applicableGroup, transactionType, parseFloat(units) || 0);
  }, [applicableGroup, transactionType, units]);

  const groupSaleRate = initialData ? initialData.unitRate : resolvedBranchRate.saleRate;

  useEffect(() => {
    if (!open || !currentSlug) return;
    getCustomersBySlug(currentSlug).then(res => {
      if (res.success && res.customers) {
        setCustomers(
          res.customers.map((c: { id: string; name: string; code?: string }) => ({
            id: c.id,
            name: c.name,
            code: c.code,
          })),
        );
      }
    });
  }, [open, currentSlug]);

  useEffect(() => {
    if (open) {
      setUnits(initialData?.units?.toString() || '');
      setTransactionType(normalizeICSaleTransactionType(initialData?.transactionType));
      setBank(
        initialData?.transactionType === 'by_hand' ? '' : (initialData?.bank || ''),
      );
      setAddress(initialData?.address || '');
      setImageUrl(initialData?.imageUrl || '');
      setDeleteToken('');
      setSelectedCustomerId(initialData?.counterpartyId || '');
      setCustomerQuery(initialData?.orderCustomerName || '');

      if (initialData && canEditOrder(initialData, user?.role)) {
        setEditBaseline({
          units: initialData.units,
          transactionType: normalizeICSaleTransactionType(initialData.transactionType),
          address: initialData.address,
          imageUrl: initialData.imageUrl,
          bank: initialData.transactionType === 'by_hand' ? '' : (initialData.bank || ''),
        });
      } else {
        setEditBaseline(null);
      }
      setHandleAtBranch(false);
    }
  }, [open, initialData, user?.role]);

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

  const unitNum = parseFloat(units) || 0;
  const rateNum = groupSaleRate;
  const serviceChargeNum = 0;

  const amounts = computeICSaleAmounts(unitNum, rateNum, serviceChargeNum);

  const isEditMode = !!initialData && canEditOrder(initialData, user?.role);

  const showBankField = transactionTypeRequiresBank(transactionType);

  const handleTransactionTypeChange = (value: ICSaleTransactionType) => {
    setTransactionType(value);
    if (value === 'by_hand') {
      setBank('');
    }
  };

  const trimmedCustomer = customerQuery.trim();
  const recordedCustomerName = branchName;

  const payload = {
    customerName: recordedCustomerName,
    orderCustomerName: trimmedCustomer || undefined,
    counterpartyId: selectedCustomerId || undefined,
    transactionType,
    unitRate: rateNum,
    units: unitNum,
    aedAmount: amounts.aedNetTotal,
    bank: showBankField ? (bank || undefined) : undefined,
    address: address || undefined,
    imageUrl: imageUrl || undefined,
    serviceCharge: serviceChargeNum,
    fulfillmentHandler: 'hq_admin' as const,
  };

  const contentPayload = {
    units: unitNum,
    transactionType,
    aedAmount: amounts.aedNetTotal,
    bank: showBankField ? (bank || undefined) : undefined,
    address: address || undefined,
    imageUrl: imageUrl || undefined,
    serviceCharge: serviceChargeNum,
  };

  const editableSnapshot = {
    units: unitNum,
    transactionType,
    address: address || undefined,
    imageUrl: imageUrl || undefined,
    serviceCharge: serviceChargeNum,
    bank: showBankField ? (bank || undefined) : undefined,
  };

  const canResubmit =
    !!editBaseline && hasICSaleEditableFieldsChanged(editBaseline, editableSnapshot);

  const submitDisabled =
    isSubmitting ||
    isUploading ||
    !unitNum ||
    (!initialData && (!trimmedCustomer || !rateNum)) ||
    (isEditMode && !canResubmit);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitDisabled) return;
    setIsSubmitting(true);

    if (initialData && isEditMode) {
      await resubmitICSale(initialData.id, contentPayload, currentSlug);
    } else if (!initialData) {
      await addICSale(payload);
    }

    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex flex-col gap-0.5">
          <span>{isEditMode ? 'Edit Order' : 'Create Transfer Order'}</span>
          <span className="text-xs font-semibold text-accent">{branchName}</span>
        </div>
      }
      maxWidth="max-w-[1100px] w-[95vw]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSubmitting || isUploading}>Cancel</button>
          <button
            type="submit"
            form="branch-order-form"
            className={`${btnPrimary} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none motion-safe:disabled:hover:translate-y-0 motion-safe:disabled:hover:shadow-primary`}
            disabled={submitDisabled}
            title={isEditMode && !canResubmit ? 'Change at least one field before resubmitting' : undefined}
          >
            {isSubmitting
              ? 'Saving...'
              : isEditMode
                ? 'Save Changes'
                : 'Create Order'}
          </button>
        </>
      }
    >
      <form id="branch-order-form" onSubmit={handleSubmit} className="space-y-5">
        {isEditMode && initialData?.rejectionRemarks && (
          <WorkflowNotice variant="danger" title="Order rejected by admin">
            {initialData.rejectionRemarks}
            <span className="mt-1 block text-[10px] font-medium opacity-80">
              Update the order details below, then resend for admin review.
            </span>
          </WorkflowNotice>
        )}

        {applicableGroup && (
          <RateGroupBanner
            group={applicableGroup}
            ratesOnly={isBranchManager || user?.role === 'staff'}
            hideAedRate={isBranchManager || user?.role === 'staff'}
          />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">{SALE_COUNTERPARTY_FIELD_LABEL}</h3>

            <InputField label={SALE_COUNTERPARTY_FIELD_LABEL}>
              {isEditMode ? (
                <input
                  className={`${formInput} bg-slate-50 text-slate-500 font-semibold cursor-not-allowed`}
                  value={customerQuery || branchName}
                  disabled
                  readOnly
                />
              ) : (
                <ComboSearchInput
                  value={customerQuery}
                  onChange={val => {
                    setCustomerQuery(val);
                    const match =
                      customers.find(c => c.name === val) ||
                      customers.find(c => c.code?.toUpperCase() === val.trim().toUpperCase());
                    setSelectedCustomerId(match?.id || '');
                  }}
                  onSelectOption={opt => {
                    setCustomerQuery(opt.name ?? opt.label);
                    setSelectedCustomerId(opt.value);
                  }}
                  options={branchCustomerComboOptions}
                  placeholder="Search by code or name…"
                />
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Order will be recorded under {branchName}. Select the end party above.
              </p>
            </InputField>

            {showBankField ? (
              <InputField label="Bank">
                <input 
                  type="text"
                  className={formInput} 
                  value={bank} 
                  onChange={e => setBank(e.target.value)} 
                  placeholder="Enter bank name"
                />
              </InputField>
            ) : null}

            <InputField label="Address / Description">
              <textarea 
                className={`${formInput} resize-none`} 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                placeholder="Enter delivery address details"
                rows={3}
              />
            </InputField>


            <InputField label="Captured Image">
              <div className="flex flex-col gap-3">
                <ImageDropZone
                  imageUrl={imageUrl}
                  onUpload={handleImageUpload}
                  onClear={handleDeleteImage}
                  isUploading={isUploading}
                  emptyLabel="Upload address or payment proof image"
                />
                {!imageUrl ? (
                  <CopyOrderDetailsButton
                    address={address}
                    units={unitNum}
                    enableShare
                    onCopySuccess={() => showToast('Details copied')}
                    onCopyError={msg => showToast(msg, 'error')}
                    onShareError={msg => showToast(msg, 'error')}
                  />
                ) : null}
              </div>
            </InputField>
          </div>

          {/* Right Column: Transaction Details, Pricing, and Totals */}
          <div className="space-y-4 lg:col-span-7 lg:border-l lg:pl-6 lg:border-slate-100">
            <h3 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">Transaction Details</h3>
            
            <div className="flex flex-col gap-4">
              <div className="order-2 md:order-1">
                <InputField label="Transaction Type">
                  <TransactionTypeSelector
                    value={transactionType}
                    onChange={handleTransactionTypeChange}
                    disabled={isSubmitting || isEditMode}
                  />
                </InputField>
              </div>

              <div className="order-1 md:order-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField label="Order Units">
                  <input 
                    className={formInput} 
                    value={units} 
                    onChange={e => setUnits(e.target.value)} 
                    type="number" 
                    step="0.01" 
                    placeholder="Enter units quantity"
                    required
                  />
                </InputField>

                <InputField label="Unit Rate (AED) (Locked)">
                  <input 
                    className={`${formInput} bg-slate-50 text-slate-500 font-semibold cursor-not-allowed`} 
                    value={rateNum} 
                    disabled 
                    readOnly 
                    type="number" 
                  />
                </InputField>
              </div>
            </div>

             <h3 className="border-b border-slate-100 pb-2 pt-2 text-sm font-bold text-slate-900">Calculations</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-slate-100 p-4 bg-slate-50/50">
              <div className="text-center p-3 rounded-xl bg-white border border-slate-100 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units</span>
                <span className="mt-1.5 text-base sm:text-lg font-bold text-slate-800 font-mono">
                  {formatAmount(unitNum)}
                </span>
              </div>

              <div className="text-center p-3 rounded-xl bg-white border border-slate-100 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount (INR)</span>
                <span className="mt-1.5 text-base sm:text-lg font-bold text-slate-800 font-mono">
                  {formatAmount(amounts.inrTotal)}
                </span>
                <InrAmountInWords amount={amounts.inrTotal} />
              </div>

              <div className="text-center p-3 rounded-xl bg-white border border-slate-100 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Amount (AED)
                </span>
                <span className="mt-1.5 text-base sm:text-lg font-bold text-slate-800 font-mono">
                  {formatAmount(amounts.aedNetTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
