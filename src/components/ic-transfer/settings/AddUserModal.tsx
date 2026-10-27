'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import AsicFormField from '@/components/asic/AsicFormField';
import PasswordInput from '@/components/ui/PasswordInput';
import { asicBtnOutline, asicBtnPrimary, asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  showCommission?: boolean;
  showRate?: boolean;
  showPassword?: boolean;
  showRegion?: boolean;
  showDeliveryProofToggle?: boolean;
  initialData?: any;
  regions?: { id: string; name: string }[];
  zIndexClass?: string;
  onAdd?: (data: {
    id?: string;
    name: string;
    phone: string;
    commission: number | null;
    regionId: string;
    email: string;
    address: string;
    sendDeliveryProofToCustomer?: boolean;
  }) => Promise<boolean | void>;
};

export default function AddUserModal({
  open,
  onClose,
  title = 'Add User',
  showCommission = false,
  showRate = false,
  showPassword = true,
  showRegion = true,
  showDeliveryProofToggle = false,
  initialData,
  regions,
  zIndexClass,
  onAdd,
}: Props) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [commission, setCommission] = useState('');
  const [regionId, setRegionId] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [sendDeliveryProofToCustomer, setSendDeliveryProofToCustomer] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setPhoneNumber(initialData?.phone || '');
      setCommission(initialData?.commission ? String(initialData.commission) : '');
      setRegionId(initialData?.regionId || (regions?.[0]?.id || ''));
      setEmail(initialData?.email || '');
      setAddress(initialData?.address || '');
      setSendDeliveryProofToCustomer(initialData?.sendDeliveryProofToCustomer !== false);
    }
  }, [open, initialData, regions]);

  const handleSubmit = async () => {
    if (!name) return;
    setIsSubmitting(true);
    if (onAdd) {
      const commValue = commission ? parseFloat(commission) : null;
      await onAdd({
        id: initialData?.id,
        name,
        phone: phoneNumber,
        commission: commValue,
        regionId,
        email,
        address,
        sendDeliveryProofToCustomer,
      });
    }
    setName('');
    setPhoneNumber('');
    setCommission('');
    setRegionId('');
    setEmail('');
    setAddress('');
    setSendDeliveryProofToCustomer(true);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-4xl w-[95vw]"
      zIndexClass={zIndexClass}
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className={asicBtnPrimary} onClick={handleSubmit} disabled={isSubmitting || !name}>
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create'}
          </button>
        </>
      }
    >
      <div className={asicFormGrid}>
        <AsicFormField label="Name" htmlFor="add-user-name" colSpan={4}>
          <input id="add-user-name" className={asicInput} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
        </AsicFormField>
        <AsicFormField label="Phone" htmlFor="add-user-phone" colSpan={4}>
          <input id="add-user-phone" className={asicInput} placeholder="+971..." value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
        </AsicFormField>
        {showCommission ? (
          <AsicFormField label="Commission" htmlFor="add-user-commission" colSpan={4}>
            <input id="add-user-commission" className={asicInput} placeholder="0" type="number" step="0.01" value={commission} onChange={e => setCommission(e.target.value)} />
          </AsicFormField>
        ) : null}
        {showRegion ? (
          <AsicFormField label="Region" htmlFor="add-user-region" colSpan={4}>
            <select id="add-user-region" className={asicInput} value={regionId} onChange={e => setRegionId(e.target.value)}>
              <option value="" disabled>Select region</option>
              {regions ? (
                regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))
              ) : (
                <>
                  <option>UAE</option>
                  <option>KSA</option>
                  <option>India</option>
                </>
              )}
            </select>
          </AsicFormField>
        ) : null}
        <AsicFormField label="Email" htmlFor="add-user-email" colSpan={4}>
          <input id="add-user-email" className={asicInput} type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        </AsicFormField>
        {showRate ? (
          <AsicFormField label="Rate" htmlFor="add-user-rate" colSpan={4}>
            <input id="add-user-rate" className={asicInput} defaultValue="0" />
          </AsicFormField>
        ) : null}
        {showPassword ? (
          <>
            <AsicFormField label="Password" htmlFor="add-user-password" colSpan={6}>
              <PasswordInput
                id="add-user-password"
                inputClassName={asicInput}
                autoComplete="new-password"
              />
            </AsicFormField>
            <AsicFormField label="Confirm password" htmlFor="add-user-confirm-password" colSpan={6}>
              <PasswordInput
                id="add-user-confirm-password"
                inputClassName={asicInput}
                autoComplete="new-password"
              />
            </AsicFormField>
          </>
        ) : null}
        <AsicFormField label="Address" htmlFor="add-user-address" colSpan={12}>
          <textarea id="add-user-address" className={asicTextarea} rows={2} value={address} onChange={e => setAddress(e.target.value)} />
        </AsicFormField>
        {showDeliveryProofToggle ? (
          <AsicFormField colSpan={12} className="lg:col-span-12">
            <ToggleSwitch
              checked={sendDeliveryProofToCustomer}
              onChange={setSendDeliveryProofToCustomer}
              label="Send delivery proof directly to customer"
              hint="When off, delivery proof goes to admin for verification before the customer sees the order as completed."
              tone="emerald"
            />
          </AsicFormField>
        ) : null}
      </div>
    </Modal>
  );
}
