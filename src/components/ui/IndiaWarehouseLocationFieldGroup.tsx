'use client';

import React from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import IndiaStateSearchSelect from '@/components/ui/IndiaStateSearchSelect';
import IndiaCitySearchSelect from '@/components/ui/IndiaCitySearchSelect';
import { isKnownIndianCity } from '@/lib/geo/indiaLocations';

type Props = {
  state: string;
  city: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
};

const fieldClass = 'w-full max-w-none';

export default function IndiaWarehouseLocationFieldGroup({
  state,
  city,
  onStateChange,
  onCityChange,
}: Props) {
  return (
    <>
      <AsicFormField label="State *" htmlFor="warehouse-india-state" className={fieldClass}>
        <IndiaStateSearchSelect
          value={state}
          onChange={next => {
            onStateChange(next);
            if (city && !isKnownIndianCity(next, city)) {
              onCityChange('');
            }
          }}
        />
      </AsicFormField>
      <AsicFormField label="City" htmlFor="warehouse-india-city" className={fieldClass}>
        <IndiaCitySearchSelect state={state} value={city} onChange={onCityChange} />
      </AsicFormField>
    </>
  );
}
