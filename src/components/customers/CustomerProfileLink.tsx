'use client';

import Link from 'next/link';
import { customerProfilePath } from '@/lib/customers/customerNavigation';
import { icfAccountLink } from '@/components/ic-funds/ui';

type Props = {
  branchSlug?: string;
  customerId?: string;
  name: string;
  className?: string;
};

export default function CustomerProfileLink({
  branchSlug,
  customerId,
  name,
  className,
}: Props) {
  if (!branchSlug || !customerId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <Link href={customerProfilePath(branchSlug, customerId)} className={className ?? icfAccountLink}>
      {name}
    </Link>
  );
}
