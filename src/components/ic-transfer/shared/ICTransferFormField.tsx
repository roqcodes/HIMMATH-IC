'use client';

import React from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { icPurchaseDenseLabel } from './icTransferFormModalLayout';

const fieldLabel = `${icPurchaseDenseLabel} mb-1`;

export default function ICTransferFormField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <AsicFormField label={label} colSpan={12} labelClassName={fieldLabel}>
        {children}
      </AsicFormField>
    </div>
  );
}
