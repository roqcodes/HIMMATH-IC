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
import { saveCounterpartyAction } from '@/app/actions/counterpartyActions';
import type { ICSupplier } from '@/types';

type Props = {
  open: boolean;
  counterparty?: ICSupplier | null;
  branchId?: string;
  branchSlug?: string;
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';

export default function CounterpartyModal({
  open,
  counterparty,
  branchId,
  branchSlug,
  onClose,
  onSaved,
}: Props) {
  const { addICSupplier, updateICSupplier } = useApp();
  const isEdit = Boolean(counterparty?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [subdivision, setSubdivision] = useState('');
  const [locality, setLocality] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (counterparty) {
      setName(counterparty.name || '');
      setCode(counterparty.code || '');
      setPhone(counterparty.phone || '');
      setEmail(counterparty.email || '');
      setAddress(counterparty.address || '');
      setCountry(counterparty.country || '');
      setSubdivision(counterparty.subdivision || '');
      setLocality(counterparty.locality || '');
      setStatus(counterparty.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setAddress('');
      setCountry('');
      setSubdivision('');
      setLocality('');
      setStatus('active');
    }
  }, [open, counterparty]);

  const locationValid = isAsianLocationFormValid(country, subdivision, locality, { requireCountry: true });
  const canSubmit = name.trim().length > 0 && locationValid;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    const countryTrim = country.trim();
    const subdivisionTrim = subdivision.trim();
    const localityTrim = locality.trim();
    const regionId = counterparty?.regionId || '';

    let ok = false;
    if (branchSlug) {
      const res = await saveCounterpartyAction(branchSlug, {
        id: counterparty?.id,
        name: name.trim(),
        code: code.trim() || null,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        country: countryTrim,
        subdivision: subdivisionTrim || undefined,
        locality: localityTrim || undefined,
        status,
      });
      ok = res.success;
      if (!ok && res.error) alert(res.error);
    } else if (isEdit && counterparty) {
      ok = await updateICSupplier(
        counterparty.id,
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
      title={isEdit ? 'Edit counterparty' : 'Add counterparty'}
      maxWidth="max-w-4xl w-[min(95vw,56rem)]"
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className={asicBtnPrimary} onClick={() => void handleSave()} disabled={!canSubmit || isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add counterparty'}
          </button>
        </>
      }
    >
      <ModalTwoColumnLayout
        left={
          <ModalFormSection title="Identity">
            <AsicFormField label="Name *" className={fieldClass}>
              <input className={asicInput} value={name} onChange={e => setName(e.target.value)} />
            </AsicFormField>
            <AsicFormField label="Code" className={fieldClass}>
              <input className={asicInput} value={code} onChange={e => setCode(e.target.value)} />
            </AsicFormField>
            <AsicFormField label="Status" className={fieldClass}>
              <select className={asicInput} value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </AsicFormField>
          </ModalFormSection>
        }
        right={
          <ModalFormSection title="Contact & location">
            <AsicFormField label="Phone" className={fieldClass}>
              <input className={asicInput} value={phone} onChange={e => setPhone(e.target.value)} />
            </AsicFormField>
            <AsicFormField label="Email" className={fieldClass}>
              <input className={asicInput} type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </AsicFormField>
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
            <AsicFormField label="Address" className={fieldClass}>
              <textarea className={modalAddressTextarea} value={address} onChange={e => setAddress(e.target.value)} rows={3} />
            </AsicFormField>
          </ModalFormSection>
        }
      />
    </Modal>
  );
}
