'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAuditLogAction } from '@/modules/admin/actions';
import { asicCard, asicInput, asicTable, asicTd, asicTh, asicTheadRow, asicTr } from '@/components/asic/ui';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';

export default function AuditLogScreen() {
  const [offset, setOffset] = useState(0);
  const limit = 50;
  const query = useQuery({
    queryKey: ['admin', 'audit-log', offset],
    queryFn: async () => {
      const res = await listAuditLogAction({ limit, offset });
      if (!res.success) throw new Error(res.error);
      return res;
    },
    refetchOnWindowFocus: true,
  });

  if (query.isLoading) return <ASICTableSkeleton cols={6} />;
  if (query.error) return <p className="text-sm text-red-600">{(query.error as Error).message}</p>;

  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;

  return (
    <div>
      <div className={`${asicCard} hidden md:block`}>
        <div className="max-h-[calc(100dvh-12rem)] overflow-auto">
          <table className={`${asicTable} min-w-[800px]`}>
            <thead className="sticky top-0">
              <tr className={asicTheadRow}>
                {['When', 'Actor', 'Role', 'Action', 'Entity', 'Branch'].map(h => (
                  <th key={h} className={asicTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={asicTr}>
                  <td className={`${asicTd} whitespace-nowrap text-xs`}>{r.createdAt.replace('T', ' ').slice(0, 19)}</td>
                  <td className={asicTd}>{r.actorEmail ?? '—'}</td>
                  <td className={asicTd}>{r.actorRole ?? '—'}</td>
                  <td className={asicTd}>{r.action}</td>
                  <td className={asicTd}>{r.entityType}{r.entityId ? ` · ${r.entityId}` : ''}</td>
                  <td className={asicTd}>{r.branchId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map(r => (
          <div key={r.id} className={`${asicCard} p-3 text-sm`}>
            <div className="font-medium">{r.action} · {r.entityType}</div>
            <div className="text-[11px] text-slate-500">{r.createdAt} · {r.actorEmail}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
        <button type="button" className={asicInput + ' !h-7 w-auto'} disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>
          Prev
        </button>
        <span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
        <button type="button" className={asicInput + ' !h-7 w-auto'} disabled={offset + limit >= total} onClick={() => setOffset(o => o + limit)}>
          Next
        </button>
      </div>
    </div>
  );
}
