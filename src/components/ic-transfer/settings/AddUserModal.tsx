'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import PasswordInput from '@/components/ui/PasswordInput';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import AsianUnifiedLocationSelect from '@/components/ui/AsianUnifiedLocationSelect';
import IndiaUnifiedLocationSelect from '@/components/ui/IndiaUnifiedLocationSelect';
import {
  isAsianLocationFormValid,
  isIndiaWarehouseLocationValid,
} from '@/lib/geo/locationFormValidation';
import { asicBtnOutline, asicBtnPrimary, asicInput, asicTextarea } from '@/components/asic/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  showCommission?: boolean;
  showRate?: boolean;
  showPassword?: boolean;
  showRegion?: boolean;
  showCountry?: boolean;
  showSubdivision?: boolean;
  showIndiaLocation?: boolean;
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
    country?: string;
    subdivision?: string;
    locality?: string;
    indiaState?: string;
    indiaCity?: string;
  }) => Promise<boolean | void>;
};

const fieldClass = 'w-full max-w-none';

export default function AddUserModal({
  open,
  onClose,
  title = 'Add User',
  showCommission = false,
  showRate = false,
  showPassword = true,
  showRegion = true,
  showCountry = false,
  showSubdivision = false,
  showIndiaLocation = false,
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
  const [country, setCountry] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [locality, setLocality] = useState('');
  const [indiaState, setIndiaState] = useState('');
  const [indiaCity, setIndiaCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initialData?.name || '');
      setPhoneNumber(initialData?.phone || '');
      setCommission(initialData?.commission ? String(initialData.commission) : '');
      setRegionId(initialData?.regionId || (regions?.[0]?.id || ''));
      setEmail(initialData?.email || '');
      setAddress(initialData?.address || '');
      setCountry(initialData?.country || '');
      setSubdivision(initialData?.subdivision || '');
      setLocality(initialData?.locality || '');
      setIndiaState(initialData?.indiaState || '');
      setIndiaCity(initialData?.indiaCity || '');
    }
  }, [open, initialData, regions]);

  const asianLocationOk =
    !showSubdivision ||
    isAsianLocationFormValid(country, subdivision, locality, { requireCountry: true });

  const indiaLocationOk = !showIndiaLocation || isIndiaWarehouseLocationValid(indiaState, indiaCity);

  const canSubmit =
    Boolean(name.trim()) &&
    asianLocationOk &&
    indiaLocationOk &&
    (!showIndiaLocation || indiaState.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
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
        country: showCountry || showSubdivision ? country.trim() : undefined,
        subdivision: showSubdivision ? subdivision.trim() : undefined,
        locality: showSubdivision ? locality.trim() : undefined,
        indiaState: showIndiaLocation ? indiaState.trim() : undefined,
        indiaCity: showIndiaLocation ? indiaCity.trim() : undefined,
      });
    }
    setName('');
    setPhoneNumber('');
    setCommission('');
    setRegionId('');
    setEmail('');
    setAddress('');
    setCountry('');
    setSubdivision('');
    setLocality('');
    setIndiaState('');
    setIndiaCity('');
    setIsSubmitting(false);
    onClose();
  };

  const showLocationSection = showSubdivision || showIndiaLocation;
  const showAccessSection = showPassword || showRegion || showRate;

  const profileSection = (
    <ModalFormSection title="Profile" description="Primary identity for this record.">
      <AsicFormField label="Name *" htmlFor="add-user-name" className={fieldClass}>
        <input
          id="add-user-name"
          className={asicInput}
          placeholder="Full name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </AsicFormField>
      {showCommission ? (
        <AsicFormField label="Commission" htmlFor="add-user-commission" className={fieldClass}>
          <input
            id="add-user-commission"
            className={asicInput}
            placeholder="0"
            type="number"
            step="0.01"
            value={commission}
            onChange={e => setCommission(e.target.value)}
          />
        </AsicFormField>
      ) : null}
    </ModalFormSection>
  );

  const contactSection = (
    <ModalFormSection title="Contact" description="Optional phone, email, and street address.">
      <AsicFormField label="Phone" htmlFor="add-user-phone" className={fieldClass}>
        <input
          id="add-user-phone"
          className={asicInput}
          placeholder="+971..."
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
        />
      </AsicFormField>
      <AsicFormField label="Email" htmlFor="add-user-email" className={fieldClass}>
        <input
          id="add-user-email"
          className={asicInput}
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </AsicFormField>
      <AsicFormField label="Address" htmlFor="add-user-address" className={fieldClass}>
        <textarea
          id="add-user-address"
          className={asicTextarea}
          rows={2}
          value={address}
          onChange={e => setAddress(e.target.value)}
        />
      </AsicFormField>
    </ModalFormSection>
  );

  const locationSection = showLocationSection ? (
    <ModalFormSection
      title="Location *"
      description="Examples: India · Kerala, India · Kochi, Kerala, India · Delhi, India."
    >
      {showSubdivision ? (
        <AsianUnifiedLocationSelect
          country={country}
          province={subdivision}
          locality={locality}
          onChange={next => {
            setCountry(next.country);
            setSubdivision(next.province);
            setLocality(next.locality);
          }}
        />
      ) : null}
      {showIndiaLocation ? (
        <IndiaUnifiedLocationSelect
          state={indiaState}
          city={indiaCity}
          onChange={next => {
            setIndiaState(next.state);
            setIndiaCity(next.city);
          }}
        />
      ) : null}
    </ModalFormSection>
  ) : null;

  const accessSection = showAccessSection ? (
    <ModalFormSection title="Access & settings" description="Portal, region, or workflow options.">
      {showRegion ? (
        <AsicFormField label="Region" htmlFor="add-user-region" className={fieldClass}>
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
      {showRate ? (
        <AsicFormField label="Rate" htmlFor="add-user-rate" className={fieldClass}>
          <input id="add-user-rate" className={asicInput} defaultValue="0" />
        </AsicFormField>
      ) : null}
      {showPassword ? (
        <>
          <AsicFormField label="Password" htmlFor="add-user-password" className={fieldClass}>
            <PasswordInput id="add-user-password" inputClassName={asicInput} autoComplete="new-password" />
          </AsicFormField>
          <AsicFormField label="Confirm password" htmlFor="add-user-confirm-password" className={fieldClass}>
            <PasswordInput id="add-user-confirm-password" inputClassName={asicInput} autoComplete="new-password" />
          </AsicFormField>
        </>
      ) : null}
    </ModalFormSection>
  ) : null;

  const body =
    showLocationSection || showAccessSection ? (
      <ModalTwoColumnLayout
        left={
          <>
            {profileSection}
            {contactSection}
          </>
        }
        right={
          <>
            {locationSection}
            {accessSection}
          </>
        }
      />
    ) : (
      <div className="space-y-6">
        {profileSection}
        {contactSection}
      </div>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-4xl w-[min(95vw,56rem)]"
      zIndexClass={zIndexClass}
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className={asicBtnPrimary}
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
          >
            {isSubmitting ? 'Saving...' : initialData ? 'Save Changes' : 'Create'}
          </button>
        </>
      }
    >
      {body}
    </Modal>
  );
}
