'use client';

import Link from 'next/link';
import { getICTransferWarehouseDetailHref, type ICTransferPortalMode } from '@/lib/icTransfer/branchPortalScope';

type Props = {
  warehouseId?: string | null;
  name: string;
  branchSlug?: string;
  portalMode?: ICTransferPortalMode;
  className?: string;
  stopPropagation?: boolean;
};

export default function WarehouseLink({
  warehouseId,
  name,
  branchSlug = '',
  portalMode = 'admin',
  className = 'text-slate-700 hover:text-sky-800 hover:underline',
  stopPropagation,
}: Props) {
  if (!warehouseId?.trim()) {
    return <span className={className}>{name || 'None'}</span>;
  }

  const href = getICTransferWarehouseDetailHref(branchSlug, warehouseId, portalMode);

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
