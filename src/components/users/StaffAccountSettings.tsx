'use client';

import React, { useState } from 'react';
import { changeOwnPasswordAction } from '@/app/actions/permissionActions';
import { useApp } from '@/context/AppContext';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicBtnPrimary, asicCard, asicFormGrid, asicInput } from '@/components/asic/ui';
import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';
import { ChangePasswordModal } from './UserModals';

type Props = {
  branchSlug?: string;
};

export default function StaffAccountSettings({ branchSlug }: Props) {
  const { user, showToast, isInitialLoading } = useApp();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    const res = await changeOwnPasswordAction(currentPassword, newPassword, branchSlug);
    if (res.success) {
      showToast('Password updated successfully.');
    } else {
      showToast(res.error || 'Failed to change password', 'error');
      throw new Error(res.error);
    }
  };

  if (!user) {
    if (isInitialLoading) return <ASICPageSkeleton />;
    return null;
  }

  return (
    <>
      <AsicPageHeader title="User Profile" />
      <div className={asicCard}>
        <div className="p-4">
          <div className={asicFormGrid}>
            <AsicFormField label="Full name" colSpan={6}>
              <input className={asicInput} value={user.name} disabled readOnly />
            </AsicFormField>
            <AsicFormField label="Email" colSpan={6}>
              <input className={asicInput} value={user.email} disabled readOnly />
            </AsicFormField>
            <AsicFormField label="Role" colSpan={6}>
              <input className={asicInput} value={user.role.replace('_', ' ')} disabled readOnly />
            </AsicFormField>
          </div>

          <div className="mt-4 border-t border-slate-200 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Security</h3>
            <p className="mt-1 text-sm text-slate-500">
              Change your password using your current password.
            </p>
            <button type="button" className={`${asicBtnPrimary} mt-3`} onClick={() => setShowPasswordModal(true)}>
              Change password
            </button>
          </div>
        </div>
      </div>

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onChange={handleChangePassword}
      />
    </>
  );
}
