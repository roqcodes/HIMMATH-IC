'use client';

import React from 'react';

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

/** Section block inside modals — vertical stack only (no nested 12-col grid). */
export default function ModalFormSection({
  title,
  description,
  children,
  className = '',
  contentClassName = '',
}: Props) {
  return (
    <section className={`space-y-3 ${className}`}>
      <header className="shrink-0">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-[var(--theme-text)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-[var(--theme-text-secondary)]">
            {description}
          </p>
        ) : null}
      </header>
      <div className={`flex flex-col gap-3 ${contentClassName}`}>{children}</div>
    </section>
  );
}
