'use client';

import React from 'react';
import { useTheme } from '@/context/ThemeContext';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      className="inline-flex items-center rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface-raised)] p-0.5 shadow-surface-xs"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={!isDark}
        title="Light mode"
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-200 sm:px-3 ${
          !isDark
            ? 'bg-white text-slate-900 shadow-surface-xs ring-1 ring-[var(--theme-border-subtle)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border)]'
            : 'text-slate-500 hover:text-slate-700 dark:text-[var(--theme-text-muted)] dark:hover:text-[var(--theme-text-secondary)]'
        }`}
      >
        <SunIcon className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={isDark}
        title="Dark mode"
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-[background-color,color,box-shadow] duration-200 sm:px-3 ${
          isDark
            ? 'bg-[var(--theme-surface)] text-[var(--theme-text)] shadow-surface-xs ring-1 ring-[var(--theme-border)]'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <MoonIcon className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
