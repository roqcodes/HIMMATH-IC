'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import { asicBtnOutline, asicBtnPrimary, asicInput } from '@/components/asic/ui';
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
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (warehouse) {
      setName(warehouse.name || '');
      setCode(warehouse.code || '');
      setPhone(warehouse.phone || '');
      setEmail(warehouse.email || '');
      setStreet(warehouse.address || '');
      setCity(warehouse.indiaCity || '');
      setState(warehouse.indiaState || '');
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setStreet('');
      setCity('');
      setState('');
    }
  }, [open, warehouse]);

  const canSubmit = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);

    const streetTrim = street.trim();
    const cityTrim = city.trim();
    const stateTrim = state.trim();
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
        streetTrim,
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
        streetTrim,
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
          <ModalFormSection title="Address" description="Optional.">
            <AsicFormField label="Street" htmlFor="warehouse-street" className={fieldClass}>
              <input
                id="warehouse-street"
                className={asicInput}
                placeholder="Building, street, area"
                value={street}
                onChange={e => setStreet(e.target.value)}
              />
            </AsicFormField>
            <AsicFormField label="City" htmlFor="warehouse-city" className={fieldClass}>
              <input
                id="warehouse-city"
                className={asicInput}
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </AsicFormField>
            <AsicFormField label="State" htmlFor="warehouse-state" className={fieldClass}>
              <input
                id="warehouse-state"
                className={asicInput}
                value={state}
                onChange={e => setState(e.target.value)}
              />
            </AsicFormField>
          </ModalFormSection>
        }
      />
    </Modal>
  );
}
