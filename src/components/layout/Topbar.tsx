'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import AppLogo from '@/components/layout/AppLogo';
import GlobalSearch from '@/components/layout/GlobalSearch';
import CurrencySwitcher from '@/components/ui/CurrencySwitcher';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { parseAsicPath } from '@/lib/asic/routing';
import { iconBtn, uiShadowOverlay } from '@/lib/ui';

type SearchFieldProps = {
  searchWrapRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  closeSearch: () => void;
  centered?: boolean;
  mobileOverlay?: boolean;
};

function SearchField({
  searchWrapRef,
  searchQuery,
  setSearchQuery,
  isSearchOpen,
  setIsSearchOpen,
  closeSearch,
  centered = false,
  mobileOverlay = false,
}: SearchFieldProps) {
  const searchOpen = isSearchOpen || searchQuery.length > 0;

  return (
    <div
      ref={searchWrapRef}
      className={`relative min-w-0 ${
        mobileOverlay
          ? 'w-full'
          : centered
            ? 'w-full max-w-xl'
            : 'flex-1 md:max-w-lg lg:max-w-xl'
      }`}
    >
      <div
        className={`flex h-9 w-full items-center gap-2 rounded-lg border border-[var(--theme-border-field)] bg-[var(--theme-surface-raised)] px-3 text-sm shadow-surface-xs sm:h-10 sm:gap-3 sm:px-4 ${
          mobileOverlay ? 'border-[var(--theme-border-subtle)] bg-white shadow-dropdown' : ''
        }`}
      >
        <svg className="size-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Search pages, deals, transactions, products…"
          id={mobileOverlay ? 'global-search-mobile' : 'global-search'}
          autoFocus={mobileOverlay || (isSearchOpen && !centered)}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => setIsSearchOpen(true)}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
          autoComplete="off"
          spellCheck={false}
        />
        {searchQuery || mobileOverlay ? (
          <button
            type="button"
            onClick={closeSearch}
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-900"
          >
            {searchQuery && !mobileOverlay ? 'Clear' : 'Close'}
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
            ⌘K
          </kbd>
        )}
      </div>

      <GlobalSearch
        query={searchQuery}
        open={searchOpen}
        onClose={closeSearch}
        onQueryChange={setSearchQuery}
      />
    </div>
  );
}

type TopbarActionsProps = {
  user: ReturnType<typeof useApp>['user'];
  logout: () => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  accountHref?: string | null;
  showMobileSearch?: boolean;
  onOpenMobileSearch?: () => void;
};

function TopbarActions({
  user,
  logout,
  isRefreshing,
  onRefresh,
  accountHref,
  showMobileSearch = false,
  onOpenMobileSearch,
}: TopbarActionsProps) {
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4">
      {showMobileSearch && onOpenMobileSearch ? (
        <button
          type="button"
          className={`${iconBtn} size-10 md:hidden`}
          onClick={onOpenMobileSearch}
          aria-label="Open search"
        >
          <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      ) : null}

      <ThemeToggle />

      <CurrencySwitcher />

      <button
        type="button"
        className={`${iconBtn} size-10 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97]`}
        onClick={onRefresh}
        aria-label="Refresh Data"
      >
        <svg className={`size-[18px] ${isRefreshing ? 'animate-spin text-accent' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      </button>

      {user ? (
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent p-1 transition-colors hover:bg-slate-50 md:gap-3 dark:hover:bg-[var(--theme-surface-hover)]"
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-accent shadow-surface-xs ring-1 ring-[var(--theme-border-subtle)] dark:bg-[var(--theme-surface-raised)]">
              {(user.name || 'User')
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="hidden min-w-0 text-left md:block">
              <div className="truncate text-sm font-semibold text-slate-900">{user.name || 'User'}</div>
              <div className="truncate text-[11px] font-medium capitalize text-slate-500">{(user.role || '').replace('_', ' ')}</div>
            </div>
          </button>

          <div
            className={`absolute right-0 top-[calc(100%+4px)] z-[300] w-64 origin-top-right rounded-lg border border-[var(--theme-border-subtle)] bg-white p-2 ${uiShadowOverlay} transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:bg-[var(--theme-surface)] ${
              isProfileOpen
                ? 'visible scale-100 opacity-100'
                : 'invisible scale-95 opacity-0'
            }`}
          >
            <div className="mb-2 border-b border-slate-100 px-3 pb-3 pt-2 dark:border-[var(--theme-border)]">
              <div className="text-sm font-bold text-slate-900">{user.name || 'User'}</div>
              <div className="text-xs text-slate-500">{user.email || ''}</div>
            </div>
            <div className="px-3 py-2 text-xs text-slate-600">
              <div className="mb-2 flex justify-between">
                <span>Status</span>
                <span className="font-semibold text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Last Login</span>
                <span className="font-semibold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            <div className="mt-2 border-t border-slate-100 pt-2">
              {accountHref ? (
                <Link
                  href={accountHref}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-[var(--theme-text)] dark:hover:bg-[var(--theme-surface-hover)]"
                  onClick={() => setIsProfileOpen(false)}
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Account settings
                </Link>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => {
                  setIsProfileOpen(false);
                  logout();
                }}
              >
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function Topbar() {
  const pathname = usePathname();
  const { logout, user, refreshAppData, compactPortalHome } = useApp();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchWrapRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshAppData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        document.getElementById('global-search')?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktop = searchWrapRef.current?.contains(target);
      const inMobile = mobileSearchWrapRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        if (searchQuery) return;
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [searchQuery]);

  const parsedPath = parseAsicPath(pathname);
  const accountHref =
    parsedPath.portal === 'admin-root' || parsedPath.portal === 'admin'
      ? '/admin/account'
      : parsedPath.portal === 'branch' && parsedPath.branchSlug
        ? `/branch/${parsedPath.branchSlug}/account`
        : parsedPath.portal === 'warehouse' && parsedPath.branchSlug
          ? `/warehouse/${parsedPath.branchSlug}/account`
          : parsedPath.portal === 'delivery' && parsedPath.branchSlug
            ? `/delivery/${parsedPath.branchSlug}/account`
            : null;

  const headerShell =
    'relative z-10 h-14 shrink-0 border-b border-slate-200/80 bg-white/95 px-4 shadow-none backdrop-blur-sm sm:px-5 md:px-6 lg:px-8 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95';

  const searchProps = {
    searchQuery,
    setSearchQuery,
    isSearchOpen,
    setIsSearchOpen,
    closeSearch,
  };

  const actionsProps = {
    user,
    logout,
    isRefreshing,
    onRefresh: handleRefresh,
    accountHref,
  };

  return (
    <>
      <header className={`flex items-center gap-2 sm:gap-3 ${headerShell}`}>
        <div className="shrink-0">
          <AppLogo variant="header" href={compactPortalHome} />
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
          <SearchField {...searchProps} searchWrapRef={searchWrapRef} centered />
        </div>

        <div className="ml-auto shrink-0">
          <TopbarActions
            {...actionsProps}
            showMobileSearch
            onOpenMobileSearch={() => setIsSearchOpen(true)}
          />
        </div>
      </header>

      {isSearchOpen ? (
        <div className="fixed inset-x-0 top-0 z-[60] border-b border-slate-200 bg-white/95 px-4 pb-3 pt-2 backdrop-blur-sm md:hidden dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]/95">
          <SearchField
            {...searchProps}
            searchWrapRef={mobileSearchWrapRef}
            mobileOverlay
          />
        </div>
      ) : null}
    </>
  );
}
