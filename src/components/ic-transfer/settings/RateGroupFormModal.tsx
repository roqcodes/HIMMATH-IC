'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ComboSearchInput from '@/components/ui/ComboSearchInput';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicFormGrid, asicInput } from '@/components/asic/ui';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { countryForCurrency } from '@/lib/icTransfer/currencyCountry';
import type { ICRateGroup } from '@/types';

const WORLD_CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS',
  'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR',
  'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD',
  'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU',
  'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK',
  'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG',
  'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK',
  'SGD', 'SHP', 'SLL', 'SOS', 'SRD', 'SSP', 'STN', 'SVC', 'SYP', 'SZL',
  'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH',
  'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
  'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
];

export type RateGroupFormValues = {
  name: string;
  country: string;
  currency: string;
};

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  initialGroup: ICRateGroup | null;
  isSaving: boolean;
  /** When set, currency is fixed to match the admin-assigned branch rate. */
  lockedCurrency?: string;
  onClose: () => void;
  onSubmit: (values: RateGroupFormValues) => void | Promise<void>;
};

export default function RateGroupFormModal({
  open,
  mode,
  initialGroup,
  isSaving,
  lockedCurrency,
  onClose,
  onSubmit,
}: Props) {
  const isEdit = mode === 'edit';

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');

  useEffect(() => {
    if (!open) return;
    if (initialGroup) {
      setName(initialGroup.name);
      setCountry(initialGroup.country);
      setCurrency(initialGroup.currency);
    } else {
      setName('');
      setCountry(lockedCurrency ? (countryForCurrency(lockedCurrency) ?? '') : '');
      setCurrency(lockedCurrency ?? '');
    }
  }, [open, initialGroup, lockedCurrency]);

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    const suggested = countryForCurrency(value);
    // Changing the currency always updates the country to the matching one.
    if (suggested) setCountry(suggested);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      country,
      currency: lockedCurrency ?? currency,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Rate Group' : 'Create Rate Group'}
      maxWidth="max-w-3xl w-[95vw]"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" form="rateGroupForm" className={btnPrimary} disabled={isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Group'}
          </button>
        </>
      }
    >
      <form id="rateGroupForm" onSubmit={handleSubmit}>
        <div className={asicFormGrid}>
          <AsicFormField label="Group name" colSpan={4}>
            <input
              className={asicInput}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Premium Asia"
              required
            />
          </AsicFormField>
          <AsicFormField
            label="Currency"
            colSpan={4}
            hint={lockedCurrency ? 'Must match your admin-assigned branch currency.' : undefined}
          >
            {lockedCurrency ? (
              <input className={`${asicInput} cursor-not-allowed bg-slate-50 text-slate-600`} value={lockedCurrency} readOnly disabled />
            ) : (
              <ComboSearchInput
                value={currency}
                onChange={handleCurrencyChange}
                options={WORLD_CURRENCIES.map(c => ({ value: c, label: c }))}
                placeholder="Search or select currency…"
              />
            )}
          </AsicFormField>
          <AsicFormField label="Country" colSpan={4}>
            <input className={asicInput} value={country} onChange={e => setCountry(e.target.value)} required />
          </AsicFormField>
        </div>

        {!isEdit ? (
          <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Sale rate and conversion can be configured via bulk update. Assign branches and customers using Manage Users.
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
