'use client';

import React from 'react';
import { filterChip, filterChipActive } from '@/lib/ui';

type Props = {
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

export default function FilterChips({ options, value, onChange }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={value === opt ? filterChipActive : filterChip}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
