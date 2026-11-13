'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import ICTransferDataTableShell, {
  icTdClass,
  type ICTransferTableColumn,
} from '@/components/ic-transfer/shared/ICTransferDataTableShell';
import BranchModal from '@/components/ic-transfer/branch/BranchModal';
import type { ICBranch, ICSupplier } from '@/types';
import {
  getICTransferBranchDetailHref,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import { parseAsicPath } from '@/lib/asic/routing';
import { FmtLedgerAed } from '@/lib/icFunds/format';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';
import { EMPTY_BRANCH_DEPOSIT_KPIS, type BranchDepositKpis } from '@/lib/icTransfer/branchDepositKpis';

const columns: ICTransferTableColumn[] = [
  { id: 'Name', label: 'Branch', align: 'left' },
  { id: 'Code', label: 'Code', align: 'left' },
  { id: 'Status', label: 'Status', align: 'left' },
  { id: 'Period AED', label: 'Period AED', align: 'right' },
  { id: 'Cash AED', label: 'Cash AED', align: 'right' },
  { id: 'Metal', label: 'Metal (period)', align: 'right' },
  { id: 'Deposits', label: 'Deposits', align: 'right' },
  { id: 'Till', label: 'Cash till (AED)', align: 'right' },
  { id: 'Managers', label: 'Managers', align: 'left' },
  { id: 'Contact', label: 'Contact', align: 'left' },
];

function managerNamesForBranch(branch: ICBranch, byId: Map<string, ICSupplier>): string {
  const ids = branch.managerIds ?? [];
  if (ids.length === 0) return '—';
  const names = ids.map(id => byId.get(id)?.name?.trim() || '').filter(Boolean);
  if (names.length === 0) return `${ids.length}`;
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

function statusPill(status?: ICBranch['status']) {
  const active = status !== 'inactive';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        active
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
          : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200/80'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

type Props = {
  portalMode?: ICTransferPortalMode;
  branches: ICBranch[];
  rangeLabel: string;
  depositByBranchId: Map<string, BranchDepositKpis>;
  icSuppliers: ICSupplier[];
  registerOpenAdd?: (openAdd: (() => void) | null) => void;
};

export default function ManageBranchesSection({
  portalMode = 'admin',
  branches,
  rangeLabel,
  depositByBranchId,
  icSuppliers,
  registerOpenAdd,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const supplierById = useMemo(() => {
    const map = new Map<string, ICSupplier>();
    for (const s of icSuppliers) map.set(s.id, s);
    return map;
  }, [icSuppliers]);

  const workspace = useMemo(() => {
    const parsed = parseAsicPath(pathname);
    if (parsed.portal === 'admin-root') {
      return { mode: 'admin' as ICTransferPortalMode, slug: undefined };
    }
    if (parsed.portal === 'branch' && parsed.branchSlug) {
      return { mode: 'branch' as ICTransferPortalMode, slug: parsed.branchSlug };
    }
    const legacySlug = params.slug as string | undefined;
    return { mode: portalMode, slug: legacySlug };
  }, [pathname, params.slug, portalMode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(b => {
      const managers = managerNamesForBranch(b, supplierById).toLowerCase();
      return (
        b.name.toLowerCase().includes(q) ||
        (b.code?.toLowerCase().includes(q) ?? false) ||
        (b.phone?.includes(q) ?? false) ||
        (b.email?.toLowerCase().includes(q) ?? false) ||
        (b.address?.toLowerCase().includes(q) ?? false) ||
        managers.includes(q)
      );
    });
  }, [branches, search, supplierById]);

  const kpiFor = (branchId: string): BranchDepositKpis =>
    depositByBranchId.get(branchId) ?? EMPTY_BRANCH_DEPOSIT_KPIS;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'Name' || field === 'Code' || field === 'Managers' || field === 'Contact' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const ka = kpiFor(a.id);
      const kb = kpiFor(b.id);
      let cmp = 0;
      switch (sortField) {
        case 'Code':
          cmp = (a.code ?? '').localeCompare(b.code ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'Status':
          cmp = (a.status === 'inactive' ? 1 : 0) - (b.status === 'inactive' ? 1 : 0);
          break;
        case 'Period AED':
          cmp = ka.totalAed - kb.totalAed;
          break;
        case 'Cash AED':
          cmp = ka.cashAed - kb.cashAed;
          break;
        case 'Metal':
          cmp = ka.metalAed - kb.metalAed;
          break;
        case 'Deposits':
          cmp = ka.depositCount - kb.depositCount;
          break;
        case 'Till':
          cmp = (a.cashBalance ?? 0) - (b.cashBalance ?? 0);
          break;
        case 'Managers':
          cmp = (a.managerIds?.length ?? 0) - (b.managerIds?.length ?? 0);
          break;
        case 'Contact':
          cmp = (a.phone ?? '').localeCompare(b.phone ?? '', undefined, { sensitivity: 'base' });
          break;
        case 'Name':
        default:
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortField, sortOrder, depositByBranchId]);

  const openAdd = useCallback(() => {
    setFormOpen(true);
  }, []);

  useEffect(() => {
    registerOpenAdd?.(openAdd);
    return () => registerOpenAdd?.(null);
  }, [registerOpenAdd, openAdd]);

  const detailHref = (branchId: string) =>
    getICTransferBranchDetailHref(workspace.slug ?? '', branchId, workspace.mode);

  const openDetail = (branchId: string) => {
    router.push(detailHref(branchId));
  };

  const tableEmpty =
    branches.length === 0
      ? 'No branches configured yet.'
      : 'No branches match your search.';

  return (
    <>
      <div className="mb-3 min-h-0 flex-1">
        <ICTransferDataTableShell
          title={`Branches · ${rangeLabel}`}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search branch, code, manager, phone…"
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          columns={columns}
          minWidth="1200px"
          isEmpty={sorted.length === 0}
          emptyMessage={tableEmpty}
        >
          {sorted.map(branch => {
            const href = detailHref(branch.id);
            const kpi = kpiFor(branch.id);
            const contact = [branch.phone, branch.email].filter(Boolean).join(' · ') || '—';
            return (
              <tr
                key={branch.id}
                className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/80"
                onClick={() => openDetail(branch.id)}
              >
                <td className={`${icTdClass('left')} font-medium text-slate-900`}>
                  <Link href={href} className="hover:text-accent" onClick={e => e.stopPropagation()}>
                    {branch.name}
                  </Link>
                  {branch.address ? (
                    <p className="mt-0.5 max-w-[220px] truncate text-[11px] font-normal text-slate-500" title={branch.address}>
                      {branch.address}
                    </p>
                  ) : null}
                </td>
                <td className={`${icTdClass('left')} font-mono text-xs text-slate-600`}>{branch.code || '—'}</td>
                <td className={icTdClass('left')}>{statusPill(branch.status)}</td>
                <td className={`${icTdClass('right')} font-mono tabular-nums text-slate-800`}>
                  <FmtLedgerAed amount={kpi.totalAed} />
                </td>
                <td className={`${icTdClass('right')} font-mono tabular-nums text-emerald-700`}>
                  <FmtLedgerAed amount={kpi.cashAed} />
                  {kpi.cashCount > 0 ? (
                    <span className="ml-1 text-[10px] font-normal text-slate-400">({kpi.cashCount})</span>
                  ) : null}
                </td>
                <td className={`${icTdClass('right')} font-mono tabular-nums text-amber-800`}>
                  <FmtLedgerAed amount={kpi.metalAed} />
                  {kpi.metalWeightG > 0 ? (
                    <p className="text-[10px] font-normal text-slate-400">{formatMetalGrams(kpi.metalWeightG)}</p>
                  ) : null}
                </td>
                <td className={`${icTdClass('right')} font-mono tabular-nums text-slate-600`}>
                  {kpi.depositCount > 0 ? kpi.depositCount.toLocaleString() : '—'}
                </td>
                <td className={`${icTdClass('right')} font-mono tabular-nums text-slate-800`}>
                  <FmtLedgerAed amount={branch.cashBalance ?? 0} />
                </td>
                <td
                  className={`${icTdClass('left')} max-w-[160px] truncate text-xs text-slate-600`}
                  title={managerNamesForBranch(branch, supplierById)}
                >
                  {managerNamesForBranch(branch, supplierById)}
                </td>
                <td
                  className={`${icTdClass('left')} max-w-[140px] truncate text-xs text-slate-500`}
                  title={contact === '—' ? undefined : contact}
                >
                  {contact}
                </td>
              </tr>
            );
          })}
        </ICTransferDataTableShell>
      </div>

      <BranchModal open={formOpen} branch={null} onClose={() => setFormOpen(false)} onSaved={() => setFormOpen(false)} />
    </>
  );
}
