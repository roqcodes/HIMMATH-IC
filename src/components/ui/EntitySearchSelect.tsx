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
}: Props) {
  const selected = useMemo(
    () => options.find(o => o.value === selectedId) ?? null,
    [options, selectedId],
  );
  const [draft, setDraft] = useState(selected ? formatEntitySelectLabel(selected.label, selected.code) : '');

  useEffect(() => {
    setDraft(selected ? formatEntitySelectLabel(selected.label, selected.code) : '');
  }, [selected?.label, selected?.code, selectedId]);

  const comboOptions = useMemo(() => entitySearchOptionsToComboOptions(options), [options]);

  return (
    <div className={className}>
      <ComboSearchInput
        value={draft}
        onChange={next => {
          setDraft(next);
          if (selectedId) onSelectId('', null);
        }}
        onSelectOption={(opt: ComboOption) => {
          const match = options.find(o => o.value === opt.value) ?? null;
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
      />
      <p
        className={`mt-1 min-h-[1.125rem] text-xs text-slate-500 dark:text-[var(--theme-text-secondary)] ${selected?.detail ? '' : 'invisible'}`}
        aria-hidden={!selected?.detail}
      >
        {selected?.detail ?? '\u00a0'}
      </p>
    </div>
  );
}
