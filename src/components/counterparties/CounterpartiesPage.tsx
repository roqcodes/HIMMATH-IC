'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { getAllCustomers, getCustomersBySlug, deleteCustomer } from '@/app/actions/customerActions';
import { parseAsicPath, RESERVED_BRANCH_SLUGS } from '@/lib/asic/routing';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { formatMoneyValue } from '@/lib/format';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import { asicBtnPrimary, asicBtnOutline, asicTable, asicTd, asicTh, asicThAlign, asicTheadRow, asicTr } from '@/components/asic/ui';
import { icfInput, icfTableWrap } from '@/components/ic-funds/ui';
import CustomerModal from '@/components/customers/CustomerModal';
import SupplierModal from '@/components/ic-transfer/settings/SupplierModal';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { useApp } from '@/context/AppContext';
import {
  filterSuppliersForAdminPortal,
  filterSuppliersForBranchPortal,
} from '@/lib/icTransfer/branchPortalScope';
import {
  COUNTERPARTIES_PAGE_SUBTITLE,
  COUNTERPARTIES_PAGE_TITLE,
  COUNTERPARTY_ROLE_LABEL,
  type CounterpartyRole,
} from '@/lib/counterparties/labels';
import { counterpartiesFromRegistry, type CounterpartyListRow } from '@/lib/counterparties/list';
import type { ICSupplier } from '@/types';

type RoleFilter = 'all' | CounterpartyRole;

const CUSTOMER_DELETE_BLOCKED_TOOLTIP =
  'Cannot delete: this customer has existing orders or transactions';

export default function CounterpartiesPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { icSuppliers, deleteICSupplier, user, branches } = useApp();
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
  const { canWrite, writeBlockedReason, buttonProps: wp } = useWriteAccess();

  const [customers, setCustomers] = useState<
    {
      id: string;
      name: string;
      code?: string;
      phone?: string | null;
      email?: string | null;
      country?: string | null;
      subdivision?: string | null;
      locality?: string | null;
      status?: string;
      balance?: string | number | null;
      hasOrders?: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<(typeof customers)[0] | null>(null);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ICSupplier | null>(null);

  const scopedSuppliers = useMemo(() => {
    if (branchId) return filterSuppliersForBranchPortal(icSuppliers, branchId);
    return filterSuppliersForAdminPortal(icSuppliers);
  }, [icSuppliers, branchId]);

  const fetchCustomers = useCallback(async () => {
    const res = isHqAdmin
      ? await getAllCustomers()
      : branchSlug
        ? await getCustomersBySlug(branchSlug)
        : { success: false as const, customers: [] as typeof customers };
    if (res.success && res.customers) setCustomers(res.customers);
  }, [branchSlug, isHqAdmin]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    await fetchCustomers();
    setLoading(false);
  }, [fetchCustomers]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const rows = useMemo(() => counterpartiesFromRegistry(scopedSuppliers), [scopedSuppliers]);

  const filtered = useMemo(() => {
    let list = rows;
    if (roleFilter !== 'all') list = list.filter(r => r.role === roleFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        r =>
          r.name.toLowerCase().includes(q) ||
          (r.code && r.code.toLowerCase().includes(q)) ||
          (r.phone && r.phone.includes(q)) ||
          (r.email && r.email.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [rows, roleFilter, searchTerm]);

  const customerCount = rows.filter(r => r.role === 'customer').length;
  const supplierCount = rows.filter(r => r.role === 'supplier').length;

  const openCustomerCreate = () => {
    if (!canWrite) return;
    setEditingCustomer(null);
    setCustomerModalOpen(true);
  };

  const openSupplierCreate = () => {
    if (!canWrite) return;
    setEditingSupplier(null);
    setSupplierModalOpen(true);
  };

  const handleRowClick = (row: CounterpartyListRow) => {
    if (row.role === 'customer') {
      if (isHqAdmin) {
        router.push(`/admin/customers/${row.id}`);
        return;
      }
      if (branchSlug) {
        router.push(`/branch/${branchSlug}/customers/${row.id}`);
        return;
      }
      if (canWrite) {
        setEditingCustomer(customers.find(c => c.id === row.id) ?? null);
        setCustomerModalOpen(true);
      }
      return;
    }
    if (canWrite && row.supplier) {
      setEditingSupplier(row.supplier);
      setSupplierModalOpen(true);
    }
  };

  const handleDelete = async (row: CounterpartyListRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canWrite) return;
    if (row.role === 'customer') {
      if (row.hasOrders) {
        alert(CUSTOMER_DELETE_BLOCKED_TOOLTIP);
        return;
      }
      if (!confirm('Delete this customer?')) return;
      const res = await deleteCustomer(row.id, writeSlug);
      if (res.success) void fetchData();
      else alert(res.error || 'Delete failed');
      return;
    }
    if (!confirm('Delete this supplier?')) return;
    await deleteICSupplier(row.id);
    void fetchData();
  };

  const roleBadgeClass = (role: CounterpartyRole) =>
    role === 'customer'
      ? 'border-sky-200 bg-sky-50 text-sky-800'
      : 'border-amber-200 bg-amber-50 text-amber-900';

  return (
    <>
      <div className="animate-[fade-in-up_0.55s_cubic-bezier(0.16,1,0.3,1)_both]">
        <AsicPageHeader
          title={COUNTERPARTIES_PAGE_TITLE}
          subtitle={COUNTERPARTIES_PAGE_SUBTITLE}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openSupplierCreate}
                {...wp()}
                className={`${asicBtnOutline} gap-1.5 text-xs${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
              >
                Add supplier
              </button>
              <button
                type="button"
                onClick={openCustomerCreate}
                {...wp()}
                className={`${asicBtnPrimary} gap-1.5${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
              >
                Add customer
              </button>
            </div>
          }
        />

        <AsicKpiStrip
          metrics={[
            { label: 'Total', value: String(rows.length), hint: 'Customers + suppliers' },
            { label: 'Customers', value: String(customerCount), hint: 'Sale side', tone: 'indigo' },
            { label: 'Suppliers', value: String(supplierCount), hint: 'Purchase side', tone: 'amber' },
          ]}
          columns={3}
        />

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-sm font-medium text-slate-900">Directory</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder="Search name, code, phone…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`${icfInput} w-full !py-1.5 !text-sm sm:max-w-xs`}
              />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as RoleFilter)}
                className={`${icfInput} w-full !py-1.5 !text-sm sm:w-auto`}
              >
                <option value="all">All roles</option>
                <option value="customer">{COUNTERPARTY_ROLE_LABEL.customer}</option>
                <option value="supplier">{COUNTERPARTY_ROLE_LABEL.supplier}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <ASICTableSkeleton framed={false} cols={7} />
          ) : (
            <div className={icfTableWrap}>
              <table className={`${asicTable} min-w-[880px]`}>
                <thead>
                  <tr className={asicTheadRow}>
                    <th className={asicTh}>Role</th>
                    <th className={asicTh}>Name</th>
                    <th className={asicTh}>Code</th>
                    <th className={asicTh}>Phone</th>
                    <th className={asicTh}>Location</th>
                    <th className={asicThAlign('right')}>Balance</th>
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
                      onClick={() => handleRowClick(row)}
                    >
                      <td className={asicTd}>
                        <span
                          className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleBadgeClass(row.role)}`}
                        >
                          {COUNTERPARTY_ROLE_LABEL[row.role]}
                        </span>
                      </td>
                      <td className={`${asicTd} font-medium text-slate-900`}>{row.name}</td>
                      <td className={`${asicTd} font-mono text-xs text-slate-600`}>{row.code || '—'}</td>
                      <td className={`${asicTd} text-slate-600`}>{row.phone || '—'}</td>
                      <td className={`${asicTd} text-slate-600`}>
                        {[row.locality, row.subdivision, row.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className={`${asicTd} text-right font-mono tabular-nums`}>
                        {row.role === 'customer' ? formatMoneyValue(row.balance ?? 0) : '—'}
                      </td>
                      <td className={`${asicTd} text-right`}>
                        <button
                          type="button"
                          onClick={e => handleDelete(row, e)}
                          disabled={!canWrite || (row.role === 'customer' && row.hasOrders)}
                          className={`text-xs font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40`}
                          title={
                            row.role === 'customer' && row.hasOrders
                              ? CUSTOMER_DELETE_BLOCKED_TOOLTIP
                              : 'Delete'
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={`${asicTd} py-10 text-center text-slate-400`}>
                        No counterparties found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {customerModalOpen && writeSlug ? (
        <CustomerModal
          slug={writeSlug}
          open={customerModalOpen}
          customer={
            editingCustomer
              ? {
                  id: editingCustomer.id,
                  name: editingCustomer.name,
                  phone: editingCustomer.phone,
                  email: editingCustomer.email,
                  balance: editingCustomer.balance ?? 0,
                  status: editingCustomer.status,
                  code: editingCustomer.code,
                  country: editingCustomer.country,
                  subdivision: editingCustomer.subdivision,
                  locality: editingCustomer.locality,
                }
              : null
          }
          onClose={() => {
            setCustomerModalOpen(false);
            setEditingCustomer(null);
          }}
          onSave={() => {
            void fetchData();
            setCustomerModalOpen(false);
            setEditingCustomer(null);
          }}
        />
      ) : null}

      <SupplierModal
        open={supplierModalOpen}
        supplier={editingSupplier}
        branchId={branchSlug ? branchId : undefined}
        onClose={() => {
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        onSaved={() => {
          void fetchData();
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
      />
    </>
  );
}
