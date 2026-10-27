'use client';

import React from 'react';
import Link from 'next/link';

export function MobileMenuButton({
  onClick,
  label = 'Open menu',
  activeSection,
}: {
  onClick: () => void;
  label?: string;
  activeSection?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-surface-xs md:hidden"
    >
      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
      {activeSection ? <span className="max-w-[8rem] truncate">{activeSection}</span> : 'Menu'}
    </button>
  );
}

type NavLink = {
  id: string;
  label: string;
  href: string;
};

type NavGroup = {
  id: string;
  label?: string;
  items: NavLink[];
};

export function MobileNavLinkList({
  groups,
  activeId,
  onNavigate,
}: {
  groups: NavGroup[];
  activeId?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-4" aria-label="Section navigation">
      {groups.map(group => (
        <div key={group.id}>
          {group.label ? (
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {group.label}
            </p>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.items.map(item => {
              const active = item.id === activeId;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onNavigate}
                  className={`rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors ${
                    active
                      ? 'bg-slate-100 font-medium text-slate-900 ring-1 ring-slate-200'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
