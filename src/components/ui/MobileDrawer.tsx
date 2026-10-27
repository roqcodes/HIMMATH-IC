'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
};

const FADE_MS = 200;

let openDrawersCount = 0;

export default function MobileDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  side = 'left',
}: MobileDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setRender(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setRender(false), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!render) return;
    openDrawersCount++;
    if (openDrawersCount === 1) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      openDrawersCount--;
      if (openDrawersCount <= 0) {
        openDrawersCount = 0;
        document.body.style.overflow = '';
      }
    };
  }, [render]);

  useEffect(() => {
    if (!render || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [render, visible, onClose]);

  if (!mounted || !render) return null;

  const translateFrom = side === 'left' ? '-translate-x-full' : 'translate-x-full';
  const position = side === 'left' ? 'left-0' : 'right-0';

  return createPortal(
    <div className="fixed inset-0 z-[350] md:hidden" role="presentation">
      <button
        type="button"
        aria-label="Close menu"
        className={`absolute inset-0 bg-slate-900/40 motion-safe:transition-opacity motion-safe:duration-200 dark:bg-[var(--theme-overlay)] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute top-0 ${position} flex h-full w-[min(88vw,320px)] flex-col border-slate-200 bg-white shadow-2xl motion-safe:transition-transform motion-safe:duration-200 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:shadow-dropdown ${
          side === 'left' ? 'border-r' : 'border-l'
        } ${visible ? 'translate-x-0' : translateFrom}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-[var(--theme-border)]">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-[var(--theme-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface-raised)] text-slate-600 shadow-surface-xs dark:text-[var(--theme-text-secondary)]"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
