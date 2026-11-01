'use client';

import React, { useMemo } from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { getIndianCityComboOptions } from '@/lib/geo/indiaLocations';

type Props = {
  state: string;
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
};

export default function IndiaCitySearchSelect({
  state,
  value,
  onChange,
  placeholder = 'Search city…',
}: Props) {
  const options = useMemo(() => [...getIndianCityComboOptions(state)], [state]);

  return (
    <ComboSearchInput
      value={value}
      onChange={onChange}
      onSelectOption={opt => onChange(opt.label)}
      options={options}
      placeholder={state ? placeholder : 'Select a state first (optional)'}
      disabled={!state.trim()}
      inputClassName={asicInput}
    />
  );
}
