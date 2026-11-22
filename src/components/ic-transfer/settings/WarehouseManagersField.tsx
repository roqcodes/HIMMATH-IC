'use client';

import React, { useMemo, useState } from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { filterCounterpartiesForManagers } from '@/lib/icTransfer/branchPortalScope';
import { entitySearchOptionsToComboOptions } from '@/lib/icTransfer/entitySearchOptions';
import { MANAGER_FIELD_LABEL } from '@/lib/counterparties/labels';
import { formatEntitySelectLabel } from '@/lib/validations/entityCode';

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

  const { icSuppliers, quickCreateICCounterparty } = useApp();
  const [searchDraft, setSearchDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const managers = useMemo(
    () => filterCounterpartiesForManagers(icSuppliers, branchId ?? undefined),
    [icSuppliers, branchId],
  );

  const managerById = useMemo(() => new Map(managers.map(m => [m.id, m])), [managers]);

  const managerOptions = useMemo(
    () => managers.map(m => ({ value: m.id, label: m.name, code: m.code })),
    [managers],
  );

  const availableOptions = useMemo(
    () => managerOptions.filter(o => !selectedIds.includes(o.value)),
    [managerOptions, selectedIds],
  );

  const comboOptions = useMemo(
    () => entitySearchOptionsToComboOptions(availableOptions),
    [availableOptions],
  );

  const selectedManagers = useMemo(
    () =>
      selectedIds
        .map(id => managerById.get(id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    [selectedIds, managerById],
  );

  const addManager = (id: string) => {
    if (disabled || !id || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setSearchDraft('');
  };

  const removeManager = (id: string) => {
    if (disabled) return;
    onChange(selectedIds.filter(x => x !== id));
  };

  if (managers.length === 0 && selectedManagers.length === 0) {
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
      <ComboSearchInput
        value={searchDraft}
        onChange={setSearchDraft}
        onSelectOption={opt => addManager(opt.value)}
        options={comboOptions}
        placeholder={availableOptions.length ? 'Search and add manager…' : 'All managers assigned'}
        inputClassName={asicInput}
        className="w-full"
        disabled={disabled || availableOptions.length === 0}
        createOptionLabel={name => `Create manager “${name}”`}
        creatingOption={creating}
        onCreateOption={
          branchId
            ? async name => {
                if (creating || disabled) return;
                setCreating(true);
                try {
                  const created = await quickCreateICCounterparty(name, 'manager', branchId);
                  if (created) addManager(created.id);
                  else setSearchDraft('');
                } finally {
                  setCreating(false);
                }
              }
            : undefined
        }
      />
      {selectedManagers.length > 0 ? (
        <ul
          className="mt-2 max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-700 dark:bg-slate-900/30"
          aria-label="Assigned managers"
        >
          {selectedManagers.map(m => (
            <li key={m.id}>
              <div className="flex w-full items-center gap-2 rounded-md bg-white px-2 py-2 text-sm shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-600">
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                  {formatEntitySelectLabel(m.name, m.code)}
                </span>
                {m.code ? (
                  <span className="hidden shrink-0 font-mono text-[11px] text-slate-400 sm:inline">{m.code}</span>
                ) : null}
                <button
                  type="button"
                  className="shrink-0 rounded px-1.5 text-base leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  onClick={() => removeManager(m.id)}
                  disabled={disabled}
                  aria-label={`Remove ${m.name}`}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-xs text-slate-500">No managers assigned yet.</p>
      )}
      {required && selectedIds.length === 0 ? (
        <p className="mt-1.5 text-xs font-medium text-amber-700">Select at least one manager.</p>
      ) : null}
    </AsicFormField>
  );
}