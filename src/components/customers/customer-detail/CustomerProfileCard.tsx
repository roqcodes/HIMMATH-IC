'use client';

import React from 'react';
import { asicCard, asicLabel } from '@/components/asic/ui';
import { badgeClass } from '@/lib/badgeClass';
import { fmtICDate } from '@/lib/icFunds/format';
import type { Customer } from '@/types';

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--theme-border-subtle)] py-2.5 last:border-0">
      <dt className={`${asicLabel} mb-0 shrink-0`}>{label}</dt>
      <dd
        className={`min-w-0 text-right text-sm font-medium text-slate-900 dark:text-[var(--theme-text)] ${
          mono ? 'font-mono text-xs tabular-nums' : ''
        }`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

type Props = {
  customer: Customer;
  branchName?: string;
};

export default function CustomerProfileCard({ customer, branchName }: Props) {
  const currency = (customer.currency || 'AED').toUpperCase();
  const statusKind = customer.status === 'active' ? 'active' : 'inactive';

  return (
    <section className={asicCard} aria-label="Customer profile">
      <div className="border-b border-[var(--theme-border-subtle)] px-3 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">Profile</h2>
        <p className="text-[11px] text-slate-500 dark:text-[var(--theme-text-secondary)]">
          Contact & account details
        </p>
      </div>
      <dl className="px-3 py-1">
        <DetailRow
          label="Status"
          value={
            <span className={badgeClass(statusKind)}>
              {customer.status}
            </span>
          }
        />
        <DetailRow label="Phone" value={customer.phone} />
        <DetailRow label="Email" value={customer.email} />
        <DetailRow label="Currency" value={currency} mono />
        {branchName ? <DetailRow label="Branch" value={branchName} /> : null}
        <DetailRow label="Customer ID" value={customer.id} mono />
        {customer.createdAt ? (
          <DetailRow label="Created" value={fmtICDate(customer.createdAt)} />
        ) : null}
        <DetailRow
          label="Portal login"
          value={
            customer.cognitoUserId ? (
              <span className={badgeClass('verified')}>Enabled</span>
            ) : (
              <span className="text-slate-400 dark:text-[var(--theme-text-muted)]">Not set up</span>
            )
          }
        />
      </dl>
    </section>
  );
}
