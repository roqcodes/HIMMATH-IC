'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import IndiaUnifiedLocationSelect from '@/components/ui/IndiaUnifiedLocationSelect';
import { asicBtnOutline, asicBtnPrimary, asicInput, modalAddressTextarea } from '@/components/asic/ui';
import { isIndiaWarehouseLocationValid } from '@/lib/geo/locationFormValidation';
import { useApp } from '@/context/AppContext';
import type { ICWarehouse } from '@/types';

type Props = {
  open: boolean;
  warehouse?: ICWarehouse | null;
  branchId?: string | null;
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';

export default function WarehouseModal({ open, warehouse, branchId, onClose, onSaved }: Props) {
  const { addICWarehouse, updateICWarehouse } = useApp();
  const isEdit = Boolean(warehouse?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [indiaState, setIndiaState] = useState('');
  const [indiaCity, setIndiaCity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (warehouse) {
      setName(warehouse.name || '');
      setCode(warehouse.code || '');
      setPhone(warehouse.phone || '');
      setEmail(warehouse.email || '');
      setAddress(warehouse.address || '');
      setIndiaState(warehouse.indiaState || '');
      setIndiaCity(warehouse.indiaCity || '');
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setAddress('');
      setIndiaState('');
      setIndiaCity('');
    }
  }, [open, warehouse]);

  const locationValid = isIndiaWarehouseLocationValid(indiaState, indiaCity);
  const canSubmit = name.trim().length > 0 && indiaState.trim().length > 0 && locationValid;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);

    const stateTrim = indiaState.trim();
    const cityTrim = indiaCity.trim();
    const sendDeliveryProofToCustomer = warehouse ? warehouse.sendDeliveryProofToCustomer !== false : true;

    let ok = false;
    if (isEdit && warehouse) {
      ok = await updateICWarehouse(
        warehouse.id,
        name.trim(),
        code.trim(),
        phone.trim(),
        null,
        '',
        email.trim(),
        address.trim(),
        stateTrim,
        cityTrim,
        sendDeliveryProofToCustomer,
      );
    } else {
      ok = await addICWarehouse(
        name.trim(),
        code.trim(),
        phone.trim(),
        null,
        '',
        email.trim(),
        address.trim(),
        stateTrim,
        cityTrim,
        sendDeliveryProofToCustomer,
        branchId ?? null,
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
      title={isEdit ? 'Edit warehouse' : 'Add warehouse'}
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
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create warehouse'}
          </button>
        </>
      }
    >
      <ModalTwoColumnLayout
        left={
          <ModalFormSection title="Warehouse" description="Name and contact details.">
            <AsicFormField label="Name *" htmlFor="warehouse-name" className={fieldClass}>
              <input
                id="warehouse-name"
                className={asicInput}
                placeholder="e.g. Kochi hub"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </AsicFormField>
            <AsicFormField
              label="Code"
              htmlFor="warehouse-code"
              className={fieldClass}
              hint="Optional short ID for search (letters, numbers, dash, underscore)."
            >
              <input
                id="warehouse-code"
                className={asicInput}
                placeholder="e.g. WH-KOC"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={32}
              />
            </AsicFormField>
            <AsicFormField label="Phone" htmlFor="warehouse-phone" className={fieldClass}>
              <input
                id="warehouse-phone"
                className={asicInput}
                placeholder="+91 98 7654 3210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </AsicFormField>
            <AsicFormField label="Email" htmlFor="warehouse-email" className={fieldClass}>
              <input
                id="warehouse-email"
                type="email"
                className={asicInput}
                placeholder="warehouse@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </AsicFormField>
          </ModalFormSection>
        }
        right={
          <ModalFormSection
            title="Location & address *"
            description="India only. Examples: Kerala · Kochi, Kerala · Mumbai, Maharashtra."
            className="flex min-h-0 flex-1 flex-col lg:h-full"
            contentClassName="min-h-0 flex-1"
          >
            <div className="shrink-0">
              <IndiaUnifiedLocationSelect
                state={indiaState}
                city={indiaCity}
                onChange={next => {
                  setIndiaState(next.state);
                  setIndiaCity(next.city);
                }}
              />
            </div>
            <AsicFormField
              label="Address"
              htmlFor="warehouse-address"
              className={`${fieldClass} flex min-h-0 flex-1 flex-col`}
            >
              <div className="flex min-h-[5rem] flex-1 flex-col">
                <textarea
                  id="warehouse-address"
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
