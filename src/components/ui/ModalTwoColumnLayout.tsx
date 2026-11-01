'use client';

import React from 'react';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
};

/** Standard horizontal split for entity modals. Stacks on small screens. */
export default function ModalTwoColumnLayout({ left, right }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-0">
      <div className="min-w-0 space-y-6 lg:pr-6">{left}</div>
      <div className="flex min-h-0 min-w-0 flex-col gap-6 lg:h-full lg:border-l lg:border-slate-200 lg:pl-6 dark:lg:border-[var(--theme-border-subtle)]">
        {right}
      </div>
    </div>
  );
}
