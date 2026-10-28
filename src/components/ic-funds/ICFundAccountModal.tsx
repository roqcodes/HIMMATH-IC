'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/ui/PasswordInput';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicCard, asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import {
  createICFundAccountAction,
  resetICFundAccountPasswordAction,
  updateICFundAccountAction,
} from '@/app/actions/icFundsActions';
import { trackLoading } from '@/lib/loadingBar';
import { IC_FUND_ACCOUNT_TYPE_OPTIONS } from '@/lib/icFunds/constants';
import { PasswordRequirements, ResetPasswordModal } from '@/components/users/UserModals';
import { parseFormAmount } from '@/lib/parseFormAmount';
import { validatePassword } from '@/lib/passwordValidation';
import type { ICFundAccount } from '@/types';
import type { ICFundAccountType } from '@/lib/icFunds/constants';

interface ICFundAccountModalProps {
  branchId: string;
  open: boolean;
  account?: ICFundAccount | null;
  onClose: () => void;
  onSave: () => void;
}

function ModalSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${asicCard} p-4`}>
      <header className="mb-3 border-b border-slate-100 pb-2.5 dark:border-[var(--theme-border-subtle)]">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-[var(--theme-text)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-[var(--theme-text-secondary)]">
            {description}
          </p>
        ) : null}
      </header>
      <div className={asicFormGrid}>{children}</div>
    </section>
  );
}

export default function ICFundAccountModal({
  branchId,
  open,
  account,
  onClose,
  onSave,
}: ICFundAccountModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    accountType: 'personal' as ICFundAccountType,
    openingBalance: '0',
    notes: '',
    status: 'active',
    phone: '',
    email: '',
    password: '',
    requireSignIn: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const isNew = !account;
  const hasPortalLogin = Boolean(account?.hasPortalLogin);
  const enablingPortalOnEdit = !isNew && formData.requireSignIn && !hasPortalLogin;

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        accountType: account.accountType,
        openingBalance: String(account.openingBalance ?? '0'),
        notes: account.notes || '',
        status: account.status || 'active',
        phone: account.phone || '',
        email: account.email || '',
        password: '',
        requireSignIn: Boolean(account.hasPortalLogin),
      });
    } else {
      setFormData({
        name: '',
        accountType: 'personal',
        openingBalance: '0',
        notes: '',
        status: 'active',
        phone: '',
        email: '',
        password: '',
        requireSignIn: false,
      });
    }
  }, [account, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRequireSignInToggle = (checked: boolean) => {
    if (!isNew && hasPortalLogin) return;
    setFormData(prev => ({
      ...prev,
      requireSignIn: checked,
      email: checked ? prev.email : '',
      password: checked ? prev.password : '',
    }));
  };

  const portalFieldsValid =
    !formData.requireSignIn ||
    hasPortalLogin ||
    Boolean(formData.email.trim() && validatePassword(formData.password).isValid);

  const canSubmit =
    Boolean(formData.name.trim()) &&
    !(isNew && formData.requireSignIn && !portalFieldsValid) &&
    !(enablingPortalOnEdit && !portalFieldsValid);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Account name is required');
      return;
    }
    if (formData.requireSignIn && !hasPortalLogin && !formData.email.trim()) {
      alert('Email is required when sign-in is enabled');
      return;
    }
    if (formData.requireSignIn && !hasPortalLogin && !validatePassword(formData.password).isValid) {
      return;
    }

    const openingBalance = parseFormAmount(formData.openingBalance);
    if (openingBalance === null) {
      alert('Enter a valid opening balance');
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const res = await trackLoading(() =>
          createICFundAccountAction({
            branchId,
            name: formData.name,
            accountType: formData.accountType,
            openingBalance,
            notes: formData.notes,
            requireSignIn: formData.requireSignIn,
            email: formData.requireSignIn ? formData.email : undefined,
            password: formData.requireSignIn ? formData.password : undefined,
            phone: formData.phone || undefined,
          }),
        );
        if (!res.success) {
          alert('Failed to create account: ' + res.error);
          return;
        }
      } else if (account) {
        const res = await trackLoading(() =>
          updateICFundAccountAction({
            branchId: account.branchId,
            id: account.id,
            name: formData.name,
            accountType: formData.accountType,
            openingBalance,
            notes: formData.notes,
            status: formData.status as 'active' | 'inactive',
            phone: formData.phone,
            requireSignIn: enablingPortalOnEdit ? true : undefined,
            email: enablingPortalOnEdit ? formData.email : undefined,
            password: enablingPortalOnEdit ? formData.password : undefined,
          }),
        );
        if (!res.success) {
          alert('Failed to update account: ' + res.error);
          return;
        }
      }
      onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!account?.id) return;
    const res = await trackLoading(() =>
      resetICFundAccountPasswordAction(account.branchId || branchId, account.id, newPassword),
    );
    if (res.success) {
      setShowResetPassword(false);
      alert('Portal password reset successfully.');
    } else {
      alert(res.error || 'Failed to reset password');
      throw new Error(res.error || 'Failed to reset password');
    }
  };

  const portalEmail = hasPortalLogin ? account?.email || formData.email : formData.email;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={account ? 'Edit account' : 'New account'}
        maxWidth="max-w-4xl w-[95vw]"
        footer={
          <>
            <button type="button" onClick={onClose} className={btnSecondary}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !canSubmit}
              className={`${btnPrimary} ${isSaving || !canSubmit ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {isSaving ? 'Saving...' : account ? 'Save changes' : 'Create account'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <ModalSection
            title="Account details"
            description={
              isNew
                ? 'Core ledger fields for this IC Funds account on the HQ ledger.'
                : 'Update name, type, balance, and notes for this account.'
            }
          >
            <AsicFormField label="Account name *" htmlFor="icf-account-name" colSpan={6}>
              <input
                id="icf-account-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={asicInput}
                placeholder="e.g. Ahmed Al Mansoori"
                required
              />
            </AsicFormField>

            <AsicFormField label="Phone" htmlFor="icf-account-phone" colSpan={6}>
              <input
                id="icf-account-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={asicInput}
              />
            </AsicFormField>

            <AsicFormField label="Account type *" htmlFor="icf-account-type" colSpan={6}>
              <select
                id="icf-account-type"
                name="accountType"
                value={formData.accountType}
                onChange={handleChange}
                className={asicInput}
              >
                {IC_FUND_ACCOUNT_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </AsicFormField>

            <AsicFormField label="Opening balance (AED)" htmlFor="icf-account-opening" colSpan={6}>
              <input
                id="icf-account-opening"
                type="text"
                inputMode="decimal"
                name="openingBalance"
                value={formData.openingBalance}
                onChange={handleChange}
                className={asicInput}
              />
            </AsicFormField>

            {!isNew ? (
              <AsicFormField label="Status" htmlFor="icf-account-status" colSpan={6}>
                <select
                  id="icf-account-status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={asicInput}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </AsicFormField>
            ) : null}

            <AsicFormField label="Notes" htmlFor="icf-account-notes" colSpan={12}>
              <textarea
                id="icf-account-notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className={asicTextarea}
                rows={2}
              />
            </AsicFormField>
          </ModalSection>

          {formData.accountType === 'personal' ? (
            <ModalSection
              title="Customer portal"
              description="Optional login for this customer to place orders and view balances."
            >
              <AsicFormField label="Portal access" colSpan={12}>
                <ToggleSwitch
                  checked={formData.requireSignIn || hasPortalLogin}
                  onChange={handleRequireSignInToggle}
                  disabled={hasPortalLogin}
                  label={hasPortalLogin ? 'Portal login enabled' : 'Enable customer sign-in'}
                />
              </AsicFormField>

              {formData.requireSignIn || hasPortalLogin ? (
                <>
                  <AsicFormField label="Email *" htmlFor="icf-account-email" colSpan={6}>
                    <input
                      id="icf-account-email"
                      type="email"
                      name="email"
                      value={portalEmail}
                      onChange={handleChange}
                      className={asicInput}
                      readOnly={hasPortalLogin}
                      disabled={hasPortalLogin}
                      required
                    />
                  </AsicFormField>

                  {!hasPortalLogin ? (
                    <AsicFormField label="Password *" htmlFor="icf-account-password" colSpan={6}>
                      <PasswordInput
                        id="icf-account-password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        autoComplete="new-password"
                      />
                      <PasswordRequirements pw={formData.password} />
                    </AsicFormField>
                  ) : (
                    <AsicFormField label="Password" colSpan={6}>
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => setShowResetPassword(true)}
                      >
                        Reset password
                      </button>
                    </AsicFormField>
                  )}
                </>
              ) : null}
            </ModalSection>
          ) : null}
        </div>
      </Modal>

      {showResetPassword && account ? (
        <ResetPasswordModal
          open={showResetPassword}
          onClose={() => setShowResetPassword(false)}
          email={portalEmail}
          onReset={handleResetPassword}
        />
      ) : null}
    </>
  );
}
