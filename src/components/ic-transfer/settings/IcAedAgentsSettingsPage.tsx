'use client';

import React, { useEffect, useState } from 'react';
import PageShell from '@/components/ic-transfer/ui/PageShell';
import PageHeader from '@/components/ic-transfer/ui/PageHeader';
import { btnPrimary, btnSecondary, formInput } from '@/lib/ui';
import {
  createIcAedAgentAction,
  listIcAedAgentsAction,
  updateIcAedAgentAction,
  type IcAedAgent,
} from '@/app/actions/aedAgentActions';

export default function IcAedAgentsSettingsPage() {
  const [agents, setAgents] = useState<IcAedAgent[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    void listIcAedAgentsAction().then(rows => {
      setAgents(rows);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await createIcAedAgentAction({ name: name.trim(), phone: phone || null, status: 'active' });
    if (res.success) {
      setName('');
      setPhone('');
      reload();
    }
  };

  return (
    <PageShell>
      <PageHeader title="UAE collection agents" />
      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Name *
          <input className={formInput} value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Phone
          <input className={formInput} value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <button type="submit" className={btnPrimary}>
          Add agent
        </button>
      </form>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {agents.map(a => (
            <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{a.name}</p>
                <p className="text-xs text-slate-500">{a.phone || '—'}</p>
              </div>
              <button
                type="button"
                className={btnSecondary}
                onClick={() =>
                  void updateIcAedAgentAction(a.id, {
                    name: a.name,
                    phone: a.phone,
                    status: a.status === 'active' ? 'inactive' : 'active',
                  }).then(reload)
                }
              >
                {a.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
