'use client';

import React from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import { getIndianStateComboOptions } from '@/lib/geo/indiaLocations';

type Props = {
  value: string;
  onChange: (state: string) => void;
  placeholder?: string;
};

export default function IndiaStateSearchSelect({
  value,
  onChange,
  placeholder = 'Search state or union territory…',
}: Props) {
  return (
    <ComboSearchInput
      value={value}
      onChange={onChange}
      onSelectOption={opt => onChange(opt.label)}
      options={[...getIndianStateComboOptions()]}
      placeholder={placeholder}
      inputClassName={asicInput}
    />
  );
}
