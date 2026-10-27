'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { formInput } from '@/lib/ui';

export interface ComboOption {
  value: string;
  label: string;
}

interface ComboSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: ComboOption) => void;
  options: ComboOption[];
  placeholder?: string;
  className?: string;
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

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(value.toLowerCase()),
  );

  const dropdown =
    isOpen && filtered.length > 0 ? (
      <div
        ref={dropdownRef}
        style={dropdownStyle}
        className="z-[500] overflow-y-auto rounded-lg border border-[var(--theme-border-subtle)] bg-white p-1 shadow-dropdown dark:bg-[var(--theme-surface)]"
      >
        {filtered.slice(0, 20).map(option => (
          <button
            key={option.value}
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              onChange(option.label);
              onSelectOption?.(option);
              setIsOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`${formInput} w-full !py-2 !pr-10 !text-sm`}
        />
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
