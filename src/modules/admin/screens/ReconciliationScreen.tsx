'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchReconciliationAction } from '@/modules/admin/actions';
import { asicCard, asicTable, asicTd, asicTh, asicTheadRow, asicTr } from '@/components/asic/ui';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { sectionLabel } from '@/lib/staffSectionPermissions';

export default function ReconciliationScreen() {
  const query = useQuery({
    queryKey: ['admin', 'reconciliation'],
    queryFn: async () => {
      const res = await fetchReconciliationAction();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  if (query.isLoading) return <ASICTableSkeleton cols={5} />;
  if (query.error) return <p className="text-sm text-red-600">{(query.error as Error).message}</p>;

  return (
    <div>
      <AsicPageHeader title={sectionLabel('reconciliation')} />
      <div className={asicCard}>
      <div className="max-h-[calc(100dvh-11rem)] overflow-auto">
        <table className={`${asicTable} min-w-[640px]`}>
          <thead className="sticky top-0">
            <tr className={asicTheadRow}>
              {['Branch', 'Fund opening sum', 'Open orders', 'Completed', 'Warehouses'].map(h => (
                <th key={h} className={asicTh}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map(r => (
              <tr key={r.branchId} className={asicTr}>
                <td className={asicTd}>{r.branchName}</td>
                <td className={asicTd}>{r.fundBalance.toFixed(2)}</td>
                <td className={asicTd}>{r.openOrders}</td>
                <td className={asicTd}>{r.completedOrders}</td>
                <td className={asicTd}>{r.warehouseCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
