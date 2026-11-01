'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import AsianUnifiedLocationSelect from '@/components/ui/AsianUnifiedLocationSelect';
import { asicBtnOutline, asicBtnPrimary, asicInput, modalAddressTextarea } from '@/components/asic/ui';
import { isAsianLocationFormValid } from '@/lib/geo/locationFormValidation';
import { useApp } from '@/context/AppContext';
import type { ICSupplier } from '@/types';

type Props = {
  open: boolean;
  supplier?: ICSupplier | null;
  /** When set, new suppliers are scoped to this branch portal. */
  branchId?: string;
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';

export default function SupplierModal({ open, supplier, branchId, onClose, onSaved }: Props) {
  const { addICSupplier, updateICSupplier } = useApp();
  const isEdit = Boolean(supplier?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [locality, setLocality] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (supplier) {
      setName(supplier.name || '');
      setCode(supplier.code || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setCountry(supplier.country || '');
      setSubdivision(supplier.subdivision || '');
      setLocality(supplier.locality || '');
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCountry('');
      setSubdivision('');
      setLocality('');
    }
  }, [open, supplier]);

  const locationValid = isAsianLocationFormValid(country, subdivision, locality, { requireCountry: true });
  const canSubmit = name.trim().length > 0 && locationValid;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    const countryTrim = country.trim();
    const subdivisionTrim = subdivision.trim();
    const localityTrim = locality.trim();
    const regionId = supplier?.regionId || '';

    let ok = false;
    if (isEdit && supplier) {
      ok = await updateICSupplier(
        supplier.id,
        name.trim(),
        code.trim(),
        phone.trim(),
        null,
        regionId,
        email.trim(),
        address.trim(),
        countryTrim,
        subdivisionTrim,
        localityTrim,
      );
    } else {
      ok = await addICSupplier(
        name.trim(),
        code.trim(),
        phone.trim(),
        null,
        regionId,
        email.trim(),
        address.trim(),
        countryTrim,
        subdivisionTrim,
        localityTrim,
        branchId,
      );
    }
    setIsSaving(false);
    if (ok) {
      onSaved?.();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit supplier' : 'Add supplier'}
      maxWidth="max-w-4xl w-[min(95vw,56rem)]"
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className={asicBtnPrimary}
            onClick={handleSave}
            disabled={isSaving || !canSubmit}
          >
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create supplier'}
          </button>
        </>
      }
    >
      <ModalTwoColumnLayout
        left={
          <ModalFormSection title="Supplier" description="Name and contact details.">
            <AsicFormField label="Name *" htmlFor="supplier-name" className={fieldClass}>
              <input
                id="supplier-name"
                className={asicInput}
                placeholder="e.g. Gulf Bullion Trading LLC"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </AsicFormField>
            <AsicFormField
              label="Code"
              htmlFor="supplier-code"
              className={fieldClass}
              hint="Optional short ID for search (letters, numbers, dash, underscore)."
            >
              <input
                id="supplier-code"
                className={asicInput}
                placeholder="e.g. GBT01"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={32}
              />
            </AsicFormField>
            <AsicFormField label="Phone" htmlFor="supplier-phone" className={fieldClass}>
              <input
                id="supplier-phone"
                className={asicInput}
                placeholder="+971 50 123 4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </AsicFormField>
            <AsicFormField label="Email" htmlFor="supplier-email" className={fieldClass}>
              <input
                id="supplier-email"
                type="email"
                className={asicInput}
                placeholder="supplier@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </AsicFormField>
          </ModalFormSection>
        }
        right={
          <ModalFormSection
            title="Location & address *"
            description="Pick location from search. Examples: India · Kerala, India · Kochi, Kerala, India."
            className="flex min-h-0 flex-1 flex-col lg:h-full"
            contentClassName="min-h-0 flex-1"
          >
            <div className="shrink-0">
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
            </div>
            <AsicFormField
              label="Address"
              htmlFor="supplier-address"
              className={`${fieldClass} flex min-h-0 flex-1 flex-col`}
            >
              <div className="flex min-h-[5rem] flex-1 flex-col">
                <textarea
                  id="supplier-address"
                  className={modalAddressTextarea}
                  placeholder="Building, street, area"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
            </AsicFormField>
          </ModalFormSection>
        }
      />
    </Modal>
  );
}
