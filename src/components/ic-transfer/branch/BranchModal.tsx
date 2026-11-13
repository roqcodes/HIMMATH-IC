'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import { asicBtnOutline, asicBtnPrimary, asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import type { ICBranch } from '@/types';
import WarehouseManagersField from '@/components/ic-transfer/settings/WarehouseManagersField';

type Props = {
  open: boolean;
  branch?: ICBranch | null;
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';

function composeBranchAddress(street: string, city: string, area: string): string {
  return [street, city, area].map(s => s.trim()).filter(Boolean).join(', ');
}

function parseStoredBranchAddress(raw?: string | null): {
  street: string;
  city: string;
  area: string;
} {
  const parts = (raw || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { street: '', city: '', area: '' };
  if (parts.length === 1) return { street: parts[0]!, city: '', area: '' };
  if (parts.length === 2) return { street: parts[0]!, city: parts[1]!, area: '' };
  return { street: parts[0]!, city: parts[1]!, area: parts.slice(2).join(', ') };
}

export default function BranchModal({ open, branch, onClose, onSaved }: Props) {
  const { addICBranch, updateICBranch } = useApp();
  const isEdit = Boolean(branch?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [timezone, setTimezone] = useState('Asia/Dubai');
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (branch) {
      setName(branch.name || '');
      setCode(branch.code || '');
      setPhone(branch.phone || '');
      setEmail(branch.email || '');
      const addr = parseStoredBranchAddress(branch.address);
      setStreet(addr.street);
      setCity(addr.city);
      setArea(addr.area);
      setTimezone(branch.timezone || 'Asia/Dubai');
      setManagerIds(branch.managerIds ? [...branch.managerIds] : []);
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setStreet('');
      setCity('');
      setArea('');
      setTimezone('Asia/Dubai');
      setManagerIds([]);
    }
  }, [open, branch]);

  const canSubmit = name.trim().length > 0 && managerIds.length > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    const address = composeBranchAddress(street, city, area);

    let ok = false;
    if (isEdit && branch) {
      ok = await updateICBranch(
        branch.id,
        name.trim(),
        code.trim(),
        phone.trim(),
        email.trim(),
        address,
        timezone.trim(),
        managerIds,
      );
    } else {
      ok = await addICBranch(
        name.trim(),
        code.trim(),
        phone.trim(),
        email.trim(),
        address,
        timezone.trim(),
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
      title={isEdit ? 'Edit branch' : 'Add branch'}
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
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create branch'}
          </button>
        </>
      }
    >
      <ModalTwoColumnLayout
        left={
          <ModalFormSection
            title="Branch"
            description="UAE shop — customer AED deposits and branch cash till."
          >
            <AsicFormField label="Name *" htmlFor="branch-name" className={fieldClass}>
              <input
                id="branch-name"
                className={asicInput}
                placeholder="e.g. Dubai Marina"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </AsicFormField>
            <AsicFormField
              label="Code"
              htmlFor="branch-code"
              className={fieldClass}
              hint="Optional short ID for search (letters, numbers, dash, underscore)."
            >
              <input
                id="branch-code"
                className={asicInput}
                placeholder="e.g. DXB-MRN"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                maxLength={32}
              />
            </AsicFormField>
            <AsicFormField label="Phone" htmlFor="branch-phone" className={fieldClass}>
              <input
                id="branch-phone"
                className={asicInput}
                placeholder="+971 50 123 4567"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </AsicFormField>
            <AsicFormField label="Email" htmlFor="branch-email" className={fieldClass}>
              <input
                id="branch-email"
                type="email"
                className={asicInput}
                placeholder="branch@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </AsicFormField>
            <WarehouseManagersField
              selectedIds={managerIds}
              onChange={setManagerIds}
              required
              variant="branch"
              disabled={isSaving}
              className={fieldClass}
            />
          </ModalFormSection>
        }
        right={
          <>
            <ModalFormSection title="Address" description="Optional shop location.">
              <AsicFormField label="Street / building" htmlFor="branch-street" className={fieldClass}>
                <input
                  id="branch-street"
                  className={asicInput}
                  placeholder="Building, street, area"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField label="City" htmlFor="branch-city" className={fieldClass}>
                <input
                  id="branch-city"
                  className={asicInput}
                  placeholder="e.g. Dubai"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField label="Emirate / state" htmlFor="branch-area" className={fieldClass}>
                <input
                  id="branch-area"
                  className={asicInput}
                  placeholder="e.g. Dubai"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                />
              </AsicFormField>
            </ModalFormSection>
            <ModalFormSection
              title="Operations"
              description="Business-day boundaries for deposits and desk vouchers."
            >
              <AsicFormField
                label="Timezone"
                htmlFor="branch-tz"
                className={fieldClass}
                hint="IANA name — usually Asia/Dubai for UAE branches."
              >
                <input
                  id="branch-tz"
                  className={asicInput}
                  placeholder="Asia/Dubai"
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                />
              </AsicFormField>
              {isEdit && branch?.cashBalance != null ? (
                <AsicFormField
                  label="Cash till (AED)"
                  htmlFor="branch-till-readonly"
                  className={fieldClass}
                  hint="Updated by customer deposits — edit balances via IC Funds if needed."
                >
                  <input
                    id="branch-till-readonly"
                    className={`${asicInput} cursor-not-allowed tabular-nums bg-slate-50 text-slate-700`}
                    readOnly
                    disabled
                    value={Number(branch.cashBalance).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  />
                </AsicFormField>
              ) : null}
            </ModalFormSection>
          </>
        }
      />
    </Modal>
  );
}
