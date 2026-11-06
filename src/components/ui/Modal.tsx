'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { iconBtn, uiShadowOverlay } from '@/lib/ui';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  /** When set (e.g. sm:h-[min(88dvh,720px)]), dialog keeps a stable height instead of shrinking with content. */
  heightClass?: string;
  /** Extra classes on the scrollable body region (e.g. tighter padding, overflow-hidden). */
  bodyClassName?: string;
  /** Centered slot in the header row (e.g. mode switcher). */
  headerCenter?: React.ReactNode;
  /** Trailing header content before the close button (e.g. timestamp). */
  headerTrailing?: React.ReactNode;
  zIndexClass?: string;
};

const FADE_MS = 120;

let openModalsCount = 0;

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-lg',
  maxHeight = 'sm:max-h-[min(88dvh,720px)]',
  heightClass,
  bodyClassName,
  headerCenter,
  headerTrailing,
  zIndexClass = 'z-[400]',
}: ModalProps) {
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
    openModalsCount++;
    if (openModalsCount === 1) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      openModalsCount--;
      if (openModalsCount <= 0) {
        openModalsCount = 0;
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

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4 motion-safe:transition-opacity motion-safe:duration-[120ms] motion-safe:ease-out dark:bg-[var(--theme-overlay)] ${visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[min(92dvh,100%)] w-full ${maxWidth} flex-col overflow-hidden rounded-t-lg border border-[var(--theme-border-subtle)] bg-white ${uiShadowOverlay} motion-safe:transition-opacity motion-safe:duration-[120ms] motion-safe:ease-out dark:bg-[var(--theme-surface)] ${maxHeight} ${heightClass ?? ''} sm:rounded-lg ${visible ? 'opacity-100' : 'opacity-0'
          }`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-nowrap items-center gap-2 border-b border-slate-200 bg-white py-2 pl-3 pr-2 sm:gap-3 sm:px-4 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)]">
          <div
            id="modal-title"
            className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-3 ${headerCenter ? '' : 'mr-1 text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]'}`}
          >
            {headerCenter ? (
              <>
                <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">
                  {title}
                </span>
                <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-center gap-2">
                  {headerCenter}
                </div>
              </>
            ) : (
              title
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerTrailing}
            <button
              type="button"
              className={`${iconBtn} size-8 shrink-0 text-lg hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/40 dark:hover:bg-red-950/40 dark:hover:text-red-400`}
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-3 ${bodyClassName ?? ''}`}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white p-2 sm:flex-row sm:justify-end sm:gap-2 sm:p-3 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
