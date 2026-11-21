'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ComboSearchInput, { type ComboOption } from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import {
  entitySearchOptionsToComboOptions,
  type EntitySearchOption,
} from '@/lib/icTransfer/entitySearchOptions';
import { formatEntitySelectLabel } from '@/lib/validations/entityCode';

type Props = {
  selectedId: string;
  onSelectId: (id: string, option: EntitySearchOption | null) => void;
  options: EntitySearchOption[];
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  className?: string;
  onFocusRefresh?: () => void;
  /** When false, hides the detail line under the input (e.g. stock shown in the field label instead). */
  showDetailLine?: boolean;
  /** Inside the input, before the search icon. */
  inputTrailing?: React.ReactNode;
  createOptionLabel?: (name: string) => string;
  onCreateOption?: (name: string) => Promise<EntitySearchOption | null>;
};

/** Searchable picker that commits a stable entity id (supplier, warehouse, etc.). */
export default function EntitySearchSelect({
  selectedId,
  onSelectId,
  options,
  placeholder = 'Search and select…',
  disabled = false,
  inputClassName = asicInput,
  className = 'w-full',
  onFocusRefresh,
  showDetailLine = true,
  inputTrailing,
  createOptionLabel,
  onCreateOption,
}: Props) {
  const [createdOptions, setCreatedOptions] = useState<EntitySearchOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const allOptions = useMemo(() => {
    const byId = new Map(options.map(option => [option.value, option]));
    for (const option of createdOptions) byId.set(option.value, option);
    return [...byId.values()];
  }, [options, createdOptions]);
  const selected = useMemo(
    () => allOptions.find(o => o.value === selectedId) ?? null,
    [allOptions, selectedId],
  );
  const [draft, setDraft] = useState(selected ? formatEntitySelectLabel(selected.label, selected.code) : '');

  useEffect(() => {
    setDraft(selected ? formatEntitySelectLabel(selected.label, selected.code) : '');
  }, [selected?.label, selected?.code, selectedId]);

  const comboOptions = useMemo(() => entitySearchOptionsToComboOptions(allOptions), [allOptions]);

  return (
    <div className={className}>
      <ComboSearchInput
        value={draft}
        onChange={next => {
          setDraft(next);
          if (selectedId) onSelectId('', null);
        }}
        onSelectOption={(opt: ComboOption) => {
          const match = allOptions.find(o => o.value === opt.value) ?? null;
          if (match) {
            onSelectId(match.value, match);
            setDraft(formatEntitySelectLabel(match.label, match.code));
            onFocusRefresh?.();
          }
        }}
        options={comboOptions}
        selectedValue={selectedId}
        placeholder={placeholder}
        inputClassName={inputClassName}
        className="w-full"
        disabled={disabled}
        onFocus={onFocusRefresh}
        trailing={inputTrailing}
        createOptionLabel={createOptionLabel}
        creatingOption={isCreating}
        onCreateOption={onCreateOption ? async name => {
          if (isCreating) return;
          setIsCreating(true);
          try {
            const created = await onCreateOption(name);
            if (!created) return;
            setCreatedOptions(current => [...current.filter(o => o.value !== created.value), created]);
            onSelectId(created.value, created);
            setDraft(formatEntitySelectLabel(created.label, created.code));
            onFocusRefresh?.();
          } finally {
            setIsCreating(false);
          }
        } : undefined}
      />
      {showDetailLine ? (
        <p
          className={`mt-1 min-h-[1.125rem] text-xs text-slate-500 dark:text-[var(--theme-text-secondary)] ${selected?.detail ? '' : 'invisible'}`}
          aria-hidden={!selected?.detail}
        >
          {selected?.detail ?? '\u00a0'}
        </p>
      ) : null}
    </div>
  );
}
