'use client';

import React from 'react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { asicBtnPrimary } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { Plus } from '@/components/ic-transfer/sales/sales-icons';

type SalesHeaderProps = {
  salesPaused: boolean;
  canManageGlobalSettings: boolean;
  isTogglingSales: boolean;
  onAddSale: () => void;
  onSalesToggle: (enabled: boolean) => void;
  addDisabled?: boolean;
};

function SalesBadge({ paused }: { paused: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
        paused
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {paused ? 'Paused' : 'Active'}
    </span>
  );
}

function InlineSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-slate-900' : 'bg-slate-200'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function SalesHeader({
  salesPaused,
  canManageGlobalSettings,
  isTogglingSales,
  onAddSale,
  onSalesToggle,
  addDisabled,
}: SalesHeaderProps) {
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const addBlocked = addDisabled || !canWrite;

  return (
    <AsicPageHeader
      title="Sales"
      actions={
        <>
          {canManageGlobalSettings && canWrite ? (
            <>
              <SalesBadge paused={salesPaused} />
              <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/80 px-2 py-0.5">
                <span className="text-[10px] font-medium text-slate-500">Global</span>
                <InlineSwitch
                  checked={!salesPaused}
                  onChange={onSalesToggle}
                  disabled={isTogglingSales}
                  label="Global sales control"
                />
              </div>
            </>
          ) : salesPaused ? (
            <span className="text-[10px] font-medium text-amber-700">Sales paused</span>
          ) : null}
          <button
            type="button"
            onClick={addBlocked ? undefined : onAddSale}
            {...wp({ disabled: addBlocked })}
            className={`${asicBtnPrimary} gap-1.5${addBlocked ? ' cursor-not-allowed opacity-50' : ''}`}
          >
            <Plus className="size-3.5" />
            Add Sale
          </button>
        </>
      }
    />
  );
}
