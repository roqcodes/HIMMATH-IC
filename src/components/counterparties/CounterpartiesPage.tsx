'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { deleteCounterpartyAction } from '@/app/actions/counterpartyActions';
import { parseAsicPath, RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import { asicBtnPrimary, asicTable, asicTd, asicTh, asicTheadRow, asicTr } from '@/components/asic/ui';
import { icfInput, icfTableWrap } from '@/components/ic-funds/ui';
import CounterpartyModal from '@/components/counterparties/CounterpartyModal';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { useApp } from '@/context/AppContext';
import {
  filterSuppliersForAdminPortal,
  filterSuppliersForBranchPortal,
} from '@/lib/icTransfer/branchPortalScope';
import { COUNTERPARTIES_PAGE_SUBTITLE, COUNTERPARTIES_PAGE_TITLE } from '@/lib/counterparties/labels';
import { counterpartiesFromRegistry } from '@/lib/counterparties/list';
import { counterpartyDetailPath } from '@/lib/counterparties/navigation';
import type { ICSupplier } from '@/types';

const DELETE_BLOCKED =
  'Cannot delete: this counterparty has existing purchases, sales, or orders.';

export default function CounterpartiesPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const { icSuppliers, user, branches } = useApp();
  const parsed = parseAsicPath(pathname);
  const paramSlug = params.slug as string | undefined;
  const isHqAdmin =
    parsed.portal === 'admin-root' ||
    (parsed.portal === 'branch' && paramSlug != null && RESERVED_BRANCH_SLUGS.has(paramSlug));
  const branchSlug =
    parsed.portal === 'branch' && parsed.branchSlug
      ? parsed.branchSlug
      : paramSlug && !RESERVED_BRANCH_SLUGS.has(paramSlug)
        ? paramSlug
        : undefined;
  const branchId = useMemo(() => {
    if (!branchSlug) return user?.branchId;
    return branches.find(b => b.slug === branchSlug)?.id ?? user?.branchId;
  }, [branchSlug, branches, user?.branchId]);
  const writeSlug = branchSlug ?? (isHqAdmin ? HQ_IC_FUNDS_BRANCH_SLUG : '');
  const { canWrite, buttonProps: wp } = useWriteAccess();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ICSupplier | null>(null);

  const scoped = useMemo(() => {
    if (branchId) return filterSuppliersForBranchPortal(icSuppliers, branchId);
    return filterSuppliersForAdminPortal(icSuppliers);
  }, [icSuppliers, branchId]);

  const rows = useMemo(() => counterpartiesFromRegistry(scoped), [scoped]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        (r.code && r.code.toLowerCase().includes(q)) ||
        (r.phone && r.phone.includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q)),
    );
  }, [rows, searchTerm]);

  useEffect(() => {
    if (!highlightId) return;
    router.replace(counterpartyDetailPath(highlightId, branchSlug ? { branchSlug } : undefined));
  }, [highlightId, branchSlug, router]);

  const openCreate = () => {
    if (!canWrite) return;
    setEditing(null);
    setModalOpen(true);
  };

  const openDetail = (cp: ICSupplier) => {
    router.push(counterpartyDetailPath(cp.id, branchSlug ? { branchSlug } : undefined));
  };

  const openEdit = (cp: ICSupplier) => {
    if (!canWrite) return;
    setEditing(cp);
    setModalOpen(true);
  };

  const handleDelete = async (row: (typeof rows)[0], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canWrite || !writeSlug) return;
    if (row.hasOrders) {
      alert(DELETE_BLOCKED);
      return;
    }
    if (!confirm(`Delete counterparty "${row.name}"?`)) return;
    const res = await deleteCounterpartyAction(writeSlug, row.id);
    if (!res.success) alert(res.error || 'Delete failed');
  };

  return (
    <>
      <div className="animate-[fade-in-up_0.55s_cubic-bezier(0.16,1,0.3,1)_both]">
        <AsicPageHeader
          title={COUNTERPARTIES_PAGE_TITLE}
          subtitle={COUNTERPARTIES_PAGE_SUBTITLE}
          actions={
            <button
              type="button"
              onClick={openCreate}
              {...wp()}
              className={`${asicBtnPrimary} gap-1.5${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
            >
              Add counterparty
            </button>
          }
        />

        <AsicKpiStrip
          metrics={[
            { label: 'Total', value: String(rows.length), hint: 'Trading partners' },
            {
              label: 'Active',
              value: String(rows.filter(r => r.status !== 'inactive').length),
              hint: 'Can trade',
              tone: 'indigo',
            },
          ]}
          columns={2}
        />

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-sm font-medium text-slate-900">Directory</h3>
            <input
              type="text"
              placeholder="Search name, code, phone…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={`${icfInput} w-full !py-1.5 !text-sm lg:max-w-xs`}
            />
          </div>

          <div className={icfTableWrap}>
            <table className={`${asicTable} min-w-[720px]`}>
              <thead>
                <tr className={asicTheadRow}>
                  <th className={asicTh}>Name</th>
                  <th className={asicTh}>Code</th>
                  <th className={asicTh}>Phone</th>
                  <th className={asicTh}>Location</th>
                  <th className={asicTh}>Status</th>
                  <th className={asicTh}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr
                    key={row.key}
                    data-interactive-row
                    className={`cursor-pointer ${asicTr}`}
                    onClick={() => row.supplier && openDetail(row.supplier)}
                  >
                    <td className={`${asicTd} font-medium text-slate-900`}>
                      {row.supplier ? (
                        <Link
                          href={counterpartyDetailPath(row.id, branchSlug ? { branchSlug } : undefined)}
                          className="hover:text-sky-800 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {row.name}
                        </Link>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className={`${asicTd} font-mono text-xs text-slate-600`}>{row.code || '—'}</td>
                    <td className={`${asicTd} text-slate-600`}>{row.phone || '—'}</td>
                    <td className={`${asicTd} text-slate-600`}>
                      {[row.locality, row.subdivision, row.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className={`${asicTd} capitalize text-slate-600`}>{row.status || 'active'}</td>
                    <td className={`${asicTd} text-right`}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          if (row.supplier) openEdit(row.supplier);
                        }}
                        disabled={!canWrite}
                        className="mr-3 text-xs font-semibold text-slate-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={e => handleDelete(row, e)}
                        disabled={!canWrite}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={`${asicTd} py-10 text-center text-slate-400`}>
                      No counterparties found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CounterpartyModal
        open={modalOpen}
        counterparty={editing}
        branchId={branchSlug ? branchId : undefined}
        branchSlug={branchSlug ?? (isHqAdmin ? undefined : writeSlug)}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}
