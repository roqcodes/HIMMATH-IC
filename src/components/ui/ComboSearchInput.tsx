'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formInput } from '@/lib/ui';

export interface ComboOption {
  value: string;
  label: string;
  /** Plain entity name when label includes a code prefix. */
  name?: string;
  code?: string;
  detail?: string;
}

interface ComboSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: ComboOption) => void;
  options: ComboOption[];
  placeholder?: string;
  /** Highlights the row matching this option value. */
  selectedValue?: string;
  /** Wrapper (layout only). */
  className?: string;
  /** Merged onto the text input (e.g. asicInput in modals). */
  inputClassName?: string;
  disabled?: boolean;
  /** Called when the input is focused (e.g. refresh dropdown balances). */
  onFocus?: () => void;
  /** Shown inside the field, before the search icon (e.g. available metal grams). */
  trailing?: React.ReactNode;
  createOptionLabel?: (query: string) => string;
  onCreateOption?: (query: string) => void;
  creatingOption?: boolean;
}

const DROPDOWN_GAP = 4;
const DROPDOWN_MAX_HEIGHT = 208; // max-h-52

export default function ComboSearchInput({
  value,
  onChange,
  onSelectOption,
  options,
  placeholder = 'Search or type...',
  className = '',
  inputClassName = '',
  disabled = false,
  selectedValue,
  onFocus,
  trailing,
  createOptionLabel,
  onCreateOption,
  creatingOption = false,
}: ComboSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP - 8;
    const spaceAbove = rect.top - DROPDOWN_GAP - 8;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;

    if (openUp) {
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + DROPDOWN_GAP,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(96, spaceAbove)),
      });
    } else {
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        top: rect.bottom + DROPDOWN_GAP,
        maxHeight: Math.min(DROPDOWN_MAX_HEIGHT, Math.max(96, spaceBelow)),
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();
  }, [isOpen, value, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => updateDropdownPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapperRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter(o => {
    const q = value.toLowerCase();
    const name = (o.name ?? o.label).toLowerCase();
    return (
      name.includes(q) ||
      o.label.toLowerCase().includes(q) ||
      (o.code ? o.code.toLowerCase().includes(q) : false) ||
      (o.detail ? o.detail.toLowerCase().includes(q) : false)
    );
  });
  const createQuery = value.trim();
  const hasExactMatch = options.some(o =>
    (o.name ?? o.label).trim().toLocaleLowerCase() === createQuery.toLocaleLowerCase(),
  );
  const showCreateOption = Boolean(createQuery && createOptionLabel && onCreateOption && !hasExactMatch);

  const dropdown =
    isOpen && (filtered.length > 0 || showCreateOption) ? (
      <div
        ref={dropdownRef}
        style={dropdownStyle}
        className="z-[500] overflow-y-auto rounded-lg border border-[var(--theme-border-subtle)] bg-white p-1 shadow-dropdown dark:bg-[var(--theme-surface)]"
      >
        {filtered.slice(0, 30).map(option => {
          const isSelected = selectedValue != null && selectedValue !== '' && option.value === selectedValue;
          return (
            <button
              key={option.value}
              type="button"
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-elevated)] ${
                isSelected ? 'bg-accent/5 ring-1 ring-accent/20' : ''
              }`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                onChange(option.label);
                onSelectOption?.(option);
                setIsOpen(false);
              }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isSelected ? 'font-semibold text-accent' : 'font-medium text-slate-900 dark:text-[var(--theme-text)]'
                  }`}
                >
                  {option.label}
                </span>
                {option.detail ? (
                  <span className="max-w-[48%] shrink-0 truncate text-right text-xs text-slate-500 dark:text-[var(--theme-text-secondary)]">
                    {option.detail}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
        {showCreateOption ? (
          <button
            type="button"
            className="mt-1 w-full rounded-lg border-t border-[var(--theme-border-subtle)] px-3 py-2 text-left text-sm font-semibold text-accent transition-colors hover:bg-accent/5 disabled:cursor-wait disabled:opacity-60"
            disabled={creatingOption}
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              setIsOpen(false);
              onCreateOption?.(createQuery);
            }}
          >
            {creatingOption ? 'Creating…' : createOptionLabel?.(createQuery)}
          </button>
        ) : null}
      </div>
    ) : null;

  const hasTrailing = trailing != null && trailing !== '';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={e => {
            if (disabled) return;
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              onFocus?.();
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={
            inputClassName
              ? `${inputClassName} w-full ${hasTrailing ? '!pr-[4.5rem]' : '!pr-10'}${disabled ? ' cursor-not-allowed opacity-60' : ''}`
              : `${formInput} w-full !py-2 ${hasTrailing ? '!pr-[4.5rem]' : '!pr-10'} !text-sm${disabled ? ' cursor-not-allowed opacity-60' : ''}`
          }
        />
        {hasTrailing ? (
          <span className="pointer-events-none absolute right-9 top-1/2 max-w-[45%] -translate-y-1/2 truncate text-right text-xs font-semibold tabular-nums text-slate-500 dark:text-[var(--theme-text-secondary)]">
            {trailing}
          </span>
        ) : null}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </div>

      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
