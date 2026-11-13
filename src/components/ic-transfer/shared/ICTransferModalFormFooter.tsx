'use client';

import React from 'react';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { icPurchaseDenseInput } from '@/components/ic-transfer/shared/icTransferFormModalLayout';

const notesFieldClass = `${asicInput} ${icPurchaseDenseInput} min-h-9 max-h-9 w-full resize-none py-1.5 text-sm leading-snug`;

type Props = {
  onCancel: () => void;
  cancelDisabled?: boolean;
  submitFormId: string;
  submitLabel: string;
  submitDisabled?: boolean;
  notes?: string;
  onNotesChange?: (value: string) => void;
  notesDisabled?: boolean;
  notesId?: string;
  notesPlaceholder?: string;
};

export default function ICTransferModalFormFooter({
  onCancel,
  cancelDisabled,
  submitFormId,
  submitLabel,
  submitDisabled,
  notes,
  onNotesChange,
  notesDisabled,
  notesId = 'ic-transfer-modal-notes',
  notesPlaceholder = 'Internal remark…',
}: Props) {
  const showNotes = Boolean(onNotesChange);

  return (
    <div
      className={`flex w-full min-w-0 gap-2 ${showNotes ? 'flex-col sm:flex-row sm:items-center' : 'flex-col-reverse sm:flex-row sm:justify-end'}`}
    >
      {showNotes ? (
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={notesId}>
            Notes
          </label>
          <textarea
            id={notesId}
            className={notesFieldClass}
            rows={1}
            value={notes ?? ''}
            onChange={e => onNotesChange?.(e.target.value)}
            placeholder={notesPlaceholder}
            disabled={notesDisabled}
          />
        </div>
      ) : null}
      <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:gap-2">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={cancelDisabled}>
          Cancel
        </button>
        <button
          type="submit"
          form={submitFormId}
          className={btnPrimary}
          disabled={submitDisabled}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
