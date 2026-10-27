'use client';

import React, { useEffect } from 'react';
import { asicBtnGhost, asicPageTitle } from '@/components/asic/ui';

export default function ASICSlideOver({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/20" aria-label="Close" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <h2 className={asicPageTitle}>{title}</h2>
          <button type="button" className={asicBtnGhost} onClick={onClose}>
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 flex shrink-0 gap-2 border-t border-slate-200 bg-white px-4 py-2.5">
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>
  );
}
