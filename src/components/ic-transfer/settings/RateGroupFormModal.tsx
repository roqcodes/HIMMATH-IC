'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import type { ICRateGroup } from '@/types';

export type RateGroupFormValues = {
  name: string;
  country: string;
};

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initialGroup: ICRateGroup | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: RateGroupFormValues) => void | Promise<void>;
};

export default function RateGroupFormModal({
  open,
  mode,
  initialGroup,
  isSaving,
  onClose,
  onSubmit,
}: Props) {
  const isEdit = mode === 'edit';

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initialGroup) {
      setName(initialGroup.name);
      setCountry(initialGroup.country);
    } else {
      setName('');
      setCountry('');
    }
  }, [open, initialGroup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, country });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Rate Group' : 'Create Rate Group'}
      maxWidth="max-w-3xl w-[95vw]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" form="rateGroupForm" className={btnPrimary} disabled={isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </>
      }
    >
      <form id="rateGroupForm" onSubmit={handleSubmit}>
        <div className={asicFormGrid}>
          <AsicFormField label="Group name" colSpan={6}>
            <input
              className={asicInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Premium Asia"
              required
            />
          </AsicFormField>
          <AsicFormField label="Country" colSpan={6}>
            <input className={asicInput} value={country} onChange={e => setCountry(e.target.value)} required />
          </AsicFormField>
        </div>

        {!isEdit ? (
          <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Sale rates are in AED per unit (1 unit = 1 lakh INR). Configure rates via bulk update and assign customers
            using Manage Users.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
