'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listBranchesAction } from '@/modules/admin/actions';
import { asicBtnPrimary, asicCard, asicInput, asicTable, asicTd, asicTh, asicTheadRow, asicTr } from '@/components/asic/ui';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import CreateBranchModal from '@/components/branches/CreateBranchModal';
import BranchUrlCopy from '@/components/branches/BranchUrlCopy';
import { useWriteAccess } from '@/context/RbacWriteContext';

export default function BranchesScreen() {
  const router = useRouter();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['admin', 'branches'],
    queryFn: async () => {
      const res = await listBranchesAction();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => {
    const list = query.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      b =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q) ||
        b.managerName.toLowerCase().includes(q),
    );
  }, [query.data, search]);

  const openBranch = (slug: string) => {
    router.push(`/admin/branches/${slug}`);
  };

  if (query.isLoading) return <ASICTableSkeleton cols={7} />;

  const allBranches = query.data ?? [];
  const kpi = {
    total: allBranches.length,
    active: allBranches.filter(b => b.isActive).length,
    warehouse: allBranches.filter(b => b.features.warehousePortal).length,
    customer: allBranches.filter(b => b.features.customerPortal).length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        title="Branches"
        subtitle="Create and manage operating locations."
        actions={
          <button
            type="button"
            className={`${asicBtnPrimary}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
            onClick={canWrite ? () => setCreateOpen(true) : undefined}
            {...wp()}
          >
            New branch
          </button>
        }
      />

      <AsicKpiStrip
        metrics={[
          { label: 'Branches', value: kpi.total.toLocaleString(), hint: 'Operating locations' },
          { label: 'Active', value: kpi.active.toLocaleString(), hint: 'Currently live', tone: 'emerald' },
          { label: 'Warehouse portal', value: kpi.warehouse.toLocaleString(), hint: 'Enabled' },
          { label: 'Customer portal', value: kpi.customer.toLocaleString(), hint: 'Enabled', tone: 'indigo' },
        ]}
      />

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <input
          className={`${asicInput} max-w-xs`}
          placeholder="Search branches"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {query.error ? <p className="mb-2 text-sm text-red-600">{(query.error as Error).message}</p> : null}

      <div className={`${asicCard} hidden min-h-0 flex-1 md:block`}>
        <div className="max-h-[calc(100dvh-11rem)] overflow-auto">
          <table className={`${asicTable} min-w-[880px]`}>
            <thead className="sticky top-0">
              <tr className={asicTheadRow}>
                {['Name', 'Branch URL', 'Location', 'Timezone', 'Manager', 'Status', ''].map(h => (
                  <th key={h} className={asicTh}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(b => (
                <tr
                  key={b.id}
                  className={`${asicTr} cursor-pointer hover:bg-slate-50/80`}
                  onClick={() => openBranch(b.slug)}
                >
                  <td className={asicTd}>
                    <Link
                      href={`/admin/branches/${b.slug}`}
                      className="text-sm font-medium text-slate-900 hover:text-accent"
                      onClick={e => e.stopPropagation()}
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className={`${asicTd} max-w-[220px]`}>
                    <BranchUrlCopy slug={b.slug} />
                  </td>
                  <td className={asicTd}>{b.location}</td>
                  <td className={asicTd}>{b.timezone}</td>
                  <td className={asicTd}>{b.managerName}</td>
                  <td className={asicTd}>{b.isActive ? 'Active' : 'Inactive'}</td>
                  <td className={`${asicTd} text-right`}>
                    <button
                      type="button"
                      className="text-xs text-slate-600 hover:text-slate-900"
                      onClick={e => {
                        e.stopPropagation();
                        openBranch(b.slug);
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className={`${asicTd} text-slate-400`} colSpan={7}>No branches</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {rows.map(b => (
          <button
            key={b.id}
            type="button"
            className={`${asicCard} p-3 text-left hover:bg-slate-50/80`}
            onClick={() => openBranch(b.slug)}
          >
            <div className="text-sm font-medium text-slate-900">{b.name}</div>
            <div className="mt-1">
              <BranchUrlCopy slug={b.slug} />
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {b.location} · {b.isActive ? 'Active' : 'Inactive'}
            </div>
          </button>
        ))}
      </div>

      <CreateBranchModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
