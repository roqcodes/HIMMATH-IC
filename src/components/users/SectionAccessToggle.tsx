'use client';

import React from 'react';
import type { PageAccessLevel } from '@/types';

const LEVELS: { value: PageAccessLevel; label: string; title: string }[] = [
  { value: 'none', label: '—', title: 'No access' },
  { value: 'read', label: 'R', title: 'Read only' },
  { value: 'write', label: 'W', title: 'Read & write' },
];

type Props = {
  label: string;
  value: PageAccessLevel;
  onChange: (level: PageAccessLevel) => void;
  disabled?: boolean;
};

export default function SectionAccessToggle({ label, value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-2 min-w-0 rounded-md border border-slate-100 bg-white px-2 py-1.5">
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700" title={label}>
        {label}
      </span>
      <div
        className="flex shrink-0 rounded-md border border-slate-200 bg-slate-50 p-0.5"
        role="group"
        aria-label={`${label} access`}
      >
        {LEVELS.map(level => {
          const active = value === level.value;
          return (
            <button
              key={level.value}
              type="button"
              disabled={disabled}
              title={level.title}
              aria-pressed={active}
              onClick={() => onChange(level.value)}
              className={`min-w-[26px] rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 ${
                active
                  ? level.value === 'write'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : level.value === 'read'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-white hover:text-slate-900'
              }`}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
