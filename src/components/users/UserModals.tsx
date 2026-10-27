'use client';
import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/ui/PasswordInput';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { HQ_IC_FUNDS_BRANCH_ID, isHqIcFundsBranch, isHqIcFundsBranchId } from '@/lib/icFunds/hqBranch';
import {
  filterWarehousesForAdminPortal,
  filterWarehousesForBranchPortal,
} from '@/lib/icTransfer/branchPortalScope';
import { btnPrimary, btnSecondary, formGroup, formHint, formInput, formLabel } from '@/lib/ui';
import {
  PASSWORD_REQUIREMENTS_HINT,
  validatePassword,
} from '@/lib/passwordValidation';

export { validatePassword } from '@/lib/passwordValidation';

export function PasswordRequirements({ pw: _pw }: { pw: string }) {
  return <p className={formHint}>{PASSWORD_REQUIREMENTS_HINT}</p>;
}


export type UserKind = 'admin' | 'branch' | 'warehouse';

function UserKindToggle({
  value,
  onChange,
  options,
  disabled,
}: {
  value: UserKind;
  onChange: (kind: UserKind) => void;
  options: { id: UserKind; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div
      className="inline-flex w-full items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5"
      role="tablist"
      aria-label="User type"
    >
      {options.map(option => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              active
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function CreateUserModal({
  open,
  onClose,
  onAdd,
  fixedBranchId,
  fixedWarehouseId,
  warehouseOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (email: string, name: string, role: string, branchId: string, passwordRaw: string, warehouseId?: string) => Promise<void>;
  fixedBranchId?: string;
  fixedWarehouseId?: string;
  /** When true, only warehouse manager / delivery fields are shown. */
  warehouseOnly?: boolean;
}) {
  const { branches, icWarehouses } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const operationalBranches = branches.filter(b => !isHqIcFundsBranch(b));

  const lockedWarehouse = fixedWarehouseId
    ? icWarehouses?.find((w: { id: string }) => w.id === fixedWarehouseId)
    : undefined;
  const isWarehouseContext = warehouseOnly || !!fixedWarehouseId;

  const kindOptions = React.useMemo(() => {
    if (isWarehouseContext) return [];
    if (fixedBranchId) {
      return [
        { id: 'branch' as const, label: 'Branch' },
        { id: 'warehouse' as const, label: 'Warehouse' },
      ];
    }
    return [
      { id: 'admin' as const, label: 'Admin' },
      { id: 'branch' as const, label: 'Branch' },
      { id: 'warehouse' as const, label: 'Warehouse' },
    ];
  }, [fixedBranchId, isWarehouseContext]);

  const defaultKind: UserKind = isWarehouseContext
    ? 'warehouse'
    : (kindOptions[0]?.id ?? 'admin');

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [userKind, setUserKind] = useState<UserKind>(defaultKind);
  const [role, setRole] = useState(isWarehouseContext ? 'warehouse_manager' : 'admin');
  const [branchId, setBranchId] = useState(fixedBranchId || lockedWarehouse?.branchId || '');
  const [warehouseId, setWarehouseId] = useState(fixedWarehouseId || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = React.useCallback(() => {
    setEmail('');
    setName('');
    setUserKind(defaultKind);
    setRole(isWarehouseContext ? 'warehouse_manager' : defaultKind === 'branch' ? 'staff' : 'admin');
    setBranchId(fixedBranchId || lockedWarehouse?.branchId || '');
    setWarehouseId(fixedWarehouseId || '');
    setPassword('');
  }, [defaultKind, fixedBranchId, fixedWarehouseId, isWarehouseContext, lockedWarehouse?.branchId]);

  React.useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, resetForm]);

  const handleKindChange = (kind: UserKind) => {
    setUserKind(kind);
    if (kind === 'admin') {
      setRole('admin');
      setBranchId('');
      setWarehouseId('');
    } else if (kind === 'branch') {
      setRole('staff');
      setBranchId(fixedBranchId || '');
      setWarehouseId('');
    } else {
      setRole('warehouse_manager');
      setBranchId(fixedBranchId || '');
      setWarehouseId(fixedWarehouseId || '');
    }
  };

  const warehouseOptions = React.useMemo(() => {
    if (!icWarehouses) return [];
    if (fixedBranchId) {
      return filterWarehousesForBranchPortal(icWarehouses, fixedBranchId);
    }
    return filterWarehousesForAdminPortal(icWarehouses);
  }, [icWarehouses, fixedBranchId]);

  const isFormValid = React.useMemo(() => {
    if (!email || !name || !validatePassword(password).isValid) return false;
    if (isWarehouseContext) return !!fixedWarehouseId;
    if (userKind === 'branch' && !fixedBranchId && !branchId) return false;
    if (userKind === 'warehouse') {
      if (!warehouseId) return false;
    }
    return true;
  }, [email, name, password, userKind, isWarehouseContext, fixedBranchId, branchId, fixedWarehouseId, warehouseId]);

  const handleSubmit = async () => {
    if (!canWrite || !isFormValid) return;

    let effectiveRole = role;
    let effectiveBranchId = fixedBranchId || branchId || lockedWarehouse?.branchId || '';
    if (userKind === 'warehouse' && !fixedBranchId) {
      effectiveBranchId = '';
    }
    if (userKind === 'admin' && role === 'staff') {
      effectiveBranchId = HQ_IC_FUNDS_BRANCH_ID;
    }

    setLoading(true);
    await onAdd(
      email,
      name,
      effectiveRole,
      effectiveBranchId,
      password,
      fixedWarehouseId || warehouseId || undefined,
    );
    setLoading(false);
    resetForm();
    onClose();
  };

  const warehouseLoginHint = React.useMemo(() => {
    const branchPortalSlug = fixedBranchId
      ? branches.find(b => b.id === fixedBranchId)?.slug
      : undefined;
    const signInPath = branchPortalSlug ? `/branch/${branchPortalSlug}` : '/admin';
    return `Sign in at ${signInPath}`;
  }, [fixedBranchId, branches]);
  const showKindToggle = kindOptions.length > 1;
  const modalTitle = isWarehouseContext ? 'Add warehouse user' : 'Create user';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      maxWidth="max-w-2xl w-[95vw]"
      maxHeight="sm:max-h-none"
      footer={
        <>
          <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} w-full sm:w-auto`}
            onClick={handleSubmit}
            {...wp({ disabled: loading || !isFormValid })}
          >
            {loading ? 'Creating...' : 'Create user'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {showKindToggle ? (
          <UserKindToggle
            value={userKind}
            onChange={handleKindChange}
            options={kindOptions}
            disabled={loading}
          />
        ) : null}

        <div className={asicFormGrid}>
          <AsicFormField label="Email / username" colSpan={4}>
            <input className={asicInput} placeholder="e.g. admin@aibak.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading || !canWrite} />
          </AsicFormField>
          <AsicFormField label="Full name" colSpan={4}>
            <input className={asicInput} placeholder="e.g. John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading} />
          </AsicFormField>
          <AsicFormField label="Password" colSpan={4}>
            <PasswordInput
              placeholder="Secure password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              inputClassName={asicInput}
            />
          </AsicFormField>

          {isWarehouseContext ? (
            <>
              <AsicFormField label="Role" colSpan={6}>
                <select className={asicInput} value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="delivery">Delivery User</option>
                </select>
              </AsicFormField>
              <AsicFormField label="Warehouse" colSpan={6} hint={warehouseLoginHint}>
                <input
                  className={`${asicInput} cursor-not-allowed bg-slate-50 text-slate-600`}
                  value={lockedWarehouse?.name || fixedWarehouseId || ''}
                  readOnly
                  disabled
                />
              </AsicFormField>
            </>
          ) : null}

          {!isWarehouseContext && userKind === 'admin' ? (
            <AsicFormField label="Role" colSpan={12} hint="HQ users sign in at /admin.">
              <select className={asicInput} value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
                <option value="admin">Admin</option>
                <option value="auditor">Auditor</option>
                <option value="staff">Staff (HQ panel)</option>
              </select>
            </AsicFormField>
          ) : null}

          {!isWarehouseContext && userKind === 'branch' ? (
            <>
              {!fixedBranchId ? (
                <AsicFormField label="Branch *" colSpan={6}>
                  <select className={asicInput} value={branchId} onChange={e => setBranchId(e.target.value)} disabled={loading}>
                    <option value="">Select branch</option>
                    {operationalBranches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </AsicFormField>
              ) : null}
              {!fixedBranchId ? (
                <AsicFormField label="Role" colSpan={6}>
                  <select className={asicInput} value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
                    <option value="staff">Staff</option>
                    <option value="branch_manager">Branch Manager</option>
                  </select>
                </AsicFormField>
              ) : (
                <AsicFormField label="Role" colSpan={12} hint="Branch staff can only access your branch portal.">
                  <input className={`${asicInput} cursor-not-allowed bg-slate-50 text-slate-600`} value="Staff" readOnly disabled />
                </AsicFormField>
              )}
            </>
          ) : null}

          {!isWarehouseContext && userKind === 'warehouse' ? (
            <>
              <AsicFormField label="Role" colSpan={6}>
                <select className={asicInput} value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="delivery">Delivery User</option>
                </select>
              </AsicFormField>
              <AsicFormField
                label="Warehouse *"
                colSpan={6}
                hint={fixedBranchId ? warehouseLoginHint : `${warehouseLoginHint} · HQ admin warehouses only.`}
              >
                {fixedWarehouseId ? (
                  <input
                    className={`${asicInput} cursor-not-allowed bg-slate-50 text-slate-600`}
                    value={icWarehouses?.find((w: { id: string; name: string }) => w.id === fixedWarehouseId)?.name || fixedWarehouseId}
                    readOnly
                    disabled
                  />
                ) : (
                  <select
                    className={asicInput}
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select warehouse</option>
                    {warehouseOptions.map((w: { id: string; name: string }) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                )}
              </AsicFormField>
            </>
          ) : null}
        </div>

        <PasswordRequirements pw={password} />
      </div>
    </Modal>
  );
}

export function ChangePasswordModal({
  open,
  onClose,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  onChange: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!validatePassword(password).isValid || !currentPassword) return;
    setLoading(true);
    try {
      await onChange(currentPassword, password);
      setCurrentPassword('');
      setPassword('');
      onClose();
    } catch {
      // toast handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Password"
      footer={
        <>
          <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} w-full sm:w-auto`}
            onClick={handleSubmit}
            disabled={loading || !validatePassword(password).isValid || !currentPassword}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </>
      }
    >
      <div className={formGroup}>
        <label className={formLabel}>Current password</label>
        <PasswordInput
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
          inputClassName={asicInput}
        />
      </div>
      <div className={formGroup}>
        <label className={formLabel}>New password</label>
        <PasswordInput
          placeholder="Enter secure password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
          inputClassName={asicInput}
        />
        <PasswordRequirements pw={password} />
      </div>
    </Modal>
  );
}

export function ResetPasswordModal({
  open,
  onClose,
  email,
  onReset
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  onReset: (newPassword: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { canWrite, buttonProps: wp } = useWriteAccess();

  const handleSubmit = async () => {
    if (!canWrite || !validatePassword(password).isValid) return;
    setLoading(true);
    try {
      await onReset(password);
      setPassword('');
      onClose();
    } catch {
      // toast handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reset Password"
      footer={
        <>
          <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} w-full sm:w-auto`}
            onClick={handleSubmit}
            {...wp({ disabled: loading || !validatePassword(password).isValid })}
          >
            {loading ? 'Resetting...' : 'Set New Password'}
          </button>
        </>
      }
    >
      <div className="mb-4 text-sm text-slate-600">
        You are resetting the permanent password for <strong>{email}</strong>.
      </div>
      <div className={formGroup}>
        <label className={formLabel}>New Permanent Password</label>
        <PasswordInput
          placeholder="Enter secure password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={loading || !canWrite}
          inputClassName={asicInput}
        />
        <PasswordRequirements pw={password} />
      </div>
    </Modal>
  );
}

export function EditUserModal({
  open,
  onClose,
  onSave,
  user,
  isSuperAdmin = false,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (email: string, newName: string, role?: string, branchId?: string) => Promise<void>;
  user: { email: string; name: string; role?: string; branchId?: string };
  isSuperAdmin?: boolean;
}) {
  const { branches } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const operationalBranches = branches.filter(b => !isHqIcFundsBranch(b));
  const isHqStaffProfile = isHqIcFundsBranchId(user.branchId);
  const initialKind: 'direct' | 'branch' =
    user.role === 'admin' || user.role === 'auditor' || !user.branchId || isHqStaffProfile ? 'direct' : 'branch';
  const [name, setName] = useState(user.name);
  const [staffKind, setStaffKind] = useState<'direct' | 'branch'>(initialKind);
  const [role, setRole] = useState(user.role || 'admin');
  const [branchId, setBranchId] = useState(user.branchId || '');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setName(user.name);
    const kind: 'direct' | 'branch' =
      user.role === 'admin' || user.role === 'auditor' || !user.branchId || isHqIcFundsBranchId(user.branchId)
        ? 'direct'
        : 'branch';
    setStaffKind(kind);
    setRole(user.role || 'admin');
    setBranchId(user.branchId || '');
  }, [user]);

  const handleStaffKindChange = (kind: 'direct' | 'branch') => {
    setStaffKind(kind);
    if (kind === 'direct') {
      setRole(role === 'auditor' ? 'auditor' : role === 'staff' ? 'staff' : 'admin');
      setBranchId('');
    } else if (role === 'admin' || role === 'auditor') {
      setRole('staff');
    }
  };

  const handleSubmit = async () => {
    if (!canWrite || !name.trim()) return;
    const nextRole = isSuperAdmin ? (staffKind === 'direct' ? role : role) : undefined;
    let nextBranchId = isSuperAdmin ? (staffKind === 'direct' ? '' : branchId) : undefined;
    if (isSuperAdmin && staffKind === 'direct' && nextRole === 'staff') {
      nextBranchId = HQ_IC_FUNDS_BRANCH_ID;
    }
    if (isSuperAdmin && staffKind === 'branch' && (role === 'branch_manager' || role === 'staff') && !branchId) return;
    setLoading(true);
    await onSave(user.email, name, nextRole, nextBranchId);
    setLoading(false);
  };

  const showBranchSelect = isSuperAdmin && staffKind === 'branch';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit User"
      maxWidth="max-w-3xl w-[95vw]"
      footer={
        <>
          <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className={`${btnPrimary} w-full sm:w-auto`}
            onClick={handleSubmit}
            {...wp({ disabled: loading })}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className={asicFormGrid}>
        <AsicFormField label="Email / username" colSpan={4} hint="Emails cannot be changed once created.">
          <input className={asicInput} value={user.email} disabled />
        </AsicFormField>
        <AsicFormField label="Full name" colSpan={4}>
          <input className={asicInput} value={name} onChange={e => setName(e.target.value)} disabled={loading || !canWrite} />
        </AsicFormField>
        {isSuperAdmin ? (
          <AsicFormField
            label="Staff kind"
            colSpan={4}
            hint={staffKind === 'branch' ? 'Must be assigned to a branch.' : 'HQ access, no branch assignment.'}
          >
            <select
              className={asicInput}
              value={staffKind}
              onChange={e => handleStaffKindChange(e.target.value as 'direct' | 'branch')}
              disabled={loading || !canWrite}
            >
              <option value="direct">Direct (HQ)</option>
              <option value="branch">Branch staff</option>
            </select>
          </AsicFormField>
        ) : null}
        {isSuperAdmin && staffKind === 'direct' ? (
          <AsicFormField label="Role" colSpan={4}>
            <select className={asicInput} value={role} onChange={e => setRole(e.target.value)} disabled={loading || !canWrite}>
              <option value="admin">Admin</option>
              <option value="auditor">Auditor</option>
              <option value="staff">Staff (HQ panel)</option>
            </select>
          </AsicFormField>
        ) : null}
        {isSuperAdmin && staffKind === 'branch' ? (
          <AsicFormField label="Role" colSpan={4}>
            <select className={asicInput} value={role} onChange={e => setRole(e.target.value)} disabled={loading || !canWrite}>
              <option value="staff">Staff</option>
              <option value="branch_manager">Branch Manager</option>
            </select>
          </AsicFormField>
        ) : null}
        {showBranchSelect ? (
          <AsicFormField label="Assign to branch *" colSpan={12}>
            <select className={asicInput} value={branchId} onChange={e => setBranchId(e.target.value)} disabled={loading || !canWrite}>
              <option value="">Select a branch</option>
              {operationalBranches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </AsicFormField>
        ) : null}
      </div>
    </Modal>
  );
}
