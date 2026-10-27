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
import { HQ_IC_FUNDS_BRANCH_ID, isHqIcFundsBranch } from '@/lib/icFunds/hqBranch';
import { PasswordRequirements, ResetPasswordModal } from '@/components/users/UserModals';
import { parseFormAmount } from '@/lib/parseFormAmount';
import { validatePassword } from '@/lib/passwordValidation';
import { WORLD_CURRENCIES } from '@/lib/worldCurrencies';
import type { ICFundAccount } from '@/types';
import type { ICFundAccountType } from '@/lib/icFunds/constants';

type AssignmentKind = 'direct' | 'branch';

interface ICFundAccountModalProps {
  branchId: string;
  open: boolean;
  account?: ICFundAccount | null;
  onClose: () => void;
  onSave: () => void;
  hqMode?: boolean;
  branches?: Array<{ id: string; name: string; slug: string }>;
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
  hqMode = false,
  branches = [],
}: ICFundAccountModalProps) {
  const operationalBranches = branches.filter(b => !isHqIcFundsBranch(b));
  const [formData, setFormData] = useState({
    name: '',
    accountType: 'personal' as ICFundAccountType,
    currency: 'AED',
    openingBalance: '0',
    notes: '',
    status: 'active',
    phone: '',
    email: '',
    password: '',
    requireSignIn: false,
    assignment: 'direct' as AssignmentKind,
    assignedBranchId: '',
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
        currency: account.currency || 'AED',
        openingBalance: String(account.openingBalance ?? '0'),
        notes: account.notes || '',
        status: account.status || 'active',
        phone: account.phone || '',
        email: account.email || '',
        password: '',
        requireSignIn: Boolean(account.hasPortalLogin),
        assignment: (account.isDirect ?? isHqIcFundsBranch({ id: account.branchId, slug: account.branchSlug ?? '' }))
          ? 'direct'
          : 'branch',
        assignedBranchId: (account.isDirect ?? isHqIcFundsBranch({ id: account.branchId, slug: account.branchSlug ?? '' }))
          ? ''
          : account.branchId,
      });
    } else {
      setFormData({
        name: '',
        accountType: 'personal',
        currency: 'AED',
        openingBalance: '0',
        notes: '',
        status: 'active',
        phone: '',
        email: '',
        password: '',
        requireSignIn: false,
        assignment: 'direct',
        assignedBranchId: '',
      });
    }
  }, [account, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'assignment' && value === 'direct' ? { assignedBranchId: '' } : {}),
      ...(name === 'accountType'
        ? {
            currency:
              value === 'collection_agent' && prev.currency === 'AED'
                ? 'SAR'
                : value !== 'collection_agent' && value !== 'personal' && prev.currency !== 'AED'
                  ? 'AED'
                  : prev.currency,
          }
        : {}),
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

  const targetBranchId = !hqMode
    ? branchId
    : formData.assignment === 'branch'
      ? formData.assignedBranchId
      : HQ_IC_FUNDS_BRANCH_ID;

  const portalFieldsValid =
    !formData.requireSignIn ||
    hasPortalLogin ||
    Boolean(formData.email.trim() && validatePassword(formData.password).isValid);

  const canSubmit =
    Boolean(formData.name.trim()) &&
    !(isNew && hqMode && formData.assignment === 'branch' && !formData.assignedBranchId) &&
    !(isNew && formData.requireSignIn && !portalFieldsValid) &&
    !(enablingPortalOnEdit && !portalFieldsValid);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Account name is required');
      return;
    }
    if (hqMode && isNew && formData.assignment === 'branch' && !formData.assignedBranchId) {
      alert('Select a branch for this branch customer');
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
            branchId: targetBranchId,
            name: formData.name,
            accountType: formData.accountType,
            currency: formData.currency,
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
            currency: formData.currency,
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
                ? 'Core ledger fields for this IC Funds account.'
                : 'Update name, type, balance, and notes for this account.'
            }
          >
            {hqMode ? (
              <AsicFormField
                label={formData.accountType === 'personal' ? 'Customer kind *' : 'Assignment *'}
                htmlFor="icf-account-assignment"
                colSpan={formData.assignment === 'branch' ? 6 : 12}
                hint={
                  isNew
                    ? formData.assignment === 'branch'
                      ? 'This record belongs to the selected branch.'
                      : 'Direct records stay on the HQ ledger.'
                    : 'Assignment cannot be changed after creation.'
                }
              >
                <select
                  id="icf-account-assignment"
                  name="assignment"
                  value={formData.assignment}
                  onChange={handleChange}
                  className={asicInput}
                  disabled={!isNew}
                >
                  <option value="direct">
                    {formData.accountType === 'personal' ? 'Direct customer' : 'Direct (HQ)'}
                  </option>
                  <option value="branch">
                    {formData.accountType === 'personal' ? 'Branch customer' : 'Branch'}
                  </option>
                </select>
              </AsicFormField>
            ) : null}

            {hqMode && formData.assignment === 'branch' ? (
              <AsicFormField label="Assign to branch *" htmlFor="icf-account-branch" colSpan={6}>
                <select
                  id="icf-account-branch"
                  name="assignedBranchId"
                  value={formData.assignedBranchId}
                  onChange={handleChange}
                  className={asicInput}
                  disabled={!isNew}
                  required={isNew}
                >
                  <option value="">Select a branch</option>
                  {operationalBranches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </AsicFormField>
            ) : null}

            <AsicFormField label="Account name *" htmlFor="icf-account-name" colSpan={6}>
              <input
                id="icf-account-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={asicInput}
                placeholder={formData.accountType === 'collection_agent' ? 'e.g. Ajeer' : 'e.g. Ahmed Al Mansoori'}
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
                placeholder="+971 50 123 4567"
              />
            </AsicFormField>

            <AsicFormField
              label="Account type"
              htmlFor="icf-account-type"
              colSpan={6}
              hint={IC_FUND_ACCOUNT_TYPE_OPTIONS.find(o => o.value === formData.accountType)?.hint}
            >
              <select
                id="icf-account-type"
                name="accountType"
                value={formData.accountType}
                onChange={handleChange}
                className={asicInput}
              >
                {IC_FUND_ACCOUNT_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </AsicFormField>

            <AsicFormField
              label="Currency"
              htmlFor="icf-account-currency"
              colSpan={6}
              hint={
                formData.accountType === 'collection_agent'
                  ? 'Wallet & remittance currency (e.g. SAR). Ledger posts in AED at FX settlement.'
                  : formData.accountType === 'personal'
                    ? 'Customer wallet/statement currency. Ledger balance stays in AED.'
                    : 'Must be AED — IC Funds uses company base currency only'
              }
            >
              <select
                id="icf-account-currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className={asicInput}
                disabled={formData.accountType !== 'collection_agent' && formData.accountType !== 'personal'}
              >
                {formData.accountType === 'collection_agent'
                  ? WORLD_CURRENCIES.filter(c => c.code !== 'AED').map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} — {c.name}
                      </option>
                    ))
                  : formData.accountType === 'personal'
                    ? WORLD_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>
                          {c.code} — {c.name}
                        </option>
                      ))
                    : (
                        <option value="AED">AED — UAE Dirham</option>
                      )}
              </select>
            </AsicFormField>

            <AsicFormField label="Opening balance" htmlFor="icf-account-opening" colSpan={6}>
              <input
                id="icf-account-opening"
                type="number"
                step="0.01"
                name="openingBalance"
                value={formData.openingBalance}
                onChange={handleChange}
                className={asicInput}
                placeholder="0.00"
              />
            </AsicFormField>

            <AsicFormField label="Notes" htmlFor="icf-account-notes" colSpan={12}>
              <textarea
                id="icf-account-notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className={asicTextarea}
                placeholder="Optional notes"
              />
            </AsicFormField>
          </ModalSection>

          <ModalSection
            title="Portal access"
            description={
              hasPortalLogin
                ? 'This account already has a portal login. Email cannot be changed here.'
                : 'Optionally create a portal login so the account holder can sign in with email and password.'
            }
          >
            <AsicFormField colSpan={12} className="lg:col-span-12">
              <ToggleSwitch
                checked={formData.requireSignIn}
                onChange={handleRequireSignInToggle}
                label="Require sign in"
                hint={
                  hasPortalLogin
                    ? 'Portal login is active for this account.'
                    : 'Create a portal login so this account holder can sign in with email and password.'
                }
                disabled={!isNew && hasPortalLogin}
              />
            </AsicFormField>

            {hasPortalLogin ? (
              <AsicFormField
                label="Portal email"
                htmlFor="icf-account-email"
                colSpan={6}
                hint="Portal login email cannot be changed after creation."
              >
                <input
                  id="icf-account-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={asicInput}
                  readOnly
                />
              </AsicFormField>
            ) : null}

            {formData.requireSignIn && !hasPortalLogin ? (
              <>
                <AsicFormField
                  label="Email *"
                  htmlFor="icf-account-portal-email"
                  colSpan={6}
                  hint="Used for portal sign-in."
                >
                  <input
                    id="icf-account-portal-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={asicInput}
                    placeholder="customer@example.com"
                    required
                  />
                </AsicFormField>

                <AsicFormField label="Portal password *" colSpan={6}>
                  <PasswordInput
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter secure password"
                    required
                    autoComplete="new-password"
                    inputClassName={asicInput}
                  />
                  <PasswordRequirements pw={formData.password} />
                </AsicFormField>
              </>
            ) : null}

            {hasPortalLogin && portalEmail ? (
              <AsicFormField colSpan={12} className="lg:col-span-12">
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Portal password</p>
                  <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
                    Set a new password for <strong>{portalEmail}</strong>.
                  </p>
                  <button
                    type="button"
                    className="mt-2 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 shadow-surface-xs hover:bg-amber-50 dark:border-amber-900/50 dark:bg-[var(--theme-surface)] dark:text-amber-200 dark:hover:bg-amber-950/30"
                    onClick={() => setShowResetPassword(true)}
                  >
                    Reset portal password
                  </button>
                </div>
              </AsicFormField>
            ) : null}
          </ModalSection>

          {!isNew ? (
            <ModalSection title="Status" description="Inactive accounts stay on the ledger but are hidden from pickers.">
              <AsicFormField label="Account status" htmlFor="icf-account-status" colSpan={6}>
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
            </ModalSection>
          ) : null}
        </div>
      </Modal>

      {portalEmail ? (
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
