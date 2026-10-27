import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/ui/PasswordInput';
import SearchableSelect from '@/components/ui/SearchableSelect';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicBtnOutline, asicBtnPrimary, asicFormGrid, asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { saveCustomer, resetCustomerPasswordAction } from '@/app/actions/customerActions';
import { PasswordRequirements, ResetPasswordModal } from '@/components/users/UserModals';
import { validatePassword } from '@/lib/passwordValidation';
import { WORLD_CURRENCIES } from '@/lib/worldCurrencies';

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
    currency?: string;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function CustomerModal({ slug, open, customer, onClose, onSave }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    balance: '0',
    status: 'active',
    currency: 'AED',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const isNew = !customer;

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        password: '',
        balance: String(customer.balance ?? '0'),
        status: customer.status || 'active',
        currency: (customer as Record<string, unknown>).currency as string || 'AED',
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        password: '',
        balance: '0',
        status: 'active',
        currency: 'AED',
      });
    }
  }, [customer, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const currencyOptions = WORLD_CURRENCIES.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }));

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Customer name is required');
      return;
    }
    if (isNew && !formData.email.trim()) {
      alert('Email is required to create a customer portal account');
      return;
    }
    if (isNew && !validatePassword(formData.password).isValid) {
      return;
    }

    setIsSaving(true);
    const res = await saveCustomer(slug, {
      id: customer?.id,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      password: isNew ? formData.password : undefined,
      balance: formData.balance,
      status: formData.status,
      currency: formData.currency,
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
      title={customer ? 'Edit Customer' : 'New Customer'}
      maxWidth="max-w-4xl w-[95vw]"
      footer={
        <>
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || (isNew && !validatePassword(formData.password).isValid)}
            className={`${btnPrimary} ${isSaving || (isNew && !validatePassword(formData.password).isValid) ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {isSaving ? 'Saving...' : customer ? 'Save Changes' : 'Create Customer'}
          </button>
        </>
      }
    >
      <div className={asicFormGrid}>
        <AsicFormField label="Customer name *" htmlFor="customer-name" colSpan={6}>
          <input
            id="customer-name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={asicInput}
            placeholder="e.g. Ahmed Al Mansoori"
            required
          />
        </AsicFormField>

        <AsicFormField label="Phone" htmlFor="customer-phone" colSpan={6}>
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

        <AsicFormField
          label={`Email${isNew ? ' *' : ''}`}
          htmlFor="customer-email"
          colSpan={6}
          hint={
            !isNew && customer?.cognitoUserId
              ? 'Portal login email cannot be changed after account creation.'
              : isNew
                ? 'Used for customer portal sign-in.'
                : undefined
          }
        >
          <input
            id="customer-email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={asicInput}
            placeholder="customer@example.com"
            required={isNew}
            readOnly={!isNew && !!customer?.cognitoUserId}
          />
        </AsicFormField>

        {isNew ? (
          <AsicFormField label="Portal password *" colSpan={6} hint="Customer signs in with this email and password.">
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
        ) : null}

        <AsicFormField label="Balance (AED)" htmlFor="customer-balance" colSpan={4} hint="Leave as 0 if no opening balance.">
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

        <AsicFormField label="Default currency" colSpan={4} hint="Base currency for this customer.">
          <SearchableSelect
            options={currencyOptions}
            value={formData.currency}
            onChange={value => setFormData(prev => ({ ...prev, currency: value }))}
            placeholder="Select currency..."
          />
        </AsicFormField>

        <AsicFormField label="Status" htmlFor="customer-status" colSpan={4}>
          <select id="customer-status" name="status" value={formData.status} onChange={handleChange} className={asicInput}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </AsicFormField>

        {!isNew && customer?.cognitoUserId && customer.email ? (
          <AsicFormField colSpan={12} className="lg:col-span-12">
            <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2">
              <p className="text-[11px] font-medium text-amber-800">Portal password</p>
              <p className="mt-0.5 text-[11px] text-amber-700">
                Set a new password for <strong>{customer.email}</strong>.
              </p>
              <button
                type="button"
                className="mt-2 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
                onClick={() => setShowResetPassword(true)}
              >
                Reset portal password
              </button>
            </div>
          </AsicFormField>
        ) : null}
      </div>
    </Modal>

    {customer?.email ? (
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
