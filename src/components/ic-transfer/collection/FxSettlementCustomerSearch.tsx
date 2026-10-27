'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formInput } from '@/lib/ui';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

export type FxCustomerSearchItem = {
  key: string;
  name: string;
  orderCustomerId?: string;
  saleCount: number;
  totalRemaining: number;
  totalAed: number;
  avgSaleRate: number;
  avgSaleFx: number;
  currency: string;
  oldestSaleLabel?: string;
};

type Props = {
  customers: FxCustomerSearchItem[];
  value: string;
  onChange: (customerKey: string) => void;
  disabled?: boolean;
};

function matchCustomer(item: FxCustomerSearchItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (item.name.toLowerCase().includes(q)) return true;
  if (item.orderCustomerId?.toLowerCase().includes(q)) return true;
  if (item.oldestSaleLabel?.toLowerCase().includes(q)) return true;
  return false;
}

function CustomerInitial({ name }: { name: string }) {
  const letter = (name.trim()[0] || '?').toUpperCase();
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white shadow-surface-xs"
      aria-hidden
    >
      {letter}
    </span>
  );
}

function StatPill({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'amber' | 'blue';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200/80 bg-amber-50/80 text-amber-900'
      : tone === 'blue'
        ? 'border-blue-200/80 bg-blue-50/80 text-blue-900'
        : 'border-slate-200 bg-slate-50 text-slate-800';

  return (
    <div className={`rounded-md border px-2 py-1 ${toneClass}`}>
      <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="font-mono text-[11px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CustomerResultCard({
  item,
  selected,
  active,
  onSelect,
  id,
}: {
  item: FxCustomerSearchItem;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  id: string;
}) {
  return (
    <button
      type="button"
      id={id}
      role="option"
      aria-selected={selected}
      onMouseDown={e => e.preventDefault()}
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] ${
        selected
          ? 'border-slate-900 bg-slate-900/[0.03] shadow-sm ring-1 ring-slate-900/10'
          : active
            ? 'border-slate-300 bg-white shadow-sm'
            : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <CustomerInitial name={item.name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
            {selected ? (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Selected
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {item.saleCount} open sale{item.saleCount === 1 ? '' : 's'}
            {item.oldestSaleLabel ? ` · oldest ${item.oldestSaleLabel}` : ''}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <StatPill
              label="Remaining"
              value={`${formatFxAmount(item.totalRemaining)} ${item.currency}`}
              tone="amber"
            />
            <StatPill label="AED exp." value={`${formatFxAmount(item.totalAed)} AED`} />
            <StatPill label="Avg FX" value={formatFxAmount(item.avgSaleFx)} tone="blue" />
            <StatPill label="Avg rate" value={`${formatFxAmount(item.avgSaleRate)}/u`} />
          </div>
        </div>
      </div>
    </button>
  );
}

export default function FxSettlementCustomerSearch({
  customers,
  value,
  onChange,
  disabled = false,
}: Props) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = useMemo(
    () => customers.find(c => c.key === value) ?? null,
    [customers, value],
  );

  const filtered = useMemo(
    () => customers.filter(c => matchCustomer(c, query)),
    [customers, query],
  );

  const updateMenuPosition = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openBelow = spaceBelow >= 220 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(160, Math.min(420, openBelow ? spaceBelow : spaceAbove));
    const top = openBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - gap - maxHeight);

    setMenuStyle({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  };

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const onLayout = () => updateMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open, query, filtered.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
    setQuery('');
  };

  const clearSelection = () => {
    onChange('');
    setQuery('');
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && filtered[activeIndex]) {
      e.preventDefault();
      pick(filtered[activeIndex].key);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="space-y-2">
      <label htmlFor={`${listboxId}-input`} className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
        Customer
      </label>

      {selected && !open ? (
        <div className="rounded-xl border border-slate-900/15 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <CustomerInitial name={selected.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {selected.saleCount} open sale{selected.saleCount === 1 ? '' : 's'} · FIFO from{' '}
                    {selected.oldestSaleLabel || 'oldest deal'}
                  </p>
                </div>
                {!disabled ? (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline"
                    onClick={clearSelection}
                  >
                    Change
                  </button>
                ) : null}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <StatPill
                  label="Remaining"
                  value={`${formatFxAmount(selected.totalRemaining)} ${selected.currency}`}
                  tone="amber"
                />
                <StatPill label="AED exp." value={`${formatFxAmount(selected.totalAed)} AED`} />
                <StatPill label="Avg FX" value={formatFxAmount(selected.avgSaleFx)} tone="blue" />
                <StatPill label="Avg rate" value={`${formatFxAmount(selected.avgSaleRate)}/u`} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div ref={anchorRef} className="relative">
          <div className="relative">
            <input
              ref={inputRef}
              id={`${listboxId}-input`}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-autocomplete="list"
              disabled={disabled || customers.length === 0}
              value={query}
              placeholder={
                customers.length === 0
                  ? 'No customers with open balance'
                  : 'Search customer, sale ref, or ID…'
              }
              className={`${formInput} w-full !py-2.5 !pl-10 !pr-4 !text-sm`}
              onChange={e => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onInputKeyDown}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>

          {mounted && open && !disabled && customers.length > 0 && menuStyle
            ? createPortal(
                <div
                  ref={dropdownRef}
                  id={listboxId}
                  role="listbox"
                  style={{
                    position: 'fixed',
                    top: menuStyle.top,
                    left: menuStyle.left,
                    width: menuStyle.width,
                    maxHeight: menuStyle.maxHeight,
                    zIndex: 500,
                  }}
                  className="flex flex-col overflow-hidden rounded-lg border border-[var(--theme-border-subtle)] bg-white shadow-dropdown dark:bg-[var(--theme-surface)]"
                >
                  <div className="shrink-0 border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {filtered.length} customer{filtered.length === 1 ? '' : 's'} with open balance
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-2">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-6 text-center text-sm text-slate-500">No matching customers</p>
                    ) : (
                      filtered.map((item, index) => (
                        <CustomerResultCard
                          key={item.key}
                          id={`${listboxId}-opt-${index}`}
                          item={item}
                          selected={item.key === value}
                          active={index === activeIndex}
                          onSelect={() => pick(item.key)}
                        />
                      ))
                    )}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>
      )}
    </div>
  );
}
