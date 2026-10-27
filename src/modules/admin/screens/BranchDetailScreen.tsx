'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBranchBySlugAction,
  softDeleteBranchAction,
  updateBranchAction,
  type BranchRow,
} from '@/modules/admin/actions';
import {
  asicBtnOutline,
  asicBtnPrimary,
  asicCard,
  asicFormGrid,
  asicInput,
  asicLabel,
} from '@/components/asic/ui';
import ASICSlideOver from '@/components/asic/ASICSlideOver';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import BranchUrlCopy, { BranchPortalLinks } from '@/components/branches/BranchUrlCopy';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { formatDateTime } from '@/lib/format';

export default function BranchDetailScreen({ slug }: { slug: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BranchRow | null>(null);
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: ['admin', 'branch', slug],
    queryFn: async () => {
      const res = await getBranchBySlugAction(slug);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const updateMut = useMutation({
    mutationFn: updateBranchAction,
    onSuccess: res => {
      if (!res.success) {
        setError(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ['admin', 'branch', slug] });
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      setEditing(false);
      setError('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: softDeleteBranchAction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'branches'] });
      router.push('/admin/branches');
    },
  });

  if (query.isLoading) return <ASICTableSkeleton cols={4} />;
  if (query.error || !query.data) {
    return (
      <div className="space-y-2">
        <Link href="/admin/branches" className="text-xs font-medium text-accent hover:underline">
          ← Back to branches
        </Link>
        <p className="text-sm text-red-600">{(query.error as Error)?.message || 'Branch not found.'}</p>
      </div>
    );
  }

  const branch = query.data;

  const openEdit = () => {
    setDraft({ ...branch });
    setError('');
    setEditing(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2">
        <Link href="/admin/branches" className="text-xs font-medium text-slate-500 hover:text-accent">
          ← Branches
        </Link>
      </div>

      <AsicPageHeader
        title={branch.name}
        subtitle={branch.location || 'Branch workspace'}
        meta={
          <span
            className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
              branch.isActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {branch.isActive ? 'Active' : 'Inactive'}
          </span>
        }
        actions={
          <button
            type="button"
            className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
            onClick={canWrite ? openEdit : undefined}
            {...wp()}
          >
            Edit branch
          </button>
        }
      />

      <div className={`${asicCard} space-y-4 p-4`}>
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Branch URL</h2>
          <div className="mt-1.5">
            <BranchUrlCopy slug={branch.slug} absolute />
          </div>
          <div className="mt-2">
            <BranchPortalLinks slug={branch.slug} />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Slug</p>
            <p className="mt-0.5 font-mono text-sm text-slate-900">{branch.slug}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Timezone</p>
            <p className="mt-0.5 text-sm text-slate-900">{branch.timezone}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Manager</p>
            <p className="mt-0.5 text-sm text-slate-900">{branch.managerName || 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Created</p>
            <p className="mt-0.5 text-sm text-slate-900">{formatDateTime(branch.createdAt)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Portals</p>
            <p className="mt-0.5 text-sm text-slate-900">
              {[
                branch.features.warehousePortal && 'Warehouse',
                branch.features.customerPortal && 'Customer',
              ]
                .filter(Boolean)
                .join(', ') || 'None'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Branch ID</p>
            <p className="mt-0.5 font-mono text-xs text-slate-700">{branch.id}</p>
          </div>
        </section>
      </div>

      <ASICSlideOver
        open={editing && !!draft}
        title={draft ? `Edit ${draft.name}` : 'Edit'}
        onClose={() => setEditing(false)}
        footer={
          draft ? (
            <>
              <button
                type="button"
                className={asicBtnOutline}
                onClick={() => {
                  if (confirm('Soft-delete this branch? Financial history is kept.')) {
                    deleteMut.mutate(draft.id);
                  }
                }}
              >
                Deactivate
              </button>
              <button
                type="button"
                className={asicBtnPrimary}
                disabled={updateMut.isPending}
                onClick={() =>
                  updateMut.mutate({
                    id: draft.id,
                    name: draft.name,
                    location: draft.location,
                    timezone: draft.timezone,
                    managerName: draft.managerName,
                    isActive: draft.isActive,
                    warehousePortal: draft.features.warehousePortal,
                    customerPortal: draft.features.customerPortal,
                  })
                }
              >
                Save
              </button>
            </>
          ) : null
        }
      >
        {draft ? (
          <div className={asicFormGrid}>
            {error ? <p className="text-sm text-red-600 md:col-span-2">{error}</p> : null}
            <label>
              <span className={asicLabel}>Name</span>
              <input className={asicInput} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label>
              <span className={asicLabel}>Location</span>
              <input className={asicInput} value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} />
            </label>
            <label>
              <span className={asicLabel}>Timezone</span>
              <input className={asicInput} value={draft.timezone} onChange={e => setDraft({ ...draft, timezone: e.target.value })} />
            </label>
            <label>
              <span className={asicLabel}>Manager</span>
              <input className={asicInput} value={draft.managerName} onChange={e => setDraft({ ...draft, managerName: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.features.warehousePortal}
                onChange={e => setDraft({ ...draft, features: { ...draft.features, warehousePortal: e.target.checked } })}
              />
              Warehouse portal
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.features.customerPortal}
                onChange={e => setDraft({ ...draft, features: { ...draft.features, customerPortal: e.target.checked } })}
              />
              Customer portal
            </label>
          </div>
        ) : null}
      </ASICSlideOver>
    </div>
  );
}
