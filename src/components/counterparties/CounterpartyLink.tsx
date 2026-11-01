'use client';

import Link from 'next/link';
import { counterpartyDetailPath } from '@/lib/counterparties/navigation';

type Props = {
  counterpartyId?: string | null;
  name: string;
  branchSlug?: string;
  className?: string;
  stopPropagation?: boolean;
};

export default function CounterpartyLink({
  counterpartyId,
  name,
  branchSlug,
  className = 'font-medium text-slate-900 hover:text-sky-800 hover:underline',
  stopPropagation,
}: Props) {
  if (!counterpartyId?.trim()) {
    return <span className={className}>{name || '—'}</span>;
  }

  const href = counterpartyDetailPath(counterpartyId, { branchSlug });

  return (
    <Link
      href={href}
      className={className}
      onClick={stopPropagation ? e => e.stopPropagation() : undefined}
    >
      {name || '—'}
    </Link>
  );
}
