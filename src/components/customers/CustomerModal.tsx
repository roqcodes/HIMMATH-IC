'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/ui/PasswordInput';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicCard, asicFormGrid, asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { saveCustomer, resetCustomerPasswordAction } from '@/app/actions/customerActions';
import { PasswordRequirements, ResetPasswordModal } from '@/components/users/UserModals';
import { validatePassword } from '@/lib/passwordValidation';

interface CustomerModalProps {
  slug: string;
  open: boolean;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    balance?: string | number;
    status?: string;
    cognitoUserId?: string | null;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

function ModalSection({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${asicCard} flex h-full flex-col p-4 sm:p-5 ${className}`}>
      <header className="mb-3 shrink-0 border-b border-slate-100 pb-2.5 dark:border-[var(--theme-border-subtle)]">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-[var(--theme-text)]">
          {title}
        </h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-[var(--theme-text-secondary)]">
            {description}
          </p>
        ) : null}
      </header>
      <div className={`${asicFormGrid} min-h-0 flex-1`}>{children}</div>
    </section>
  );
}

export default function CustomerModal({ slug, open, customer, onClose, onSave }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    balance: '0',
    status: 'active',
  });
  const [enablePortalLogin, setEnablePortalLogin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const isNew = !customer;
  const hasPortalLogin = Boolean(customer?.cognitoUserId);
  const showPortalCredentials = enablePortalLogin || hasPortalLogin;

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        password: '',
        balance: String(customer.balance ?? '0'),
        status: customer.status || 'active',
      });
      setEnablePortalLogin(Boolean(customer.cognitoUserId));
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        password: '',
        balance: '0',
        status: 'active',
      });
      setEnablePortalLogin(false);
    }
  }, [customer, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const portalFieldsValid =
    !enablePortalLogin ||
    (formData.email.trim().length > 0 &&
      (hasPortalLogin || validatePassword(formData.password).isValid));

  const canSubmit = formData.name.trim().length > 0 && portalFieldsValid;

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Customer name is required');
      return;
    }
    if (enablePortalLogin && !hasPortalLogin && !formData.email.trim()) {
      alert('Email is required when customer portal login is enabled');
      return;
    }
    if (enablePortalLogin && !hasPortalLogin && !validatePassword(formData.password).isValid) {
      return;
    }

    setIsSaving(true);
    const res = await saveCustomer(slug, {
      id: customer?.id,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      password: enablePortalLogin && !hasPortalLogin ? formData.password : undefined,
      balance: formData.balance,
      status: formData.status,
      enablePortalLogin: enablePortalLogin || hasPortalLogin,
    });
    setIsSaving(false);

    if (res.success) {
      onSave();
    } else {
      alert('Failed to save customer: ' + res.error);
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    if (!customer?.id) return;
    const res = await resetCustomerPasswordAction(slug, customer.id, newPassword);
    if (res.success) {
      setShowResetPassword(false);
      alert('Portal password reset successfully.');
    } else {
      alert(res.error || 'Failed to reset password');
      throw new Error(res.error || 'Failed to reset password');
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={customer ? 'Edit customer' : 'New customer'}
        maxWidth="max-w-4xl w-[min(95vw,56rem)]"
        maxHeight="sm:max-h-[min(90dvh,680px)]"
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
              {isSaving ? 'Saving…' : customer ? 'Save changes' : 'Create customer'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-5">
          <ModalSection
            title="Customer details"
            description={
              isNew
                ? 'Name and ledger fields for this customer on HQ.'
                : 'Update identity, opening balance, and active status.'
            }
          >
            <AsicFormField label="Customer name *" htmlFor="customer-name" colSpan={12}>
              <input
                id="customer-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={asicInput}
                placeholder="e.g. Ahmed Al Mansoori"
                required
                autoFocus
              />
            </AsicFormField>

            <AsicFormField label="Phone" htmlFor="customer-phone" colSpan={12}>
              <input
                id="customer-phone"
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={asicInput}
                placeholder="+971 50 123 4567"
              />
            </AsicFormField>

            <AsicFormField label="Status" htmlFor="customer-status" colSpan={12}>
              <select
                id="customer-status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={asicInput}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </AsicFormField>

            <AsicFormField
              label="Opening balance (AED)"
              htmlFor="customer-balance"
              colSpan={12}
              hint="Leave as 0 if no opening balance."
            >
              <input
                id="customer-balance"
                type="number"
                step="0.01"
                name="balance"
                value={formData.balance}
                onChange={handleChange}
                className={asicInput}
                placeholder="0.00"
              />
            </AsicFormField>

            {!showPortalCredentials ? (
              <AsicFormField
                label="Contact email"
                htmlFor="customer-email"
                colSpan={12}
                hint="Optional. Enable portal sign-in on the right to use this as login email."
              >
                <input
                  id="customer-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={asicInput}
                  placeholder="customer@example.com"
                />
              </AsicFormField>
            ) : null}
          </ModalSection>

          <ModalSection
            title="Customer portal"
            description="Optional. Lets this customer sign in to place orders and view balances."
          >
            <AsicFormField label="Portal access" colSpan={12}>
              <ToggleSwitch
                checked={enablePortalLogin || hasPortalLogin}
                onChange={checked => {
                  setEnablePortalLogin(checked);
                  if (!checked) {
                    setFormData(prev => ({ ...prev, password: '' }));
                  }
                }}
                disabled={hasPortalLogin}
                label={hasPortalLogin ? 'Portal login enabled' : 'Enable customer sign-in'}
              />
            </AsicFormField>

            {showPortalCredentials ? (
              <>
                <AsicFormField
                  label={`Sign-in email${!hasPortalLogin ? ' *' : ''}`}
                  htmlFor="customer-email-portal"
                  colSpan={12}
                  hint={
                    hasPortalLogin
                      ? 'Login email cannot be changed after the account is created.'
                      : 'Used for customer portal sign-in.'
                  }
                >
                  <input
                    id="customer-email-portal"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={asicInput}
                    placeholder="customer@example.com"
                    required={!hasPortalLogin}
                    readOnly={hasPortalLogin}
                  />
                </AsicFormField>

                {!hasPortalLogin ? (
                  <AsicFormField
                    label="Portal password *"
                    colSpan={12}
                    hint="Customer signs in with the email and password above."
                  >
                    <PasswordInput
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter secure password"
                      autoComplete="new-password"
                      inputClassName={asicInput}
                    />
                    <PasswordRequirements pw={formData.password} />
                  </AsicFormField>
                ) : customer?.email ? (
                  <AsicFormField label="Password" colSpan={12}>
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => setShowResetPassword(true)}
                    >
                      Reset portal password
                    </button>
                  </AsicFormField>
                ) : null}
              </>
            ) : (
              <p className="col-span-12 text-xs leading-relaxed text-slate-500 dark:text-[var(--theme-text-secondary)]">
                Turn on sign-in to set portal email and password. Ledger-only customers need only the fields on the
                left.
              </p>
            )}
          </ModalSection>
        </div>
      </Modal>

      {customer?.email && hasPortalLogin ? (
        <ResetPasswordModal
          open={showResetPassword}
          onClose={() => setShowResetPassword(false)}
          email={customer.email}
          onReset={handleResetPassword}
        />
      ) : null}
    </>
  );
}
