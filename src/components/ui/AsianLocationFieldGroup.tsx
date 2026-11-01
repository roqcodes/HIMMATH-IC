'use client';

import React from 'react';
import AsicFormField from '@/components/asic/AsicFormField';
import CountrySearchSelect from '@/components/ui/CountrySearchSelect';
import AsianProvinceSearchSelect from '@/components/ui/AsianProvinceSearchSelect';
import AsianLocalitySearchSelect from '@/components/ui/AsianLocalitySearchSelect';

type Props = {
  country: string;
  province: string;
  locality: string;
  onCountryChange: (country: string) => void;
  onProvinceChange: (province: string) => void;
  onLocalityChange: (locality: string) => void;
  countryRequired?: boolean;
};

const fieldClass = 'w-full max-w-none';

export default function AsianLocationFieldGroup({
  country,
  province,
  locality,
  onCountryChange,
  onProvinceChange,
  onLocalityChange,
  countryRequired = true,
}: Props) {
  return (
    <>
      <AsicFormField
        label={countryRequired ? 'Country *' : 'Country'}
        htmlFor="location-country"
        className={fieldClass}
      >
        <CountrySearchSelect
          value={country}
          onChange={next => {
            onCountryChange(next);
            onProvinceChange('');
            onLocalityChange('');
          }}
          placeholder="Search country…"
        />
      </AsicFormField>
      <AsicFormField label="Province / state" htmlFor="location-province" className={fieldClass}>
        <AsianProvinceSearchSelect
          country={country}
          value={province}
          onChange={next => {
            onProvinceChange(next);
            onLocalityChange('');
          }}
        />
      </AsicFormField>
      <AsicFormField label="City / area" htmlFor="location-locality" className={fieldClass}>
        <AsianLocalitySearchSelect
          country={country}
          province={province}
          value={locality}
          onChange={onLocalityChange}
        />
      </AsicFormField>
    </>
  );
}
