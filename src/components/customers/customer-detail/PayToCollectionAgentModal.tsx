'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { btnPrimary, btnSecondary, formInput } from '@/lib/ui';
import { useApp } from '@/context/AppContext';
import { recordPayToCollectionAgentAction } from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';
import { trackLoading } from '@/lib/loadingBar';

type AgentOption = {
  collectionAccountId: string;
  name: string;
  currency: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  currency: string;
  foreignRemaining: number;
  agents: AgentOption[];
  branchSlug?: string;
  onSuccess: () => void;
};

export default function PayToCollectionAgentModal({
  open,
  onClose,
  customerId,
  customerName,
  currency,
  foreignRemaining,
  agents,
  branchSlug,
  onSuccess,
}: Props) {
  const { showToast } = useApp();
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAgentId(agents[0]?.collectionAccountId || '');
    setAmount('');
    setNotes('');
  }, [open, agents]);

  const amountNum = parseFloat(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId || !Number.isFinite(amountNum) || amountNum <= 0) return;
    setSaving(true);
    try {
      const res = await trackLoading(() =>
        recordPayToCollectionAgentAction(
          {
            customerId,
            collectionAccountId: agentId,
            amount: amountNum,
            notes: notes.trim() || null,
          },
          branchSlug,
        ),
      );
      if (!res.success) {
        showToast(res.error || 'Payment failed', 'error');
        return;
      }
      showToast(res.message || 'Payment recorded');
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
      title={`Pay to collection agent — ${customerName}`}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="pay-agent-form" className={btnPrimary} disabled={saving || !agentId}>
            {saving ? 'Submitting…' : 'Submit payment'}
          </button>
        </>
      }
    >
      <form id="pay-agent-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Remaining on open sales:{' '}
          <span className="font-mono font-semibold text-amber-800">
            {formatFxAmount(foreignRemaining)} {currency}
          </span>
        </p>
        <p className="text-[11px] text-slate-500">
          Paying more than remaining is kept as credit and applied automatically to future sales.
        </p>

        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Collection agent
          <select
            className={`${formInput} mt-1`}
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            required
          >
            {agents.map(a => (
              <option key={a.collectionAccountId} value={a.collectionAccountId}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Amount ({currency})
          <input
            className={`${formInput} mt-1 text-right`}
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </label>

        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Notes
          <textarea className={`${formInput} mt-1 resize-none`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
