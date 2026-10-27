'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { btnPrimary, btnSecondary } from '@/lib/ui';
import { asicCard } from '@/components/asic/ui';
import { badgeClass } from '@/lib/badgeClass';
import { useApp } from '@/context/AppContext';
import {
  listCustomerCollectionAgentsAction,
  setCustomerCollectionAgentsAction,
} from '@/app/actions/customerCollectionAgentActions';
import { listCollectionAgentAccountsAction } from '@/app/actions/saleFxSettlementActions';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { trackLoading } from '@/lib/loadingBar';

type AgentLink = {
  id: string;
  collectionAccountId: string;
  collectionAccountName: string;
  currency: string;
  isPrimary: boolean;
};

type Props = {
  customerId: string;
  customerCurrency: string;
  branchSlug?: string;
  canWrite: boolean;
};

export default function CustomerCollectionAgentsSection({
  customerId,
  customerCurrency,
  branchSlug,
  canWrite,
}: Props) {
  const { showToast } = useApp();
  const [agents, setAgents] = useState<AgentLink[]>([]);
  const [options, setOptions] = useState<Array<{ id: string; name: string; currency: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [linkRes, optRes] = await Promise.all([
      listCustomerCollectionAgentsAction(customerId, branchSlug),
      listCollectionAgentAccountsAction(branchSlug),
    ]);
    if (linkRes.success && linkRes.agents) {
      setAgents(linkRes.agents);
      setSelected(linkRes.agents.map(a => a.collectionAccountId));
      setPrimaryId(
        linkRes.agents.find(a => a.isPrimary)?.collectionAccountId ||
          linkRes.agents[0]?.collectionAccountId ||
          '',
      );
    }
    if (optRes.success && optRes.accounts) {
      const cur = customerCurrency.toUpperCase();
      setOptions(
        optRes.accounts.filter(a => a.currency === cur || a.currency === customerCurrency.toUpperCase()),
      );
    }
    setLoading(false);
  }, [customerId, branchSlug, customerCurrency]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (!next.includes(primaryId)) setPrimaryId(next[0] || '');
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.length === 0) {
      showToast('Select at least one collection agent', 'error');
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
      showToast('Collection agents updated');
      setEditing(false);
      void load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 dark:text-[var(--theme-text-secondary)]">Loading agents…</p>;
  }

  return (
    <div className="space-y-3">
      {canWrite ? (
        <div className="flex justify-end">
          {editing ? (
            <div className="flex gap-2">
              <button type="button" className={btnSecondary} onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={btnPrimary} onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Saving…' : 'Save agents'}
              </button>
            </div>
          ) : (
            <button type="button" className={btnSecondary} onClick={() => setEditing(true)}>
              Edit agents
            </button>
          )}
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-2 rounded-lg border border-[var(--theme-border-subtle)] bg-[var(--theme-surface-raised)] p-3 dark:bg-[var(--theme-surface-muted)]">
          {options.length === 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              No {customerCurrency} collection agents found. Create one in IC Funds.
            </p>
          ) : (
            options.map(opt => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/60 dark:hover:bg-[var(--theme-surface-hover)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="rounded border-[var(--theme-border-field)]"
                />
                <span className="font-medium text-slate-900 dark:text-[var(--theme-text)]">{opt.name}</span>
                <span className="font-mono text-xs text-slate-400 dark:text-[var(--theme-text-muted)]">
                  {opt.currency}
                </span>
                {selected.includes(opt.id) ? (
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 dark:text-[var(--theme-text-secondary)]">
                    <input
                      type="radio"
                      name="primary-agent"
                      checked={primaryId === opt.id}
                      onChange={() => setPrimaryId(opt.id)}
                    />
                    Primary
                  </label>
                ) : null}
              </label>
            ))
          )}
        </div>
      ) : agents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--theme-border-subtle)] px-3 py-6 text-center text-sm text-slate-500 dark:text-[var(--theme-text-muted)]">
          No collection agents assigned.
        </p>
      ) : (
        <ul className={`${asicCard} divide-y divide-[var(--theme-border-subtle)]`}>
          {agents.map(a => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 font-medium text-slate-900 dark:text-[var(--theme-text)]">
                <ICFundAccountLink
                  slug={branchSlug || HQ_IC_FUNDS_BRANCH_SLUG}
                  accountId={a.collectionAccountId}
                  name={a.collectionAccountName}
                />
                {a.isPrimary ? (
                  <span className={`ml-2 ${badgeClass('info')}`}>Primary</span>
                ) : null}
              </span>
              <span className="shrink-0 font-mono text-xs text-slate-400 dark:text-[var(--theme-text-muted)]">
                {a.currency}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
