'use client';

import React, { useMemo } from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { getAsianProvinceComboOptions } from '@/lib/countries';

type Props = {
  country: string;
  value: string;
  onChange: (province: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export default function AsianProvinceSearchSelect({
  country,
  value,
  onChange,
  placeholder = 'Search province / state / emirate…',
  disabled = false,
}: Props) {
  const options = useMemo(() => [...getAsianProvinceComboOptions(country)], [country]);

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
