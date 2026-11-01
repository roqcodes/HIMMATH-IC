'use client';

import React, { useMemo } from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { getAsianLocalityComboOptions } from '@/lib/countries';

type Props = {
  country: string;
  province: string;
  value: string;
  onChange: (locality: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function AsianLocalitySearchSelect({
  country,
  province,
  value,
  onChange,
  placeholder = 'Search city / governorate / district…',
  disabled = false,
}: Props) {
  const options = useMemo(
    () => [...getAsianLocalityComboOptions(country, province)],
    [country, province],
  );

  return (
    <ComboSearchInput
      value={value}
      onChange={onChange}
      onSelectOption={opt => onChange(opt.label)}
      options={options}
      placeholder={province ? placeholder : 'Select a province first'}
      disabled={disabled || !province.trim()}
      inputClassName={asicInput}
    />
  );
}
