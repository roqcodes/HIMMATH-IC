'use client';

import React, { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import { asicBtnOutline, asicBtnPrimary, asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { parseFormAmount } from '@/lib/parseFormAmount';
import type { ICWarehouse } from '@/types';
import WarehouseManagersField from '@/components/ic-transfer/settings/WarehouseManagersField';
import {
  computeIcCashAedTotal,
  computeIcCashRateFromTotals,
  formatAmount,
  formatRateInputValue,
  INR_PER_UNIT,
  parseRateInputValue,
} from '@/lib/icTransfer/rateCalculations';
import { icPurchaseReadOnlyInput } from '@/components/ic-transfer/shared/icTransferFormModalLayout';

type Props = {
  open: boolean;
  warehouse?: ICWarehouse | null;
  branchId?: string | null;
  defaultDeskKind?: 'warehouse' | 'branch';
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';
const OPENING_AVG_RATE_DECIMALS = 2;

function roundOpeningAvgRate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(OPENING_AVG_RATE_DECIMALS));
}

function formatOpeningAvgRate(value: number): string {
  if (!Number.isFinite(value)) return '';
  return roundOpeningAvgRate(value).toFixed(OPENING_AVG_RATE_DECIMALS);
}

function parseOpeningAvgRateInput(value: string): number | null {
  const parsed = parseRateInputValue(value);
  if (parsed === null) return null;
  return roundOpeningAvgRate(parsed);
}

export default function WarehouseModal({
  open,
  warehouse,
  branchId,
  defaultDeskKind = 'warehouse',
  onClose,
  onSaved,
}: Props) {
  const { addICWarehouse, updateICWarehouse, deleteICWarehouse } = useApp();
  const isEdit = Boolean(warehouse?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [openingMetalG, setOpeningMetalG] = useState('0');
  const [openingInr, setOpeningInr] = useState('0');
  const [openingAvgRate, setOpeningAvgRate] = useState('');
  const [openingAed, setOpeningAed] = useState('0');
  const skipAedAutofillRef = useRef(false);
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deskKind = warehouse?.deskKind ?? defaultDeskKind;
  const isBranchDesk = deskKind === 'branch';
  const openingInrAmount = parseFormAmount(openingInr) ?? 0;
  const openingIcStock = openingInrAmount > 0 ? openingInrAmount / INR_PER_UNIT : 0;
  const openingUnitsDisplay =
    openingIcStock > 0 ? formatRateInputValue(openingIcStock, 8) : '0';

  const autofillOpeningAed = (inrStr: string, rateStr: string) => {
    const inr = parseFormAmount(inrStr) ?? 0;
    const rate = parseOpeningAvgRateInput(rateStr) ?? 0;
    const stock = inr > 0 ? inr / INR_PER_UNIT : 0;
    setOpeningAed(formatAmount(computeIcCashAedTotal(stock, rate)));
  };

  useEffect(() => {
    if (!open) return;
    skipAedAutofillRef.current = true;
    if (warehouse) {
      setName(warehouse.name || '');
      setCode(warehouse.code || '');
      setPhone(warehouse.phone || '');
      setEmail(warehouse.email || '');
      setStreet(warehouse.address || '');
      setCity(warehouse.indiaCity || '');
      setState(warehouse.indiaState || '');
      setOpeningMetalG(String(warehouse.openingMetalG ?? 0));
      setOpeningInr(String(warehouse.openingInr ?? 0));
      const stock =
        Number(warehouse.openingStock) > 0
          ? Number(warehouse.openingStock)
          : (Number(warehouse.openingInr) || 0) / INR_PER_UNIT;
      const aed = Number(warehouse.openingAed) || 0;
      const impliedRate = stock > 0 && aed > 0 ? computeIcCashRateFromTotals(stock, aed) : 0;
      setOpeningAvgRate(impliedRate > 0 ? formatOpeningAvgRate(impliedRate) : '');
      setOpeningAed(formatAmount(aed));
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
      setOpeningInr('0');
      setOpeningAvgRate('');
      setOpeningAed('0');
      setManagerIds([]);
    }
  }, [open, warehouse]);

  useEffect(() => {
    if (!open) return;
    if (skipAedAutofillRef.current) {
      skipAedAutofillRef.current = false;
      return;
    }
    autofillOpeningAed(openingInr, openingAvgRate);
  }, [open, openingInr, openingAvgRate]);

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
    const inr = parseFormAmount(openingInr);
    const avgRate = parseOpeningAvgRateInput(openingAvgRate);
    if (metalG === null || inr === null) {
      alert('Enter valid opening balances');
      setIsSaving(false);
      return;
    }
    if (metalG < 0 || inr < 0) {
      alert('Opening metal and INR opening cannot be negative');
      setIsSaving(false);
      return;
    }
    const stock = inr / INR_PER_UNIT;
    if (inr > 0 && (avgRate === null || avgRate < 0)) {
      alert('Enter opening average rate (AED per IC unit)');
      setIsSaving(false);
      return;
    }
    const aed = parseFormAmount(openingAed);
    if (aed === null) {
      alert('Enter valid opening AED');
      setIsSaving(false);
      return;
    }
    if (aed < 0) {
      alert('Opening AED cannot be negative');
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

  const handleDelete = async () => {
    if (!warehouse || !window.confirm(`Delete ${warehouse.name}? This is allowed only when it has no associated transactions, ledger entries, or stock.`)) return;
    setIsDeleting(true);
    const ok = await deleteICWarehouse(warehouse.id);
    setIsDeleting(false);
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
          {isEdit ? (
            <button
              type="button"
              className="mr-auto rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={() => void handleDelete()}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? 'Deleting…' : isBranchDesk ? 'Delete branch' : 'Delete warehouse'}
            </button>
          ) : null}
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={isSaving || isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className={asicBtnPrimary}
            onClick={handleSave}
            disabled={isSaving || isDeleting || !canSubmit}
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
              description="INR and AED books; AED autofills from units × rate but can be overridden. Balances lock after ledger entries exist."
            >
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
                label="Avg rate (AED / unit)"
                htmlFor="warehouse-opening-rate"
                className={fieldClass}
                hint={`Sheet rate per IC unit (1 unit = ₹${INR_PER_UNIT.toLocaleString('en-IN')}). AED opening = units × rate × 100.`}
              >
                <input
                  id="warehouse-opening-rate"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingAvgRate}
                  onChange={e => setOpeningAvgRate(e.target.value)}
                  onBlur={() => {
                    const r = parseOpeningAvgRateInput(openingAvgRate);
                    if (r === null) return;
                    setOpeningAvgRate(formatOpeningAvgRate(r));
                  }}
                  placeholder="e.g. 36.50"
                />
              </AsicFormField>
              <AsicFormField
                label="Opening IC units"
                htmlFor="warehouse-opening-stock"
                className={fieldClass}
                hint={`From INR opening ÷ ₹${INR_PER_UNIT.toLocaleString('en-IN')}.`}
              >
                <input
                  id="warehouse-opening-stock"
                  className={`${asicInput} ${icPurchaseReadOnlyInput} tabular-nums w-full`}
                  value={openingUnitsDisplay}
                  readOnly
                  aria-readonly
                />
              </AsicFormField>
              <AsicFormField
                label="Opening AED"
                htmlFor="warehouse-opening-aed"
                className={fieldClass}
                hint="Autofilled from IC units and avg rate; edit if needed."
              >
                <input
                  id="warehouse-opening-aed"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingAed}
                  onChange={e => setOpeningAed(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField label="Opening metal (g)" htmlFor="warehouse-opening-metal" className={fieldClass}>
                <input
                  id="warehouse-opening-metal"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingMetalG}
                  onChange={e => setOpeningMetalG(e.target.value)}
                />
              </AsicFormField>
            </ModalFormSection>
          </>
        }
      />
    </Modal>
  );
}
