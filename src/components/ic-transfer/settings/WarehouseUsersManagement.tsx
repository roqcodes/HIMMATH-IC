'use client';

import React, { useState } from 'react';
import {
  CognitoUser,
  createCognitoUserAction,
  deleteCognitoUserAction,
  updateCognitoUserAttributesAction,
} from '@/app/actions/cognitoActions';
import { useApp } from '@/context/AppContext';
import { formatDateTime } from '@/lib/format';
import { badgeClass } from '@/lib/badgeClass';
import { btnGhost, btnSm } from '@/lib/ui';
import { asicBtnPrimary } from '@/components/asic/ui';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import {
  portalMobileCardListClass,
  portalMobileCardFooterClass,
} from '@/lib/icTransfer/layoutConstants';
import { AddButton } from '@/components/ic-transfer/ui';
import SalesTableShell, {
  salesTableClass,
  salesTableEmptyClass,
  salesTableRowClass,
  salesTableTdClass,
  salesTableThClass,
  salesTableTheadRowClass,
} from '@/components/ic-transfer/shared/SalesTableShell';
import { CreateUserModal, EditUserModal } from '@/components/users/UserModals';
import { authSessionSlug, warehouseShortSlug } from '@/lib/icTransfer/warehouseSlug';

interface WarehouseUsersManagementProps {
  initialUsers: CognitoUser[];
  error?: string;
  warehouseId: string;
  branchSlug: string;
  /** When true, omits standalone page header — for warehouse detail page. */
  embedded?: boolean;
}

export default function WarehouseUsersManagement({
  initialUsers,
  error,
  warehouseId,
  branchSlug,
  embedded = false,
}: WarehouseUsersManagementProps) {
  const { showToast, user: currentUser, icWarehouses, branches } = useApp();
  const [users, setUsers] = useState<CognitoUser[]>(initialUsers);

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<CognitoUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const warehouse = icWarehouses.find(w => w.id === warehouseId);
  const warehouseBranchId = warehouse?.branchId || currentUser?.branchId || '';
  const effectiveBranchSlug =
    authSessionSlug(branchSlug || branches.find(b => b.id === warehouseBranchId)?.slug) ?? undefined;

  const handleCreate = async (
    email: string,
    name: string,
    role: string,
    _branchId: string,
    passwordRaw: string,
  ) => {
    const shortWarehouseId = warehouseShortSlug(warehouseId);
    const formattedRole = role === 'delivery' ? `delivery_${shortWarehouseId}` : `warehouse_${shortWarehouseId}`;

    let res: { success: boolean; error?: string };

    if (role === 'delivery') {
      const { createDeliveryAgent } = await import('@/app/actions/warehouseActions');
      res = await createDeliveryAgent({
        warehouse_id: warehouseId,
        name,
        email,
        password: passwordRaw,
        branchSlug: effectiveBranchSlug,
      });
    } else {
      res = await createCognitoUserAction(
        email,
        name,
        formattedRole,
        warehouseBranchId,
        passwordRaw,
        effectiveBranchSlug,
      );
    }

    if (res.success) {
      showToast('Warehouse user created successfully.');
      setUsers([{
        username: email,
        email,
        name,
        role: formattedRole,
        branchId: warehouseBranchId || undefined,
        status: 'CONFIRMED',
        created: new Date().toISOString(),
      }, ...users]);
      setShowCreate(false);
    } else {
      showToast(res.error || 'Failed to create user', 'error');
    }
  };

  const handleEditUser = async (email: string, newName: string) => {
    const res = await updateCognitoUserAttributesAction(email, newName, effectiveBranchSlug || undefined);
    if (res.success) {
      setUsers(prev => prev.map(u => u.email === email ? { ...u, name: newName } : u));
      showToast('User updated successfully.');
      setEditingUser(null);
    } else {
      showToast(res.error || 'Failed to update user', 'error');
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}?`)) return;
    const res = await deleteCognitoUserAction(email, effectiveBranchSlug || undefined);
    if (res.success) {
      showToast('User deleted successfully');
      setUsers(users.filter(u => u.email !== email));
    } else {
      showToast(res.error || 'Failed to delete user', 'error');
    }
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter((u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, searchTerm]);

  const tableSection = (
    <>
      {error ? (
        <div className={`${embedded ? 'px-4 pt-4 md:px-6' : 'mb-6'} rounded-xl border border-red-200 bg-red-50 p-4`}>
          <h3 className="text-sm font-bold text-red-800">Configuration Error</h3>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {!embedded ? (
        <AsicPageHeader
          title="Warehouse Users"
          subtitle="Manage users who have access to this specific warehouse."
          actions={
            <button type="button" className={asicBtnPrimary} onClick={() => setShowCreate(true)}>
              Add warehouse user
            </button>
          }
        />
      ) : null}

      <SalesTableShell
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search users…"
        toolbarEnd={
          embedded ? (
            <AddButton label="Add User" onClick={() => setShowCreate(true)} ariaLabel="Add warehouse user" />
          ) : null
        }
      >
        <table className={`${salesTableClass} hidden min-w-[600px] md:table`}>
          <thead>
            <tr className={salesTableTheadRowClass}>
              <th className={`${salesTableThClass} text-left`}>Name</th>
              <th className={`${salesTableThClass} text-left`}>Role</th>
              <th className={`${salesTableThClass} text-left`}>Status</th>
              <th className={`${salesTableThClass} text-left`}>Created</th>
              <th className={`${salesTableThClass} text-left`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className={salesTableEmptyClass}>
                  {error ? 'Unable to load users.' : searchTerm ? 'No users match your search.' : 'No users found.'}
                </td>
              </tr>
            ) : filteredUsers.map(u => (
              <tr key={u.username} className={salesTableRowClass} data-interactive-row>
                <td className={salesTableTdClass}>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-900">{u.name}</span>
                    <span className="text-[11px] text-slate-400">{u.email}</span>
                  </div>
                </td>
                <td className={`${salesTableTdClass} text-slate-600`}>
                  {u.role?.startsWith('delivery_') ? 'Delivery Agent' : 'Warehouse Manager'}
                </td>
                <td className={salesTableTdClass}>
                  <span className={badgeClass(u.status === 'CONFIRMED' ? 'completed' : 'processing')}>{u.status}</span>
                </td>
                <td className={`${salesTableTdClass} text-xs text-slate-500`}>
                  {formatDateTime(u.created)}
                </td>
                <td className={`${salesTableTdClass} text-right`}>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <button onClick={() => setEditingUser(u)} className={`${btnGhost} ${btnSm} text-slate-600`}>
                      Edit
                    </button>
                    {u.email !== currentUser?.email && (
                      <button onClick={() => handleDelete(u.email)} className={`${btnGhost} ${btnSm} text-red-600 hover:bg-red-50 hover:text-red-700`}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={`${portalMobileCardListClass} md:hidden`}>
          {filteredUsers.map(u => (
            <div key={u.username} className="flex flex-col gap-3 rounded-lg border border-[var(--theme-border-subtle)] bg-white p-3 shadow-surface-xs dark:bg-[var(--theme-surface)]">
              <div>
                <span className="text-sm font-bold text-slate-900">{u.name}</span>
                <p className="text-xs text-slate-500 mt-0.5">{u.email}</p>
              </div>
              <div className="text-xs text-slate-500">
                Role:{' '}
                <strong className="font-semibold text-slate-700">
                  {u.role?.startsWith('delivery_') ? 'Delivery Agent' : 'Warehouse Manager'}
                </strong>
              </div>
              <div className={portalMobileCardFooterClass}>
                <span className={badgeClass(u.status === 'CONFIRMED' ? 'completed' : 'processing')}>{u.status}</span>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => setEditingUser(u)} className="text-xs font-bold text-slate-600">Edit</button>
                  {u.email !== currentUser?.email && (
                    <button onClick={() => handleDelete(u.email)} className="text-xs font-bold text-red-600">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SalesTableShell>
    </>
  );

  return (
    <>
      {embedded ? tableSection : (
        <div className="animate-[fade-in-up_0.55s_cubic-bezier(0.16,1,0.3,1)_both]">{tableSection}</div>
      )}

      {showCreate && (
        <CreateUserModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onAdd={handleCreate}
          fixedWarehouseId={warehouseId}
          warehouseOnly
        />
      )}

      {editingUser && (
        <EditUserModal
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleEditUser}
          user={editingUser}
          isSuperAdmin={false}
        />
      )}
    </>
  );
}
