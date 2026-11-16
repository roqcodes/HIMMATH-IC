'use client';

import React from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { icPurchaseDenseLabel } from './icTransferFormModalLayout';

const fieldLabel = `${icPurchaseDenseLabel} mb-1`;

export default function ICTransferFormField({
  label,
  children,
  className = '',
  compact = false,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Deposit-style field: no grid col-span — fits inline half-columns. */
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className={className}>
        <label className={fieldLabel}>{label}</label>
        {children}
      </div>
    );
  }
  return (
    <div className={className}>
      <AsicFormField label={label} colSpan={12} labelClassName={fieldLabel}>
        {children}
      </AsicFormField>
    </div>
  );
}
