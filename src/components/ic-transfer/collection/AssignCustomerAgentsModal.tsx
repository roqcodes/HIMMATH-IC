'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import {
  asicBtnOutline,
  asicBtnPrimary,
  asicFormGrid,
  asicInput,
} from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import { getAllCustomers, getCustomersBySlug } from '@/app/actions/customerActions';
import {
  listCustomerCollectionAgentsAction,
  setCustomerCollectionAgentsAction,
} from '@/app/actions/customerCollectionAgentActions';
import { listCollectionAgentAccountsAction } from '@/app/actions/saleFxSettlementActions';
import { trackLoading } from '@/lib/loadingBar';
import type { FxCustomerRow } from './FxCustomersPanel';

type CustomerOption = {
  id: string;
  name: string;
  currency: string;
  branchName?: string;
  needsProfileCurrency?: boolean;
  saleCurrency?: string;
};

type AgentOption = {
  id: string;
  name: string;
  currency: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  branchSlug?: string;
  initialCustomerId?: string;
  overviewCustomers?: FxCustomerRow[];
  onSuccess?: () => void;
};

function isForeignCurrency(currency?: string | null): currency is string {
  return Boolean(currency && currency.toUpperCase() !== 'AED');
}

function effectiveCustomerCurrency(c: {
  profileCurrency?: string;
  effectiveCurrency?: string;
  saleCurrency?: string;
  currency?: string;
}): string {
  if (c.effectiveCurrency) return c.effectiveCurrency.toUpperCase();
  if (c.currency && isForeignCurrency(c.currency)) return c.currency.toUpperCase();
  if (c.saleCurrency) return c.saleCurrency.toUpperCase();
  return (c.profileCurrency || c.currency || 'AED').toUpperCase();
}

export default function AssignCustomerAgentsModal({
  open,
  onClose,
  branchSlug,
  initialCustomerId,
  overviewCustomers,
  onSuccess,
}: Props) {
  const { showToast } = useApp();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [allAgents, setAllAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCustomer = customers.find(c => c.id === customerId);
  const customerCurrency = selectedCustomer ? effectiveCustomerCurrency(selectedCustomer) : '';

  const agentOptions = useMemo(
    () => allAgents.filter(a => a.currency === customerCurrency),
    [allAgents, customerCurrency],
  );

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        (c.branchName || '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearch('');
    setSelected([]);
    setPrimaryId('');

    const loadCustomers = async (): Promise<CustomerOption[]> => {
      if (overviewCustomers && overviewCustomers.length > 0) {
        return overviewCustomers.map(c => ({
          id: c.id,
          name: c.name,
          currency: c.effectiveCurrency,
          branchName: c.branchName,
          needsProfileCurrency: c.needsProfileCurrency,
          saleCurrency: c.saleCurrency,
        }));
      }

      const custRes = branchSlug ? await getCustomersBySlug(branchSlug) : await getAllCustomers();
      if (!custRes.success || !custRes.customers) return [];
      return custRes.customers
        .filter(c => c.status === 'active' && isForeignCurrency(c.currency))
        .map(c => ({
          id: c.id,
          name: c.name,
          currency: c.currency!,
        }));
    };

    void Promise.all([loadCustomers(), listCollectionAgentAccountsAction(branchSlug)]).then(
      ([loadedCustomers, agentRes]) => {
        setCustomers(loadedCustomers);
        if (initialCustomerId && loadedCustomers.some(c => c.id === initialCustomerId)) {
          setCustomerId(initialCustomerId);
        } else {
          setCustomerId('');
        }

        if (!agentRes.success || !agentRes.accounts) {
          showToast(agentRes.error || 'Failed to load agents', 'error');
          setAllAgents([]);
        } else {
          setAllAgents(
            agentRes.accounts.map(a => ({
              id: a.id,
              name: a.name,
              currency: a.currency,
            })),
          );
        }
        setLoading(false);
      },
    );
  }, [open, branchSlug, showToast, overviewCustomers, initialCustomerId]);

  useEffect(() => {
    if (!open || !customerId) return;
    void listCustomerCollectionAgentsAction(customerId, branchSlug).then(res => {
      if (!res.success || !res.agents) {
        setSelected([]);
        setPrimaryId('');
        return;
      }
      const ids = res.agents.map(a => a.collectionAccountId);
      setSelected(ids);
      setPrimaryId(res.agents.find(a => a.isPrimary)?.collectionAccountId || ids[0] || '');
    });
  }, [open, customerId, branchSlug]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (!next.includes(primaryId)) setPrimaryId(next[0] || '');
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || selected.length === 0) {
      showToast('Select a customer and at least one agent', 'error');
      return;
    }
    if (selectedCustomer?.needsProfileCurrency) {
      showToast('Set customer profile currency before assigning agents', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        setCustomerCollectionAgentsAction(
          {
            customerId,
            collectionAccountIds: selected,
            primaryCollectionAccountId: primaryId || selected[0],
          },
          branchSlug,
        ),
      );
      if (!res.success) {
        showToast(res.error || 'Failed to save', 'error');
        return;
      }
      showToast('Collection agents assigned');
      onSuccess?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign collection agents"
      maxWidth="max-w-3xl w-[95vw]"
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="assign-customer-agents-form"
            className={asicBtnPrimary}
            disabled={saving || loading || !customerId || selected.length === 0}
          >
            {saving ? 'Saving…' : 'Save assignment'}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-800">No FX customers found</p>
          <p className="mt-1 text-xs text-slate-500">
            Register foreign-currency sales or set customer profile currency (not AED) under Customers.
          </p>
        </div>
      ) : (
        <form id="assign-customer-agents-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Link one or more collection agents before wallet payments. Agent currency must match the
            customer currency.
          </p>

          <div className={asicFormGrid}>
            <AsicFormField label="Search customers" htmlFor="fx-assign-search" colSpan={12}>
              <input
                id="fx-assign-search"
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={asicInput}
                placeholder="Filter by name, branch, or currency…"
              />
            </AsicFormField>

            <AsicFormField label="Customer *" htmlFor="fx-assign-customer" colSpan={12}>
              <select
                id="fx-assign-customer"
                className={asicInput}
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select customer…</option>
                {filteredCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.branchName ? ` · ${c.branchName}` : ''} ({c.currency})
                    {c.needsProfileCurrency ? ' · profile AED' : ''}
                  </option>
                ))}
              </select>
            </AsicFormField>
          </div>

          {selectedCustomer?.needsProfileCurrency ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <p className="font-medium">Customer profile currency required</p>
              <p className="mt-0.5 text-xs">
                {selectedCustomer.name} has {selectedCustomer.saleCurrency} sales but profile currency is
                still AED. Edit the customer and set currency to {selectedCustomer.saleCurrency} before
                assigning agents.
              </p>
            </div>
          ) : null}

          {customerId && !selectedCustomer?.needsProfileCurrency ? (
            agentOptions.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No {customerCurrency} collection agents found. Create a {customerCurrency} collection agent
                under Accounts first.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="border-b border-slate-200 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Agents · {customerCurrency}
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {agentOptions.map(opt => {
                    const checked = selected.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          className="size-4 rounded border-slate-300"
                          checked={checked}
                          onChange={() => toggle(opt.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">{opt.name}</p>
                          <p className="text-[11px] text-slate-400">{opt.currency}</p>
                        </div>
                        {checked ? (
                          <label className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input
                              type="radio"
                              name="primary-agent-fx"
                              checked={primaryId === opt.id}
                              onChange={() => setPrimaryId(opt.id)}
                            />
                            Primary
                          </label>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            )
          ) : null}
        </form>
      )}
    </Modal>
  );
}
