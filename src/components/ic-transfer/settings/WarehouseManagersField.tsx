'use client';

import React, { useMemo } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import { useApp } from '@/context/AppContext';
import { filterCounterpartiesForManagers } from '@/lib/icTransfer/branchPortalScope';
import { MANAGER_FIELD_LABEL } from '@/lib/counterparties/labels';

type Props = {
  branchId?: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
  disabled?: boolean;
  variant?: 'warehouse' | 'branch';
  className?: string;
};

export default function WarehouseManagersField({
  branchId,
  selectedIds,
  onChange,
  required,
  disabled,
  variant = 'warehouse',
  className,
}: Props) {
  const hint =
    variant === 'branch'
      ? 'Customers under these managers can deposit at this branch. Purchases and sales use the same scoping.'
      : 'When set, purchase and sale modals only list these managers and their customers.';

  const { icSuppliers } = useApp();

  const managers = useMemo(
    () => filterCounterpartiesForManagers(icSuppliers, branchId ?? undefined),
    [icSuppliers, branchId],
  );

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id],
    );
  };

  if (managers.length === 0) {
    return (
      <AsicFormField label={MANAGER_FIELD_LABEL} hint={hint} className={className}>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Create managers under Managers &amp; Customers before assigning them here.
        </p>
      </AsicFormField>
    );
  }

  return (
    <AsicFormField
      label={required ? `${MANAGER_FIELD_LABEL} *` : MANAGER_FIELD_LABEL}
      hint={hint}
      className={className}
    >
      <ul
        role="group"
        aria-label={MANAGER_FIELD_LABEL}
        className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-slate-900/30"
      >
        {managers.map(m => {
          const checked = selectedIds.includes(m.id);
          return (
            <li key={m.id}>
              <label
                className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors ${
                  checked
                    ? 'bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-600'
                    : 'text-slate-700 hover:bg-white/90 dark:hover:bg-slate-800/60'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(m.id)}
                />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {m.code ? (
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">{m.code}</span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
      {required && selectedIds.length === 0 ? (
        <p className="mt-1.5 text-xs font-medium text-amber-700">Select at least one manager.</p>
      ) : null}
    </AsicFormField>
  );
}
