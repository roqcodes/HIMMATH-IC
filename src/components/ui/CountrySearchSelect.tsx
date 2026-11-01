'use client';

import React from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { getCountryComboOptions } from '@/lib/countries';

type Props = {
  id?: string;
  value: string;
  onChange: (country: string) => void;
  placeholder?: string;
};

export default function CountrySearchSelect({
  value,
  onChange,
  placeholder = 'Search country…',
}: Props) {
  return (
    <ComboSearchInput
      value={value}
      onChange={onChange}
      onSelectOption={opt => onChange(opt.label)}
      options={[...getCountryComboOptions()]}
      placeholder={placeholder}
      inputClassName={asicInput}
    />
  );
}
