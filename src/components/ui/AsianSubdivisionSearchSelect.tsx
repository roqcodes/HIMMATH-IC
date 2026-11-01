'use client';

import React, { useMemo } from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { getAsianSubdivisionComboOptions } from '@/lib/countries';

type Props = {
  country: string;
  value: string;
  onChange: (subdivision: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function AsianSubdivisionSearchSelect({
  country,
  value,
  onChange,
  placeholder = 'Search state / province / city…',
  disabled = false,
}: Props) {
  const options = useMemo(
    () => [...getAsianSubdivisionComboOptions(country)],
    [country],
  );

  return (
    <ComboSearchInput
      value={value}
      onChange={onChange}
      onSelectOption={opt => onChange(opt.label)}
      options={options}
      placeholder={country ? placeholder : 'Select a country first'}
      disabled={disabled || !country.trim()}
      inputClassName={asicInput}
    />
  );
}
