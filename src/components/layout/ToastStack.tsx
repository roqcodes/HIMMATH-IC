'use client';

import React from 'react';
import type { Toast } from '@/context/AppContext';

function ToastCheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ToastCard({ toast, compact }: { toast: Toast; compact?: boolean }) {
  const isSuccess = toast.type === 'success';
  return (
    <div
      className={`pointer-events-auto flex animate-[toast-in_0.35s_cubic-bezier(0.34,1.56,0.64,1)] items-center gap-2.5 rounded-lg text-sm font-semibold shadow-dropdown ${
        compact ? 'px-3 py-2' : 'gap-3 px-4 py-3'
      } ${
        isSuccess
          ? 'border border-emerald-200/80 bg-white text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950 dark:text-emerald-50'
          : 'border-l-4 border-red-500 bg-red-950 text-white'
      }`}
    >
      {isSuccess ? (
        <span
          className="flex size-7 shrink-0 animate-[toast-check-pop_0.45s_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
          aria-hidden
        >
          <ToastCheckIcon />
        </span>
      ) : null}
      <span className={compact ? 'text-xs font-semibold' : undefined}>{toast.message}</span>
    </div>
  );
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  const success = toasts.filter(t => t.type === 'success');
  const errors = toasts.filter(t => t.type === 'error');

  return (
    <>
      <div
        className="pointer-events-none fixed top-[4.25rem] right-4 z-[500] flex max-w-[min(100vw-2rem,18rem)] flex-col gap-2 sm:right-6"
        aria-live="polite"
      >
        {success.map(t => (
          <ToastCard key={t.id} toast={t} compact />
        ))}
      </div>
      <div
        className="pointer-events-none fixed bottom-4 left-4 right-4 z-[500] flex flex-col gap-3 sm:left-auto sm:right-6 sm:max-w-sm"
        aria-live="polite"
      >
        {errors.map(t => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </div>
    </>
  );
}
