'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
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

export default function BranchModal({ open, branch, onClose, onSaved }: Props) {
  const { addICBranch, updateICBranch } = useApp();
  const isEdit = Boolean(branch?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
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
      setAddress(branch.address || '');
      setTimezone(branch.timezone || 'Asia/Dubai');
      setManagerIds(branch.managerIds ? [...branch.managerIds] : []);
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setAddress('');
      setTimezone('Asia/Dubai');
      setManagerIds([]);
    }
  }, [open, branch]);

  const canSubmit = name.trim().length > 0 && managerIds.length > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    let ok = false;
    if (isEdit && branch) {
      ok = await updateICBranch(
        branch.id,
        name.trim(),
        code.trim(),
        phone.trim(),
        email.trim(),
        address.trim(),
        timezone.trim(),
        managerIds,
      );
    } else {
      ok = await addICBranch(
        name.trim(),
        code.trim(),
        phone.trim(),
        email.trim(),
        address.trim(),
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
      maxWidth="max-w-lg w-[min(95vw,32rem)]"
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
      <ModalFormSection title="Branch" description="UAE cash locker — customer AED deposits.">
        <AsicFormField label="Name *" htmlFor="branch-name" className={fieldClass}>
          <input
            id="branch-name"
            className={asicInput}
            placeholder="e.g. DXB"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </AsicFormField>
        <AsicFormField label="Code" htmlFor="branch-code" className={fieldClass}>
          <input
            id="branch-code"
            className={asicInput}
            placeholder="e.g. DXB"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={32}
          />
        </AsicFormField>
        <AsicFormField label="Timezone" htmlFor="branch-tz" className={fieldClass}>
          <input
            id="branch-tz"
            className={asicInput}
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Phone" htmlFor="branch-phone" className={fieldClass}>
          <input
            id="branch-phone"
            className={asicInput}
            value={phone}
            onChange={e => setPhone(e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Email" htmlFor="branch-email" className={fieldClass}>
          <input
            id="branch-email"
            className={asicInput}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </AsicFormField>
        <AsicFormField label="Address" htmlFor="branch-address" className={fieldClass}>
          <textarea
            id="branch-address"
            className={`${asicInput} min-h-[4rem]`}
            value={address}
            onChange={e => setAddress(e.target.value)}
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
    </Modal>
  );
}
