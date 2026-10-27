'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/ui/PasswordInput';
import { createBranchAction } from '@/modules/admin/actions';
import { asicFormGrid, asicInput, asicLabel } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { DEFAULT_BRANCH_TIMEZONE } from '@/lib/businessTime';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { PASSWORD_REQUIREMENTS_HINT } from '@/lib/passwordValidation';

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

const emptyForm = {
  name: '',
  slug: '',
  location: '',
  timezone: DEFAULT_BRANCH_TIMEZONE,
  managerName: '',
  managerEmail: '',
  managerPassword: '',
  warehousePortal: true,
  customerPortal: true,
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateBranchModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const createMut = useMutation({
    mutationFn: createBranchAction,
    onSuccess: res => {
      if (!res.success) {
        setError(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setStep(1);
    setForm(emptyForm);
    setError('');
    onClose();
  };

  useEffect(() => {
    if (!open) {
      setStep(1);
      setForm(emptyForm);
      setError('');
    }
  }, [open]);

  const handleCreate = () => {
    if (!canWrite) return;
    setError('');
    createMut.mutate(form);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New branch"
      maxWidth="max-w-4xl w-[95vw]"
      maxHeight="sm:max-h-[min(90dvh,820px)]"
      footer={
        <>
          {step > 1 ? (
            <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={handleClose}>
              Cancel
            </button>
          )}
          {step < 4 ? (
            <button type="button" className={`${btnPrimary} w-full sm:w-auto`} onClick={() => setStep(s => s + 1)}>
              Next
            </button>
          ) : (
            <button
              type="button"
              className={`${btnPrimary} w-full sm:w-auto`}
              onClick={handleCreate}
              {...wp({ disabled: createMut.isPending })}
            >
              {createMut.isPending ? 'Creating…' : 'Create branch'}
            </button>
          )}
        </>
      }
    >
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">Step {step} of 4</p>
      {step === 1 ? (
        <div className={asicFormGrid}>
          <label>
            <span className={asicLabel}>Branch name</span>
            <input
              className={asicInput}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
              disabled={!canWrite}
            />
          </label>
          <label>
            <span className={asicLabel}>URL slug</span>
            <input
              className={asicInput}
              value={form.slug}
              onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
              disabled={!canWrite}
            />
          </label>
          <label>
            <span className={asicLabel}>Location / city</span>
            <input
              className={asicInput}
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              disabled={!canWrite}
            />
          </label>
          <label>
            <span className={asicLabel}>Timezone</span>
            <input
              className={asicInput}
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              disabled={!canWrite}
            />
          </label>
        </div>
      ) : null}
      {step === 2 ? (
        <div className={asicFormGrid}>
          <label>
            <span className={asicLabel}>Manager name</span>
            <input
              className={asicInput}
              value={form.managerName}
              onChange={e => setForm(f => ({ ...f, managerName: e.target.value }))}
              disabled={!canWrite}
            />
          </label>
          <label>
            <span className={asicLabel}>Email</span>
            <input
              className={asicInput}
              type="email"
              value={form.managerEmail}
              onChange={e => setForm(f => ({ ...f, managerEmail: e.target.value }))}
              disabled={!canWrite}
            />
          </label>
          <label>
            <span className={asicLabel}>Temporary password</span>
            <PasswordInput
              inputClassName={asicInput}
              value={form.managerPassword}
              onChange={e => setForm(f => ({ ...f, managerPassword: e.target.value }))}
              disabled={!canWrite}
              placeholder="At least 6 characters, no spaces"
              autoComplete="new-password"
            />
            <p className="mt-1 text-[11px] text-slate-500">{PASSWORD_REQUIREMENTS_HINT}</p>
          </label>
          <p className="text-[11px] text-slate-500 md:col-span-2">Optional. You can assign a branch manager later from Users.</p>
        </div>
      ) : null}
      {step === 3 ? (
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.warehousePortal}
              onChange={e => setForm(f => ({ ...f, warehousePortal: e.target.checked }))}
              disabled={!canWrite}
            />
            Warehouse portal
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.customerPortal}
              onChange={e => setForm(f => ({ ...f, customerPortal: e.target.checked }))}
              disabled={!canWrite}
            />
            Customer portal
          </label>
        </div>
      ) : null}
      {step === 4 ? (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Name</dt>
          <dd>{form.name}</dd>
          <dt className="text-slate-500">Slug</dt>
          <dd className="font-mono text-xs">{form.slug}</dd>
          <dt className="text-slate-500">Location</dt>
          <dd>{form.location}</dd>
          <dt className="text-slate-500">Timezone</dt>
          <dd>{form.timezone}</dd>
          <dt className="text-slate-500">Manager</dt>
          <dd>{form.managerName || 'Assign later'}</dd>
          <dt className="text-slate-500">Portals</dt>
          <dd>
            {[form.warehousePortal && 'Warehouse', form.customerPortal && 'Customer'].filter(Boolean).join(', ') || 'None'}
          </dd>
        </dl>
      ) : null}
    </Modal>
  );
}
