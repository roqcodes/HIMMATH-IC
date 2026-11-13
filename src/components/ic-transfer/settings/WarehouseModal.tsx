'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import { asicBtnOutline, asicBtnPrimary, asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { parseFormAmount } from '@/lib/parseFormAmount';
import type { ICWarehouse } from '@/types';
import WarehouseManagersField from '@/components/ic-transfer/settings/WarehouseManagersField';

type Props = {
  open: boolean;
  warehouse?: ICWarehouse | null;
  branchId?: string | null;
  defaultDeskKind?: 'warehouse' | 'branch';
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';

export default function WarehouseModal({
  open,
  warehouse,
  branchId,
  defaultDeskKind = 'warehouse',
  onClose,
  onSaved,
}: Props) {
  const { addICWarehouse, updateICWarehouse } = useApp();
  const isEdit = Boolean(warehouse?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [openingMetalG, setOpeningMetalG] = useState('0');
  const [openingAed, setOpeningAed] = useState('0');
  const [openingInr, setOpeningInr] = useState('0');
  const [openingStock, setOpeningStock] = useState('0');
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const deskKind = warehouse?.deskKind ?? defaultDeskKind;
  const isBranchDesk = deskKind === 'branch';

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
      setOpeningMetalG(String(warehouse.openingMetalG ?? 0));
      setOpeningAed(String(warehouse.openingAed ?? 0));
      setOpeningInr(String(warehouse.openingInr ?? 0));
      setOpeningStock(String(warehouse.openingStock ?? 0));
      setManagerIds(warehouse.managerIds ? [...warehouse.managerIds] : []);
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setStreet('');
      setCity('');
      setState('');
      setOpeningMetalG('0');
      setOpeningAed('0');
      setOpeningInr('0');
      setOpeningStock('0');
      setManagerIds([]);
    }
  }, [open, warehouse]);

  const canSubmit =
    name.trim().length > 0 && (!isBranchDesk || managerIds.length > 0);

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);

    const streetTrim = street.trim();
    const cityTrim = city.trim();
    const stateTrim = state.trim();
    const sendDeliveryProofToCustomer = warehouse ? warehouse.sendDeliveryProofToCustomer !== false : true;
    const metalG = parseFormAmount(openingMetalG);
    const aed = parseFormAmount(openingAed);
    const inr = parseFormAmount(openingInr);
    const stock = parseFormAmount(openingStock);
    if (metalG === null || aed === null || inr === null || stock === null) {
      alert('Enter valid opening balances');
      setIsSaving(false);
      return;
    }
    if (metalG < 0 || stock < 0) {
      alert('Opening metal and IC units cannot be negative');
      setIsSaving(false);
      return;
    }
    const openings = {
      openingMetalG: metalG,
      openingAed: aed,
      openingInr: inr,
      openingStock: stock,
    };

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
        openings,
        managerIds,
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
        openings,
        defaultDeskKind,
        managerIds,
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
      title={
        isEdit
          ? defaultDeskKind === 'branch'
            ? 'Edit branch'
            : 'Edit warehouse'
          : defaultDeskKind === 'branch'
            ? 'Add branch'
            : 'Add warehouse'
      }
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
            <WarehouseManagersField
              branchId={branchId ?? warehouse?.branchId}
              selectedIds={managerIds}
              onChange={setManagerIds}
              required={isBranchDesk}
              variant={isBranchDesk ? 'branch' : 'warehouse'}
              disabled={isSaving}
              className={fieldClass}
            />
          </ModalFormSection>
        }
        right={
          <>
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
            <ModalFormSection
              title="Opening balances"
              description="Starting metal, cash books, and IC units. AED/INR lock after ledger entries exist."
            >
              <AsicFormField label="Opening metal (g)" htmlFor="warehouse-opening-metal" className={fieldClass}>
                <input
                  id="warehouse-opening-metal"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingMetalG}
                  onChange={e => setOpeningMetalG(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField label="Opening AED" htmlFor="warehouse-opening-aed" className={fieldClass}>
                <input
                  id="warehouse-opening-aed"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingAed}
                  onChange={e => setOpeningAed(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField label="Opening INR" htmlFor="warehouse-opening-inr" className={fieldClass}>
                <input
                  id="warehouse-opening-inr"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingInr}
                  onChange={e => setOpeningInr(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField
                label="Opening IC units"
                htmlFor="warehouse-opening-stock"
                className={fieldClass}
                hint="On-hand IC balance before recorded deals."
              >
                <input
                  id="warehouse-opening-stock"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingStock}
                  onChange={e => setOpeningStock(e.target.value)}
                />
              </AsicFormField>
            </ModalFormSection>
          </>
        }
      />
    </Modal>
  );
}
