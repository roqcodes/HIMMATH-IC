'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import ModalFormSection from '@/components/ui/ModalFormSection';
import ModalTwoColumnLayout from '@/components/ui/ModalTwoColumnLayout';
import { asicBtnOutline, asicBtnPrimary, asicInput } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { saveCounterpartyAction } from '@/app/actions/counterpartyActions';
import { parseFormAmount } from '@/lib/parseFormAmount';
import type { ICSupplier } from '@/types';
import {
  COUNTERPARTY_KINDS,
  COUNTERPARTY_ROLES,
  DEFAULT_COUNTERPARTY_ROLES,
  filterCounterpartiesByKind,
  normalizeCounterpartyKind,
  normalizeCounterpartyRoles,
  type CounterpartyKind,
  type CounterpartyRole,
} from '@/lib/counterparties/roles';

type Props = {
  open: boolean;
  counterparty?: ICSupplier | null;
  branchId?: string;
  branchSlug?: string;
  onClose: () => void;
  onSaved?: () => void;
};

const fieldClass = 'w-full max-w-none';

export default function CounterpartyModal({
  open,
  counterparty,
  branchId,
  branchSlug,
  onClose,
  onSaved,
}: Props) {
  const { addICSupplier, updateICSupplier, icSuppliers } = useApp();
  const isEdit = Boolean(counterparty?.id);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [kind, setKind] = useState<CounterpartyKind>('customer');
  const [homeManagerId, setHomeManagerId] = useState('');
  const [roles, setRoles] = useState<CounterpartyRole[]>([...DEFAULT_COUNTERPARTY_ROLES]);
  const [openingAed, setOpeningAed] = useState('0');
  const [openingInr, setOpeningInr] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  const toggleRole = (role: CounterpartyRole) => {
    setRoles(prev => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      const ordered = COUNTERPARTY_ROLES.filter(r => next.has(r));
      return ordered.length > 0 ? ordered : [...DEFAULT_COUNTERPARTY_ROLES];
    });
  };

  useEffect(() => {
    if (!open) return;
    if (counterparty) {
      setName(counterparty.name || '');
      setCode(counterparty.code || '');
      setPhone(counterparty.phone || '');
      setEmail(counterparty.email || '');
      setStreet(counterparty.address || '');
      setCity(counterparty.locality || '');
      setState(counterparty.subdivision || '');
      setStatus(counterparty.status === 'inactive' ? 'inactive' : 'active');
      setKind(normalizeCounterpartyKind(counterparty.kind));
      setHomeManagerId(counterparty.homeManagerId || '');
      setRoles(normalizeCounterpartyRoles(counterparty.roles));
      setOpeningAed(String(counterparty.openingAed ?? 0));
      setOpeningInr(String(counterparty.openingInr ?? 0));
    } else {
      setName('');
      setCode('');
      setPhone('');
      setEmail('');
      setStreet('');
      setCity('');
      setState('');
      setStatus('active');
      setKind('customer');
      setHomeManagerId('');
      setRoles([...DEFAULT_COUNTERPARTY_ROLES]);
      setOpeningAed('0');
      setOpeningInr('0');
    }
  }, [open, counterparty]);

  const managerOptions = React.useMemo(
    () => filterCounterpartiesByKind(icSuppliers, 'manager'),
    [icSuppliers],
  );

  const canSubmit =
    name.trim().length > 0 &&
    (kind === 'manager' || (kind === 'customer' && homeManagerId.trim().length > 0));

  const handleSave = async () => {
    if (!canSubmit) return;
    setIsSaving(true);
    const streetTrim = street.trim();
    const cityTrim = city.trim();
    const stateTrim = state.trim();
    const regionId = counterparty?.regionId || '';
    const aed = parseFormAmount(openingAed);
    const inr = parseFormAmount(openingInr);
    if (aed === null || inr === null) {
      alert('Enter valid opening balances');
      setIsSaving(false);
      return;
    }
    const openings = { openingAed: aed, openingInr: inr };

    let ok = false;
    if (branchSlug) {
      const res = await saveCounterpartyAction(branchSlug, {
        id: counterparty?.id,
        name: name.trim(),
        code: code.trim() || null,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: streetTrim || undefined,
        subdivision: stateTrim || undefined,
        locality: cityTrim || undefined,
        status,
        kind,
        homeManagerId: kind === 'customer' ? homeManagerId : null,
        roles: kind === 'customer' ? roles : [],
        openingAed: aed,
        openingInr: inr,
      });
      ok = res.success;
      if (!ok && res.error) alert(res.error);
    } else if (isEdit && counterparty) {
      ok = await updateICSupplier(
        counterparty.id,
        name.trim(),
        code.trim(),
        phone.trim(),
        null,
        regionId,
        email.trim(),
        streetTrim,
        '',
        stateTrim,
        cityTrim,
        kind === 'customer' ? roles : [],
        openings,
        kind,
        kind === 'customer' ? homeManagerId : null,
      );
    } else {
      ok = await addICSupplier(
        name.trim(),
        code.trim(),
        phone.trim(),
        null,
        regionId,
        email.trim(),
        streetTrim,
        '',
        stateTrim,
        cityTrim,
        branchId,
        kind === 'customer' ? roles : [],
        openings,
        kind,
        kind === 'customer' ? homeManagerId : null,
      );
    }
    setIsSaving(false);
    if (ok) {
      onSaved?.();
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit party' : 'Add manager or customer'}
      maxWidth="max-w-4xl w-[min(95vw,56rem)]"
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className={asicBtnPrimary} onClick={() => void handleSave()} disabled={!canSubmit || isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add counterparty'}
          </button>
        </>
      }
    >
      <ModalTwoColumnLayout
        left={
          <ModalFormSection title="Identity">
            <AsicFormField label="Name *" className={fieldClass}>
              <input className={asicInput} value={name} onChange={e => setName(e.target.value)} />
            </AsicFormField>
            <AsicFormField label="Code" className={fieldClass}>
              <input className={asicInput} value={code} onChange={e => setCode(e.target.value)} />
            </AsicFormField>
            <AsicFormField label="Kind" className={fieldClass}>
              <select
                className={asicInput}
                value={kind}
                onChange={e => {
                  const next = e.target.value as CounterpartyKind;
                  setKind(next);
                  if (next === 'manager') {
                    setHomeManagerId('');
                    setRoles([]);
                  } else if (roles.length === 0) {
                    setRoles([...DEFAULT_COUNTERPARTY_ROLES]);
                  }
                }}
              >
                {COUNTERPARTY_KINDS.map(k => (
                  <option key={k} value={k}>
                    {k === 'manager' ? 'Manager' : 'Customer'}
                  </option>
                ))}
              </select>
            </AsicFormField>
            {kind === 'customer' ? (
              <AsicFormField label="Home manager *" className={fieldClass}>
                <select
                  className={asicInput}
                  value={homeManagerId}
                  onChange={e => setHomeManagerId(e.target.value)}
                >
                  <option value="">Select manager…</option>
                  {managerOptions.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </AsicFormField>
            ) : null}
            <AsicFormField label="Status" className={fieldClass}>
              <select className={asicInput} value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </AsicFormField>
            {kind === 'customer' ? (
              <AsicFormField label="Customer roles" className={fieldClass}>
                <div className="flex flex-wrap gap-3 pt-1">
                  {COUNTERPARTY_ROLES.map(role => (
                    <label key={role} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      {role === 'party' ? 'Party (sales)' : role === 'supplier' ? 'Supplier (purchases)' : 'Agent (metal AED)'}
                    </label>
                  ))}
                </div>
              </AsicFormField>
            ) : null}
          </ModalFormSection>
        }
        right={
          <>
            <ModalFormSection title="Contact & address">
              <AsicFormField label="Phone" className={fieldClass}>
                <input className={asicInput} value={phone} onChange={e => setPhone(e.target.value)} />
              </AsicFormField>
              <AsicFormField label="Email" className={fieldClass}>
                <input className={asicInput} type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </AsicFormField>
              <AsicFormField label="Street" className={fieldClass}>
                <input className={asicInput} value={street} onChange={e => setStreet(e.target.value)} placeholder="Building, street, area" />
              </AsicFormField>
              <AsicFormField label="City" className={fieldClass}>
                <input className={asicInput} value={city} onChange={e => setCity(e.target.value)} />
              </AsicFormField>
              <AsicFormField label="State" className={fieldClass}>
                <input className={asicInput} value={state} onChange={e => setState(e.target.value)} />
              </AsicFormField>
            </ModalFormSection>
            <ModalFormSection
              title="Opening balances"
              description="Starting AED and INR ledger balances. Locked after entries exist."
            >
              <AsicFormField label="Opening AED" htmlFor="cp-opening-aed" className={fieldClass}>
                <input
                  id="cp-opening-aed"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingAed}
                  onChange={e => setOpeningAed(e.target.value)}
                />
              </AsicFormField>
              <AsicFormField label="Opening INR" htmlFor="cp-opening-inr" className={fieldClass}>
                <input
                  id="cp-opening-inr"
                  className={`${asicInput} tabular-nums`}
                  inputMode="decimal"
                  value={openingInr}
                  onChange={e => setOpeningInr(e.target.value)}
                />
              </AsicFormField>
            </ModalFormSection>
          </>
        }
      />
    </Modal>
  );
}
