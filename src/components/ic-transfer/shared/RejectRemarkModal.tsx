'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { btnDangerSolid, btnSecondary, formTextarea } from '@/lib/ui';

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (remarks: string) => void;
  onCancel: () => void;
};

export default function RejectRemarkModal({
  open,
  title = 'Reject Order',
  description = 'Please provide a reason for rejection. This will be visible to the admin team.',
  confirmLabel = 'Reject Order',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (open) setRemarks('');
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarks.trim()) return;
    onConfirm(remarks.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      footer={
        <div className="flex w-full justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="submit"
            form="reject-remark-form"
            disabled={loading || !remarks.trim()}
            className={btnDangerSolid}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      }
    >
      <form id="reject-remark-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        <div>
          <label htmlFor="rejection-remarks" className="mb-1.5 block text-sm font-semibold text-slate-900">
            Reason for rejection
          </label>
          <textarea
            id="rejection-remarks"
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={4}
            required
            placeholder="Enter rejection reason..."
            className={formTextarea}
          />
        </div>
      </form>
    </Modal>
  );
}
