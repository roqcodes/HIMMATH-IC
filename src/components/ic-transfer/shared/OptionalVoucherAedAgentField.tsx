'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { listIcAedAgentsAction } from '@/app/actions/aedAgentActions';
import { icPurchaseDenseInput, icPurchaseDenseLabel } from '@/components/ic-transfer/shared/icTransferFormModalLayout';
import { asicInput } from '@/components/asic/ui';
import type { EntitySearchOption } from '@/lib/icTransfer/entitySearchOptions';
import { entitySearchOptionsToComboOptions } from '@/lib/icTransfer/entitySearchOptions';

type Props = {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
  open: boolean;
};

export default function OptionalVoucherAedAgentField({
  value,
  onChange,
  disabled,
  className = '',
  open,
}: Props) {
  const [options, setOptions] = useState<EntitySearchOption[]>([]);
  const denseInput = `${asicInput} ${icPurchaseDenseInput}`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void listIcAedAgentsAction(true).then(agents => {
      if (cancelled) return;
      setOptions(
        agents.map(a => ({
          value: a.id,
          label: a.name,
          detail: a.phone?.trim() || undefined,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const comboOptions = useMemo(() => entitySearchOptionsToComboOptions(options), [options]);

  return (
    <div className={`min-w-0 w-full ${className}`.trim()}>
      <AsicFormField
        label="Collection agent (optional)"
        colSpan={12}
        labelClassName={`${icPurchaseDenseLabel} mb-1`}
        hint="UAE agent linked to this payment or receipt — for reporting."
      >
        <EntitySearchSelect
          selectedId={value}
          onSelectId={onChange}
          options={comboOptions}
          placeholder="None — search agent…"
          inputClassName={denseInput}
          showDetailLine={false}
          disabled={disabled}
        />
      </AsicFormField>
    </div>
  );
}