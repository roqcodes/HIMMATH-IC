'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import { asicInput } from '@/components/asic/ui';
import {
  formatIndiaLocationDisplay,
  resolveIndiaLocationPick,
  searchIndiaLocations,
} from '@/lib/geo/indiaLocationSearch';

type Props = {
  state: string;
  city: string;
  onChange: (next: { state: string; city: string }) => void;
  id?: string;
};

export default function IndiaUnifiedLocationSelect({ state, city, onChange, id = 'warehouse-location' }: Props) {
  const committedLabel = useMemo(() => formatIndiaLocationDisplay(state, city), [state, city]);
  const [draft, setDraft] = useState(committedLabel);

  useEffect(() => {
    setDraft(committedLabel);
  }, [committedLabel]);

  const options = useMemo(() => {
    return searchIndiaLocations(draft, 30).map(p => ({ value: p.value, label: p.label }));
  }, [draft]);

  return (
    <ComboSearchInput
      value={draft}
      onChange={setDraft}
      onSelectOption={opt => {
        const match = resolveIndiaLocationPick(opt.value, opt.label);
        onChange({ state: match.state, city: match.city });
        setDraft(match.label);
      }}
      options={options}
      placeholder="Search state or city in India…"
      inputClassName={asicInput}
      className="w-full"
    />
  );
}
