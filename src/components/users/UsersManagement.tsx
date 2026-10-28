'use client';

import React, { useState } from 'react';
import {
  CognitoUser,
  createCognitoUserAction,
  deleteCognitoUserAction,
  resetCognitoUserPasswordAction,
  updateCognitoUserAttributesAction,
} from '@/app/actions/cognitoActions';
import { useApp } from '@/context/AppContext';
import { formatDateTime } from '@/lib/format';
import { badgeClass } from '@/lib/badgeClass';
import { btnGhost, btnSm } from '@/lib/ui';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import WriteGate from '@/components/rbac/WriteGate';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { asicBtnPrimary, asicCard, asicInput, asicTable, asicTd, asicTh, asicTheadRow, asicTr } from '@/components/asic/ui';
import { CreateUserModal, EditUserModal, ResetPasswordModal } from './UserModals';
import UserPermissionsPanel from './UserPermissionsPanel';
import StaffAccessSummary from './StaffAccessSummary';
import { fetchBranchStaffPermissionsBatchAction, fetchAdminStaffPermissionsBatchAction } from '@/app/actions/permissionActions';
import { createDeliveryAgent } from '@/app/actions/warehouseActions';
import { HQ_IC_FUNDS_BRANCH_ID, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import { authSessionSlug, warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';
import type { BranchPageId } from '@/lib/branchPages';
import type { PagePermissionMap } from '@/types';

interface UsersManagementProps {
  initialUsers: CognitoUser[];
  error?: string;
  fixedBranchId?: string;
  branchSlug?: string;
  isBranchManager?: boolean;
  isSuperAdmin?: boolean;
}

export default function UsersManagement({
  initialUsers,
  error,
  fixedBranchId,
  branchSlug,
  isBranchManager = false,
  isSuperAdmin = false,
}: UsersManagementProps) {
  const { showToast, branches, user: currentUser, currentSlug } = useApp();
  const { canWrite } = useWriteAccess();
  const [users, setUsers] = useState<CognitoUser[]>(initialUsers);

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<CognitoUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<CognitoUser | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<CognitoUser | null>(null);
  const [staffPermissions, setStaffPermissions] = useState<Record<string, PagePermissionMap>>({});
  const [manageablePages, setManageablePages] = useState<BranchPageId[]>([]);
  const [pagesByBranchId, setPagesByBranchId] = useState<Record<string, BranchPageId[]>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKind, setFilterKind] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const loadStaffPermissions = React.useCallback(async () => {
    if (isBranchManager && branchSlug) {
      setPermissionsLoading(true);
      const res = await fetchBranchStaffPermissionsBatchAction(branchSlug);
      if (res.success) {
        setStaffPermissions(res.permissionsByUser);
        setManageablePages(res.pages);
      }
      setPermissionsLoading(false);
      return;
    }

    if (isSuperAdmin) {
      setPermissionsLoading(true);
      const res = await fetchAdminStaffPermissionsBatchAction();
      if (res.success) {
        setStaffPermissions(res.permissionsByUser);
        setPagesByBranchId(res.pagesByBranchId);
      }
      setPermissionsLoading(false);
    }
  }, [isBranchManager, isSuperAdmin, branchSlug]);

  React.useEffect(() => {
    loadStaffPermissions();
  }, [loadStaffPermissions]);

  const visibleUsers = isBranchManager
    ? users.filter(u => u.role === 'staff')
    : users;

  const handleCreate = async (email: string, name: string, role: string, branchId: string, passwordRaw: string, warehouseId?: string) => {
    if (!canWrite) return;
    const effectiveBranchId = fixedBranchId || branchId;
    const branchForSlug = branches.find(b => b.id === effectiveBranchId);
    const effectiveBranchSlug =
      authSessionSlug(branchSlug || branchForSlug?.slug || currentSlug) ?? undefined;
    const shortWarehouseId = warehouseId ? warehouseShortSlug(warehouseId) : undefined;

    let effectiveRole = role;
    if (role === 'warehouse_manager' && shortWarehouseId) {
      effectiveRole = `warehouse_${shortWarehouseId}`;
    } else if (role === 'delivery' && shortWarehouseId) {
      effectiveRole = `delivery_${shortWarehouseId}`;
    } else if (fixedBranchId && role !== 'warehouse_manager' && role !== 'delivery') {
      effectiveRole = 'staff';
    }

    if (role === 'delivery' && warehouseId) {
      const res = await createDeliveryAgent({
        warehouse_id: warehouseId,
        name,
        email,
        password: passwordRaw,
        branchSlug: effectiveBranchSlug,
      });
      if (res.success) {
        showToast('Delivery agent created successfully.');
        setUsers([{
          username: email,
          email,
          name,
          role: effectiveRole,
          branchId: effectiveBranchId,
          status: 'CONFIRMED',
          created: new Date().toISOString(),
        }, ...users]);
      } else {
        showToast(res.error || 'Failed to create delivery agent', 'error');
      }
      return;
    }

    const res = await createCognitoUserAction(
      email,
      name,
      effectiveRole,
      effectiveBranchId || (effectiveRole === 'staff' && !fixedBranchId ? HQ_IC_FUNDS_BRANCH_ID : effectiveBranchId),
      passwordRaw,
      effectiveBranchSlug || undefined,
    );
    if (res.success) {
      showToast('User created successfully.');
      setUsers([{
        username: email,
        email,
        name,
        role: effectiveRole,
        branchId: fixedBranchId || branchId,
        status: 'CONFIRMED',
        created: new Date().toISOString(),
      }, ...users]);
      if (effectiveRole === 'staff') {
        await loadStaffPermissions();
      }
    } else {
      showToast(res.error || 'Failed to create user', 'error');
    }
  };

  const handleEditUser = async (email: string, newName: string, role?: string, branchId?: string) => {
    if (!canWrite) return;
    const res = await updateCognitoUserAttributesAction(email, newName, branchSlug, role, branchId);
    if (res.success) {
      setUsers(prev => prev.map(u => u.email === email ? {
        ...u,
        name: newName,
        ...(role !== undefined ? { role } : {}),
        ...(branchId !== undefined ? { branchId: branchId || undefined } : {}),
      } : u));
      showToast('User updated successfully.');
      setEditingUser(null);
      await loadStaffPermissions();
    } else {
      showToast(res.error || 'Failed to update user', 'error');
    }
  };

  const handleResetPassword = async (email: string, newPassword: string) => {
    if (!canWrite) return;
    const res = await resetCognitoUserPasswordAction(email, newPassword, branchSlug);
    if (res.success) {
      showToast('Password reset successfully.');
      setResetPasswordUser(null);
    } else {
      showToast(res.error || 'Failed to reset password', 'error');
      throw new Error(res.error || 'Failed to reset password');
    }
  };

  const handleDelete = async (email: string) => {
    if (!canWrite) return;
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    const res = await deleteCognitoUserAction(email, branchSlug);
    if (res.success) {
      showToast('User deleted successfully');
      setUsers(users.filter(u => u.email !== email));
    } else {
      showToast(res.error || 'Failed to delete user', 'error');
    }
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return '—';
    if (isHqIcFundsBranchId(branchId)) return 'HQ admin panel';
    return branches.find(b => b.id === branchId)?.name || branchId;
  };

  const isDirectStaff = (u: CognitoUser) =>
    !u.branchId || isHqIcFundsBranchId(u.branchId) || u.role === 'admin' || u.role === 'auditor';

  const isHqPanelStaff = (u: CognitoUser) => u.role === 'staff' && isHqIcFundsBranchId(u.branchId);
  const isBranchPanelStaff = (u: CognitoUser) => u.role === 'staff' && u.branchId && !isHqIcFundsBranchId(u.branchId);
  const staffNeedsPermissions = (u: CognitoUser) => isHqPanelStaff(u) || isBranchPanelStaff(u);

  const filteredAndSortedUsers = React.useMemo(() => {
    let result = visibleUsers.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBranchName(u.branchId).toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!fixedBranchId && filterKind === 'direct') {
      result = result.filter(isDirectStaff);
    } else if (!fixedBranchId && filterKind === 'branch') {
      result = result.filter(u => !isDirectStaff(u));
    }

    result.sort((a, b) => {
      let aVal = a[sortField as keyof typeof a] || '';
      let bVal = b[sortField as keyof typeof b] || '';

      if (sortField === 'branchId') {
        aVal = getBranchName(a.branchId);
        bVal = getBranchName(b.branchId);
      }
      if (sortField === 'kind') {
        aVal = isDirectStaff(a) ? 'Direct' : 'Branch';
        bVal = isDirectStaff(b) ? 'Direct' : 'Branch';
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });

    return result;
  }, [visibleUsers, searchTerm, filterKind, fixedBranchId, sortField, sortDirection, branches]);

  const canManagePermissions = canWrite && ((isBranchManager && !!branchSlug) || isSuperAdmin);
  const tableColCount = fixedBranchId ? 5 : 7;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortMark = (field: string) => (sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');

  const kpi = React.useMemo(() => {
    const confirmed = visibleUsers.filter(u => u.status === 'CONFIRMED').length;
    const staff = visibleUsers.filter(u => u.role === 'staff').length;
    const admins = visibleUsers.filter(u => u.role === 'admin' || u.role === 'branch_manager').length;
    const direct = visibleUsers.filter(isDirectStaff).length;
    const branchStaff = visibleUsers.length - direct;
    const branchesCovered = new Set(visibleUsers.map(u => u.branchId).filter(Boolean)).size;
    return { total: visibleUsers.length, confirmed, staff, admins, direct, branchStaff, branchesCovered };
  }, [visibleUsers]);

  const getPagesForUser = (u: CognitoUser): BranchPageId[] => {
    if (isSuperAdmin && u.branchId) {
      return pagesByBranchId[u.branchId] ?? [];
    }
    return manageablePages;
  };

  return (
    <>
      <AsicPageHeader
        title={isBranchManager ? 'Users' : 'User Management'}
        actions={
          <button type="button" className={asicBtnPrimary} onClick={() => setShowCreate(true)}>
            {isBranchManager ? 'Add staff' : 'Create user'}
          </button>
        }
      />

      {error ? (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-sm font-medium text-red-800">Configuration error</p>
          <p className="mt-0.5 text-xs text-red-700">{error}</p>
        </div>
      ) : null}

      <AsicKpiStrip
        metrics={
          isBranchManager
            ? [
                { label: 'Staff', value: kpi.total.toLocaleString(), hint: 'This branch' },
                { label: 'Confirmed', value: kpi.confirmed.toLocaleString(), hint: 'Signed in ready', tone: 'emerald' },
                { label: 'Pending', value: String(kpi.total - kpi.confirmed), hint: 'Awaiting confirm', tone: kpi.total - kpi.confirmed > 0 ? 'amber' : 'slate' },
                { label: 'With access', value: kpi.staff.toLocaleString(), hint: 'Page permissions' },
              ]
            : [
                { label: 'Users', value: kpi.total.toLocaleString(), hint: 'All accounts' },
                { label: 'Direct staff', value: kpi.direct.toLocaleString(), hint: 'HQ, no branch' },
                { label: 'Branch staff', value: kpi.branchStaff.toLocaleString(), hint: 'Assigned to a branch', tone: 'indigo' },
                { label: 'Branches', value: kpi.branchesCovered.toLocaleString(), hint: 'Assigned locations' },
              ]
        }
      />

      <div className={asicCard}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
          <input
            type="search"
            placeholder="Search users…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`${asicInput} min-w-[160px] flex-1 sm:max-w-xs`}
          />
          {!fixedBranchId ? (
            <select
              value={filterKind}
              onChange={e => setFilterKind(e.target.value)}
              className={`${asicInput} w-full sm:w-auto`}
              aria-label="Filter by staff kind"
            >
              <option value="">All kinds</option>
              <option value="direct">Direct staff</option>
              <option value="branch">Branch staff</option>
            </select>
          ) : null}
          <span className="ml-auto text-[11px] text-slate-500">{filteredAndSortedUsers.length} users</span>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className={`${asicTable} min-w-[800px]`}>
            <thead>
              <tr className={asicTheadRow}>
                <th className={`${asicTh} cursor-pointer select-none`} onClick={() => handleSort('name')}>
                  Name{sortMark('name')}
                </th>
                <th className={`${asicTh} cursor-pointer select-none`} onClick={() => handleSort('role')}>
                  Role{sortMark('role')}
                </th>
                {!fixedBranchId && (
                  <th className={`${asicTh} cursor-pointer select-none`} onClick={() => handleSort('kind')}>
                    Kind{sortMark('kind')}
                  </th>
                )}
                {!fixedBranchId && (
                  <th className={`${asicTh} cursor-pointer select-none`} onClick={() => handleSort('branchId')}>
                    Branch{sortMark('branchId')}
                  </th>
                )}
                <th className={`${asicTh} cursor-pointer select-none`} onClick={() => handleSort('status')}>
                  Status{sortMark('status')}
                </th>
                <th className={`${asicTh} cursor-pointer select-none`} onClick={() => handleSort('created')}>
                  Created{sortMark('created')}
                </th>
                <th className={asicTh}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={tableColCount} className={`${asicTd} py-10 text-center text-slate-400`}>
                    {error ? 'Unable to load users.' : searchTerm ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers.map(u => (
                  <React.Fragment key={u.username}>
                    <tr className={asicTr}>
                      <td className={asicTd}>
                        <div className="leading-tight">
                          <div className="text-sm font-medium text-slate-900">{u.name}</div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </div>
                      </td>
                      <td className={asicTd}>
                        <span className={badgeClass(u.role === 'admin' ? 'active' : 'pending')}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      {!fixedBranchId && (
                        <td className={asicTd}>
                          {isDirectStaff(u) ? (
                            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              Direct
                            </span>
                          ) : (
                            <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                              Branch
                            </span>
                          )}
                        </td>
                      )}
                      {!fixedBranchId && <td className={asicTd}>{isDirectStaff(u) ? '—' : getBranchName(u.branchId)}</td>}
                      <td className={asicTd}>
                        <span className={badgeClass(u.status === 'CONFIRMED' ? 'completed' : 'processing')}>
                          {u.status}
                        </span>
                      </td>
                      <td className={`${asicTd} text-xs text-slate-500`}>{formatDateTime(u.created)}</td>
                      <td className={`${asicTd} text-right`}>
                        <WriteGate className="inline-flex flex-wrap items-center justify-end gap-1">
                          {canManagePermissions && staffNeedsPermissions(u) && (
                            <button
                              type="button"
                              onClick={() => setPermissionsUser(u)}
                              className={`${btnGhost} ${btnSm} text-accent`}
                            >
                              Access
                            </button>
                          )}
                          <button type="button" onClick={() => setEditingUser(u)} className={`${btnGhost} ${btnSm} text-slate-600`}>
                            Edit
                          </button>
                          {((isSuperAdmin && u.email !== currentUser?.email) || (isBranchManager && u.role === 'staff')) && (
                            <button
                              type="button"
                              onClick={() => setResetPasswordUser(u)}
                              className={`${btnGhost} ${btnSm} text-amber-700 hover:bg-amber-50 hover:text-amber-800`}
                            >
                              Reset
                            </button>
                          )}
                          {u.email !== currentUser?.email && (
                            <button
                              type="button"
                              onClick={() => handleDelete(u.email)}
                              className={`${btnGhost} ${btnSm} text-red-600 hover:bg-red-50 hover:text-red-700`}
                            >
                              Delete
                            </button>
                          )}
                        </WriteGate>
                      </td>
                    </tr>
                    {canManagePermissions && staffNeedsPermissions(u) && (
                      <tr>
                        <td colSpan={tableColCount} className="border-b border-slate-100 bg-slate-50/60 px-2.5 py-2">
                          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
                            <span className="shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                              Page access · {getBranchName(u.branchId)}
                            </span>
                            <StaffAccessSummary
                              permissions={u.userId ? staffPermissions[u.userId] : undefined}
                              pages={getPagesForUser(u)}
                              portal={isHqPanelStaff(u) ? 'admin' : 'branch'}
                              loading={permissionsLoading}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 p-2 md:hidden">
          {filteredAndSortedUsers.map(u => (
            <div key={u.username} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="text-[11px] text-slate-400">{u.email}</p>
                </div>
                <span className={badgeClass(u.role === 'admin' ? 'active' : 'pending')}>
                  {u.role.replace('_', ' ')}
                </span>
              </div>
              {!fixedBranchId ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {isDirectStaff(u) ? 'Direct staff' : `Branch staff · ${getBranchName(u.branchId)}`}
                </p>
              ) : null}
              {canManagePermissions && staffNeedsPermissions(u) && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Page access · {getBranchName(u.branchId)}
                  </p>
                  <StaffAccessSummary
                    permissions={u.userId ? staffPermissions[u.userId] : undefined}
                    pages={getPagesForUser(u)}
                    portal={isHqPanelStaff(u) ? 'admin' : 'branch'}
                    loading={permissionsLoading}
                  />
                </div>
              )}
              <div className="mt-2 flex items-center justify-end gap-2">
                <WriteGate className="inline-flex items-center gap-2">
                  {canManagePermissions && staffNeedsPermissions(u) && (
                    <button type="button" onClick={() => setPermissionsUser(u)} className="text-xs font-medium text-accent">
                      Access
                    </button>
                  )}
                  <button type="button" onClick={() => setEditingUser(u)} className="text-xs font-medium text-slate-600">
                    Edit
                  </button>
                  {((isSuperAdmin && u.email !== currentUser?.email) || (isBranchManager && u.role === 'staff')) && (
                    <button type="button" onClick={() => setResetPasswordUser(u)} className="text-xs font-medium text-amber-700">
                      Reset
                    </button>
                  )}
                  {u.email !== currentUser?.email && (
                    <button type="button" onClick={() => handleDelete(u.email)} className="text-xs font-medium text-red-600">
                      Delete
                    </button>
                  )}
                </WriteGate>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CreateUserModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onAdd={(email, name, role, branchId, pwd, warehouseId) =>
          handleCreate(email, name, role, fixedBranchId || branchId, pwd, warehouseId)
        }
        fixedBranchId={fixedBranchId}
      />

      {editingUser && (
        <EditUserModal
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleEditUser}
          user={editingUser}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordModal
          open={!!resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          email={resetPasswordUser.email}
          onReset={(newPassword) => handleResetPassword(resetPasswordUser.email, newPassword)}
        />
      )}

      {permissionsUser && permissionsUser.branchId && (
        <UserPermissionsPanel
          open={!!permissionsUser}
          onClose={() => setPermissionsUser(null)}
          branchSlug={branchSlug}
          branchId={permissionsUser.branchId}
          portal={isHqPanelStaff(permissionsUser) ? 'admin' : 'branch'}
          user={{
            email: permissionsUser.email,
            name: permissionsUser.name,
            userId: permissionsUser.userId,
          }}
          onSaved={() => {
            showToast('Permissions updated.');
            loadStaffPermissions();
          }}
        />
      )}
    </>
  );
}
