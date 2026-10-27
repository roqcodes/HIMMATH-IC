'use client';

import Link from 'next/link';
import { resolveAccountDetailHrefById } from '@/lib/icFunds/accountNavigation';
import { icfAccountLink } from '@/components/ic-funds/ui';
import type { ICFundAccount } from '@/types';

type Props = {
  slug: string;
  accountId: string;
  name: string;
  accounts?: ICFundAccount[];
  className?: string;
};

export default function ICFundAccountLink({
  slug,
  accountId,
  name,
  accounts,
  className,
}: Props) {
  if (!accountId || !slug) {
    return <span className={className}>{name}</span>;
  }

  const account = accounts?.find(a => a.id === accountId);
  const navSlug = account?.branchSlug || slug;
  const href = resolveAccountDetailHrefById(navSlug, accountId, accounts);

  return (
    <Link href={href} className={className ?? icfAccountLink}>
      {name}
    </Link>
  );
}
