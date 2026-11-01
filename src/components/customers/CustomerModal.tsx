'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import AsianUnifiedLocationSelect from '@/components/ui/AsianUnifiedLocationSelect';
import { asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { saveCustomer } from '@/app/actions/customerActions';
import { isAsianLocationFormValid } from '@/lib/geo/locationFormValidation';

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
    code?: string | null;
    country?: string | null;
    subdivision?: string | null;
    locality?: string | null;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

const fieldClass = 'w-full max-w-none';

export default function CustomerModal({ slug, open, customer, onClose, onSave }: CustomerModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    balance: '0',
    status: 'active',
    country: '',
    subdivision: '',
    locality: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const isNew = !customer;
  const hasPortalLogin = Boolean(customer?.cognitoUserId);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setFormData({
        name: customer.name || '',
        code: customer.code || '',
        phone: customer.phone || '',
        email: customer.email || '',
        balance: String(customer.balance ?? '0'),
        status: customer.status || 'active',
        country: customer.country || '',
        subdivision: customer.subdivision || '',
        locality: customer.locality || '',
      });
    } else {
      setFormData({
        name: '',
        code: '',
        phone: '',
        email: '',
        balance: '0',
        status: 'active',
        country: '',
        subdivision: '',
        locality: '',
      });
    }
  }, [customer, open]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const locationValid = isAsianLocationFormValid(
    formData.country,
    formData.subdivision,
    formData.locality,
    { requireCountry: true },
  );

  const canSubmit = formData.name.trim().length > 0 && locationValid;

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Customer name is required');
      return;
    }
    if (!locationValid) return;

    setIsSaving(true);
    const res = await saveCustomer(slug, {
      id: customer?.id,
      name: formData.name,
      code: formData.code.trim() || null,
      phone: formData.phone,
      email: formData.email,
      balance: formData.balance,
      status: formData.status,
      enablePortalLogin: hasPortalLogin,
      country: formData.country.trim(),
      subdivision: formData.subdivision.trim(),
      locality: formData.locality.trim(),
    });
    setIsSaving(false);

    if (res.success) {
      onSave();
    } else {
      alert('Failed to save customer: ' + res.error);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      maxWidth="max-w-4xl w-[min(95vw,56rem)]"
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
      <ModalTwoColumnLayout
        left={
          <ModalFormSection title="Customer" description="Name and contact details.">
            <AsicFormField label="Name *" htmlFor="customer-name" className={fieldClass}>
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
            <AsicFormField
              label="Code"
              htmlFor="customer-code"
              className={fieldClass}
              hint="Optional short ID for search (letters, numbers, dash, underscore)."
            >
              <input
                id="customer-code"
                type="text"
                name="code"
                value={formData.code}
                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                className={asicInput}
                placeholder="e.g. CUST01"
                maxLength={32}
              />
            </AsicFormField>
            <AsicFormField label="Phone" htmlFor="customer-phone" className={fieldClass}>
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
            <AsicFormField label="Email" htmlFor="customer-email" className={fieldClass}>
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
          </ModalFormSection>
        }
        right={
          <>
            <ModalFormSection
              title="Location *"
              description="Pick from search. Examples: India · Kerala, India · Kochi, Kerala, India."
            >
              <AsianUnifiedLocationSelect
                country={formData.country}
                province={formData.subdivision}
                locality={formData.locality}
                onChange={next =>
                  setFormData(prev => ({
                    ...prev,
                    country: next.country,
                    subdivision: next.province,
                    locality: next.locality,
                  }))
                }
              />
            </ModalFormSection>
            {isNew ? (
              <ModalFormSection title="Accounts" description="Ledger opening balance on HQ.">
                <AsicFormField
                  label="Opening balance (AED)"
                  htmlFor="customer-balance"
                  className={fieldClass}
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
              </ModalFormSection>
            ) : null}
          </>
        }
      />
    </Modal>
  );
}
