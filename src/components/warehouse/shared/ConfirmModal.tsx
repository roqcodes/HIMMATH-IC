'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import { btnDangerSolid, btnSecondary, btnSuccessSolid, btnWarningSolid } from '@/lib/ui';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  zIndexClass?: string;
}

export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  zIndexClass,
}: ConfirmModalProps) {
  const confirmBtnClass =
    variant === 'danger' ? btnDangerSolid : variant === 'success' ? btnSuccessSolid : btnWarningSolid;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-sm"
      zIndexClass={zIndexClass}
      footer={
        <div className="flex w-full justify-end gap-3">
          <button type="button" className={btnSecondary} onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={confirmBtnClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
    </Modal>
  );
}
