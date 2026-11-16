'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ICFundAccount } from '@/types';
import type { ICFundAccountType } from '@/lib/icFunds/constants';
import { accountTypeLabel } from '@/lib/icFunds/constants';
import {
  isVoucherPartyAccount,
  voucherPartyAccountSubtitle,
  isCashBankLedgerAccount,
} from '@/lib/icFunds/voucherPartyAccounts';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfInput, icfLabel } from '@/components/ic-funds/ui';

function LedgerAmount({ amount, book }: { amount: number; book: 'AED' | 'INR' }) {
  return book === 'INR' ? <FmtLedgerInr amount={amount} /> : <FmtLedgerAed amount={amount} />;
}

function AccountLedgerTotals({
  account,
  book,
  compact,
}: {
  account: ICFundAccount;
  book: 'AED' | 'INR';
  compact?: boolean;
}) {
  const dr = account.ledgerDebit ?? 0;
  const cr = account.ledgerCredit ?? 0;
  const bal = account.balance;
  if (compact) {
    return (
      <span className="flex shrink-0 flex-col items-end gap-0.5 font-mono text-[10px] tabular-nums text-slate-500">
        <span>
          Dr <LedgerAmount amount={dr} book={book} />
        </span>
        <span>
          Cr <LedgerAmount amount={cr} book={book} />
        </span>
        <span className={bal < 0 ? 'text-red-600' : 'font-medium text-slate-700'}>
          Bal <LedgerAmount amount={bal} book={book} />
        </span>
      </span>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-slate-500">
      <span>
        Dr <LedgerAmount amount={dr} book={book} />
      </span>
      <span>
        Cr <LedgerAmount amount={cr} book={book} />
      </span>
      <span className={bal < 0 ? 'font-medium text-red-600' : 'font-medium text-slate-700'}>
        Bal <LedgerAmount amount={bal} book={book} />
      </span>
    </div>
  );
}

function matchAccount(account: ICFundAccount, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (account.name.toLowerCase().includes(q)) return true;
  if (account.phone?.toLowerCase().includes(q)) return true;
  if (account.email?.toLowerCase().includes(q)) return true;
  if (account.id.toLowerCase().includes(q)) return true;
  if (accountTypeLabel(account.accountType).toLowerCase().includes(q)) return true;
  if (voucherPartyAccountSubtitle(account).toLowerCase().includes(q)) return true;
  return false;
}

export default function AccountPicker({
  label,
  accounts,
  allowedTypes,
  value,
  onChange,
  excludeId,
  book = 'AED',
  partyOnly = false,
  accountFilter,
  hideLabel = false,
  compact = false,
  inputClassName = icfInput,
}: {
  label: string;
  accounts: ICFundAccount[];
  allowedTypes: ReadonlySet<ICFundAccountType>;
  value: string;
  onChange: (accountId: string) => void;
  excludeId?: string;
  book?: 'AED' | 'INR';
  /** Payments / receipts: hide deal-posted system & P&L ledgers. */
  partyOnly?: boolean;
  accountFilter?: (account: ICFundAccount) => boolean;
  /** When the parent already renders the field label (e.g. AsicFormField). */
  hideLabel?: boolean;
  /** Deposit-modal row: single-line control, no Dr/Cr/Bal above the input. */
  compact?: boolean;
  inputClassName?: string;
}) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = accounts.find(a => a.id === value);
  const options = useMemo(
    () =>
      accounts.filter(a => {
        if (a.id === excludeId) return false;
        if (a.status !== 'active') return false;
        if (!allowedTypes.has(a.accountType)) return false;
        if (partyOnly && !isVoucherPartyAccount(a)) return false;
        if (accountFilter && !accountFilter(a)) return false;
        return matchAccount(a, query);
      }),
    [accounts, allowedTypes, excludeId, partyOnly, accountFilter, query],
  );

  const typeSubtitle = (account: ICFundAccount) => {
    if (partyOnly) return voucherPartyAccountSubtitle(account);
    if (isCashBankLedgerAccount(account) && (account.sourceType ?? '').toLowerCase() === 'ic_branch') {
      return 'Branch locker';
    }
    return accountTypeLabel(account.accountType);
  };

  const updateMenuPosition = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
    const spaceAbove = rect.top - gap - viewportPadding;
    const openBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.max(120, Math.min(208, openBelow ? spaceBelow : spaceAbove));
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
  }, [open, query, options.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const pick = (accountId: string) => {
    onChange(accountId);
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const displayValue = open ? query : selected?.name ?? '';

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(i => Math.min(i + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && options[activeIndex]) {
      e.preventDefault();
      pick(options[activeIndex].id);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={wrapperRef} className="min-w-0">
      {hideLabel ? null : (
        <label className={icfLabel} htmlFor={`${listboxId}-input`}>
          {label}
        </label>
      )}
      {selected && !compact ? <AccountLedgerTotals account={selected} book={book} /> : null}
      <div ref={anchorRef} className="relative">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className={inputClassName || icfInput}
          value={displayValue}
          placeholder="Search account"
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.name ?? '');
          }}
          onChange={e => {
            setOpen(true);
            const next = e.target.value;
            setQuery(next);
            if (value && next !== selected?.name) onChange('');
          }}
          onKeyDown={onInputKeyDown}
        />
        {mounted && open && menuStyle
          ? createPortal(
              <ul
                ref={dropdownRef}
                id={listboxId}
                role="listbox"
                className="fixed z-[500] overflow-auto rounded-lg border border-slate-200 bg-white py-0.5 shadow-lg dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]"
                style={{
                  top: menuStyle.top,
                  left: menuStyle.left,
                  width: menuStyle.width,
                  maxHeight: menuStyle.maxHeight,
                }}
              >
                {options.length === 0 ? (
                  <li className="px-2.5 py-1.5 text-sm text-slate-500">No matching accounts</li>
                ) : (
                  options.map((account, index) => (
                    <li key={account.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={account.id === value}
                        className={`flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-[var(--theme-surface-hover)] ${
                          index === activeIndex ? 'bg-slate-50 dark:bg-[var(--theme-surface-hover)]' : ''
                        }`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => pick(account.id)}
                      >
                        <span className="min-w-0 truncate">
                          <span className="font-medium text-slate-900 dark:text-[var(--theme-text)]">
                            {account.name}
                          </span>
                          <span className="ml-1.5 text-[11px] text-slate-400">
                            {typeSubtitle(account)}
                          </span>
                        </span>
                        <AccountLedgerTotals account={account} book={book} compact />
                      </button>
                    </li>
                  ))
                )}
              </ul>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
