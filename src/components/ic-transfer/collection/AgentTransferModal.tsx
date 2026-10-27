'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicBtnOutline, asicBtnPrimary, asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import {
  listCollectionAgentsForTransferAction,
  recordAgentTransferAction,
} from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { trackLoading } from '@/lib/loadingBar';

type AgentOption = {
  id: string;
  name: string;
  currency: string;
  balance: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  branchSlug?: string;
  onSuccess: () => void;
};

export default function AgentTransferModal({ open, onClose, branchSlug, onSuccess }: Props) {
  const { showToast } = useApp();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void listCollectionAgentsForTransferAction(branchSlug).then(res => {
      if (!res.success) {
        showToast(res.error || 'Failed to load agents', 'error');
        setAgents([]);
      } else {
        setAgents(res.agents);
      }
      setLoading(false);
    });
  }, [open, branchSlug, showToast]);

  useEffect(() => {
    if (!open) return;
    const withBalance = agents.filter(a => a.balance > 1e-10);
    setFromId(withBalance[0]?.id || '');
    setToId('');
    setAmount('');
    setNotes('');
  }, [open, agents]);

  const fromAgent = agents.find(a => a.id === fromId);
  const currency = fromAgent?.currency || '';

  const destinationOptions = useMemo(
    () => agents.filter(a => a.id !== fromId && a.currency === currency),
    [agents, fromId, currency],
  );

  useEffect(() => {
    if (!toId || destinationOptions.some(a => a.id === toId)) return;
    setToId(destinationOptions[0]?.id || '');
  }, [destinationOptions, toId]);

  const amountNum = parseFloat(amount);
  const maxAmount = fromAgent?.balance || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || !Number.isFinite(amountNum) || amountNum <= 0) return;
    if (amountNum > maxAmount + 1e-10) {
      showToast('Amount exceeds source agent balance', 'error');
      return;
    }
    const toAgent = agents.find(a => a.id === toId);
    if (!fromAgent || !toAgent || fromAgent.currency !== toAgent.currency) {
      showToast('Agent-to-agent transfer requires the same currency', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        recordAgentTransferAction(
          {
            fromAccountId: fromId,
            toAccountId: toId,
            amount: amountNum,
            notes: notes.trim() || null,
          },
          branchSlug,
        ),
      );
      if (!res.success) {
        showToast(res.error || 'Transfer failed', 'error');
        return;
      }
      showToast('Balance transferred between agents');
      onSuccess();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer agent balance"
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="agent-transfer-form"
            className={asicBtnPrimary}
            disabled={saving || loading || !fromId || !toId}
          >
            {saving ? 'Transferring…' : 'Transfer'}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-slate-500">Loading agents…</p>
      ) : agents.filter(a => a.balance > 1e-10).length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
          No agents with unsettled balance to transfer.
        </div>
      ) : (
        <form id="agent-transfer-form" onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Only agents that share the same currency can transfer. Unsettled balance and customer
            credit move FIFO; FX sale rates stay with each allocation.
          </p>

          <div className={asicFormGrid}>
            <AsicFormField label="From agent *" htmlFor="fx-transfer-from" colSpan={12}>
              <select
                id="fx-transfer-from"
                className={asicInput}
                value={fromId}
                onChange={e => setFromId(e.target.value)}
                required
              >
                {agents
                  .filter(a => a.balance > 1e-10)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatFxAmount(a.balance)} {a.currency}
                    </option>
                  ))}
              </select>
            </AsicFormField>

            <AsicFormField label="To agent *" htmlFor="fx-transfer-to" colSpan={12}>
              <select
                id="fx-transfer-to"
                className={asicInput}
                value={toId}
                onChange={e => setToId(e.target.value)}
                required
                disabled={destinationOptions.length === 0}
              >
                {destinationOptions.length === 0 ? (
                  <option value="">No matching currency agents</option>
                ) : (
                  destinationOptions.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))
                )}
              </select>
            </AsicFormField>

            <AsicFormField
              label={`Amount (${currency || '—'}) *`}
              htmlFor="fx-transfer-amount"
              colSpan={6}
              hint={
                fromAgent
                  ? `Available ${formatFxAmount(maxAmount)} ${fromAgent.currency}`
                  : undefined
              }
            >
              <input
                id="fx-transfer-amount"
                className={`${asicInput} text-right`}
                type="number"
                step="any"
                min="0"
                max={maxAmount || undefined}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </AsicFormField>

            <AsicFormField label="Notes" htmlFor="fx-transfer-notes" colSpan={12}>
              <textarea
                id="fx-transfer-notes"
                className={asicTextarea}
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </AsicFormField>
          </div>
        </form>
      )}
    </Modal>
  );
}
