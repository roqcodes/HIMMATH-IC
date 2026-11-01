'use client';

import React from 'react';
import { ICWarehouse } from '@/types';
import { formatEntitySelectLabel } from '@/lib/validations/entityCode';

export function initialWarehouseSelection(warehouses: ICWarehouse[], preferId?: string) {
  if (preferId && warehouses.some(w => w.id === preferId)) return preferId;
  if (warehouses.length === 1) return warehouses[0]!.id;
  return '';
}

type Props = {
  warehouses: ICWarehouse[];
  value: string;
  onChange: (warehouseId: string) => void;
  getRegionLabel?: (regionId?: string) => string | undefined;
  /** Shown as a subtle badge when reassigning (not the active selection). */
  currentWarehouseId?: string;
  disabled?: boolean;
  /** Radio group name (unique per form). */
  name?: string;
};

const optionClass =
  'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-[var(--theme-accent)]/40 has-[:checked]:border-[var(--theme-accent)] has-[:checked]:bg-[var(--theme-accent)]/5 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:hover:border-[var(--theme-accent)]/50 dark:has-[:checked]:bg-[var(--theme-accent)]/10';

export default function WarehouseAssignPicker({
  warehouses,
  value,
  onChange,
  getRegionLabel,
  currentWarehouseId,
  disabled = false,
  name = 'warehouse-assign',
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Select warehouse"
      className="max-h-[min(18rem,50vh)] space-y-2 overflow-y-auto overscroll-contain pr-0.5"
    >
      {warehouses.map(w => {
        const selected = value === w.id;
        const isAssigned = currentWarehouseId === w.id;
        const region = getRegionLabel?.(w.regionId);
        const meta = [
          region,
          w.phone,
          w.currentStock != null ? `${w.currentStock.toLocaleString()} units in stock` : null,
        ]
          .filter(Boolean)
          .join(' · ');

        return (
          <label key={w.id} className={[optionClass, disabled ? 'pointer-events-none opacity-60' : ''].join(' ')}>
            <input
              type="radio"
              name={name}
              value={w.id}
              checked={selected}
              onChange={() => onChange(w.id)}
              disabled={disabled}
              className="mt-0.5 shrink-0 accent-[var(--theme-accent)]"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">
                  {formatEntitySelectLabel(w.name, w.code)}
                </span>
                {isAssigned && !selected ? (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-800/50">
                    Current
                  </span>
                ) : null}
              </span>
              {meta ? (
                <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-[var(--theme-text-secondary)]">
                  {meta}
                </span>
              ) : w.address ? (
                <span className="mt-0.5 block text-xs leading-snug text-slate-500 dark:text-[var(--theme-text-secondary)]">
                  {w.address}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
