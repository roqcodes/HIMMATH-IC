'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import {
  formatLocationDisplay,
  resolveAsianLocationPick,
  searchAsianLocations,
} from '@/lib/geo/asianLocationSearch';

type Props = {
  country: string;
  province: string;
  locality: string;
  onChange: (next: { country: string; province: string; locality: string }) => void;
  id?: string;
};

export default function AsianUnifiedLocationSelect({
  country,
  province,
  locality,
  onChange,
  id = 'location-unified',
}: Props) {
  const committedLabel = useMemo(
    () => formatLocationDisplay(country, province, locality),
    [country, province, locality],
  );
  const [draft, setDraft] = useState(committedLabel);

  useEffect(() => {
    setDraft(committedLabel);
  }, [committedLabel]);

  const options = useMemo(() => {
    return searchAsianLocations(draft, 30).map(p => ({ value: p.value, label: p.label }));
  }, [draft]);

  return (
    <ComboSearchInput
      value={draft}
      onChange={setDraft}
      onSelectOption={opt => {
        const match = resolveAsianLocationPick(opt.value, opt.label);
        onChange({
          country: match.country,
          province: match.province,
          locality: match.locality,
        });
        setDraft(match.label);
      }}
      options={options}
      placeholder="Search country, state, or city…"
      inputClassName={asicInput}
      className="w-full"
    />
  );
}
