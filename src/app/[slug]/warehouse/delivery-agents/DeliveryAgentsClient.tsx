'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import WarehousePortalShell from '@/components/warehouse/WarehousePortalShell';
import {
  portalMobileCardListClass,
} from '@/lib/icTransfer/layoutConstants';
import { asicBtnPrimary } from '@/components/asic/ui';
import SalesTableShell, {
  salesTableClass,
  salesTableEmptyClass,
  salesTableRowClass,
  salesTableTdClass,
  salesTableThSortableClass,
  salesTableTheadRowClass,
} from '@/components/ic-transfer/shared/SalesTableShell';
import { fetchDeliveryAgents, deleteDeliveryAgent } from '@/app/actions/warehouseActions';
import CreateDeliveryAgentModal from './CreateDeliveryAgentModal';
import EditDeliveryAgentModal from './EditDeliveryAgentModal';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { ConfirmModal, SkeletonRows } from '@/components/warehouse/shared';
import type { DeliveryAgent } from '@/types/warehouse';

type SortField = 'Name' | 'Account ID' | 'Email';

export default function DeliveryAgentsClient({ branchSlug }: { branchSlug: string }) {
  const { user, showToast, icWarehouses } = useApp();

  const [agents, setAgents]       = useState<DeliveryAgent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgent, setEditingAgent]     = useState<DeliveryAgent | null>(null);
  const [deletingAgent, setDeletingAgent]   = useState<DeliveryAgent | null>(null);
  const [deleteLoading, setDeleteLoading]   = useState(false);

  const [search,    setSearch]    = useState('');
  const [sortField, setSortField] = useState<SortField>('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const rawRoleId   = (user?.role?.startsWith('warehouse_') || user?.role?.startsWith('delivery_')) ? user.role.split('_')[1] : null;
  const warehouseId = rawRoleId ? icWarehouses.find((w: any) => w.id.startsWith(rawRoleId))?.id : null;

  const canManageAgents =
    user?.role?.startsWith('warehouse_') ||
    user?.role === 'branch_manager' ||
    user?.role === 'admin';

  const loadAgents = useCallback(async () => {
    if (!warehouseId) { setLoading(false); return; }
    setLoading(true);
    const result = await fetchDeliveryAgents(warehouseId);
    if (result.success && result.data) {
      setAgents(result.data as DeliveryAgent[]);
    } else {
      showToast(result.error || 'Failed to fetch delivery agents', 'error');
    }
    setLoading(false);
  }, [warehouseId, showToast]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleDelete = async () => {
    if (!deletingAgent) return;
    setDeleteLoading(true);
    const res = await deleteDeliveryAgent(deletingAgent.id, deletingAgent.email);
    if (res.success) {
      showToast('Delivery agent deleted successfully', 'success');
      setDeletingAgent(null);
      loadAgents();
    } else {
      showToast(res.error || 'Failed to delete', 'error');
    }
    setDeleteLoading(false);
  };

  const handleSort = (field: SortField) => {
    setSortField(f => {
      if (f === field) { setSortOrder(o => (o === 'asc' ? 'desc' : 'asc')); return f; }
      setSortOrder('asc');
      return field;
    });
  };

  const filteredAgents = useMemo<DeliveryAgent[]>(() => {
    const q = search.toLowerCase();
    return agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.account_id.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      (a.phone || '').toLowerCase().includes(q),
    );
  }, [agents, search]);

  const sortedAgents = useMemo<DeliveryAgent[]>(() => {
    return [...filteredAgents].sort((a, b) => {
      let vA: string;
      let vB: string;
      switch (sortField) {
        case 'Account ID': vA = a.account_id; vB = b.account_id; break;
        case 'Email':      vA = a.email;      vB = b.email;      break;
        default:           vA = a.name;       vB = b.name;
      }
      const cmp = vA.localeCompare(vB);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [filteredAgents, sortField, sortOrder]);

  const SortTh = ({ field, align = 'left' }: { field: SortField; align?: 'left' | 'right' | 'center' }) => {
    const active = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`${salesTableThSortableClass} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
          <span>{field}</span>
          {active ? <span className="text-[10px] text-slate-400">{sortOrder === 'asc' ? '▲' : '▼'}</span> : null}
        </div>
      </th>
    );
  };

  const kpi = useMemo(() => ({
    total: agents.length,
    withPhone: agents.filter(a => a.phone).length,
    withEmail: agents.filter(a => a.email).length,
  }), [agents]);

  return (
    <WarehousePortalShell title="Delivery Agents">
      <AsicKpiStrip
        metrics={[
          { label: 'Agents', value: kpi.total.toLocaleString(), hint: 'This warehouse' },
          { label: 'With phone', value: kpi.withPhone.toLocaleString(), hint: 'Contact on file' },
          { label: 'With email', value: kpi.withEmail.toLocaleString(), hint: 'Login email', tone: 'indigo' },
        ]}
        columns={3}
      />

      <SalesTableShell
        title={`Delivery Agents (${sortedAgents.length})`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by ID, name, email or phone"
        toolbarEnd={
          canManageAgents ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className={asicBtnPrimary}
              disabled={!warehouseId}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add Agent
            </button>
          ) : null
        }
      >
        <table className={`${salesTableClass} hidden md:table`}>
          <thead>
            <tr className={salesTableTheadRowClass}>
              <th className={`${salesTableThSortableClass} text-left`}>#</th>
              <SortTh field="Account ID" />
              <SortTh field="Name" />
              <th className={`${salesTableThSortableClass} text-left`}>Phone</th>
              <SortTh field="Email" />
              {canManageAgents ? (
                <th className={`${salesTableThSortableClass} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={canManageAgents ? 6 : 5} />
            ) : sortedAgents.length === 0 ? (
              <tr>
                <td colSpan={canManageAgents ? 6 : 5} className={salesTableEmptyClass}>
                  No delivery agents found.
                </td>
              </tr>
            ) : (
              sortedAgents.map((agent, i) => (
                <tr key={agent.id} className={salesTableRowClass} data-interactive-row>
                  <td className={`${salesTableTdClass} text-slate-400`}>{i + 1}</td>
                  <td className={`${salesTableTdClass} font-mono text-slate-600`}>{agent.account_id}</td>
                  <td className={`${salesTableTdClass} font-medium text-slate-900`}>{agent.name}</td>
                  <td className={`${salesTableTdClass} text-slate-600`}>{agent.phone || '—'}</td>
                  <td className={`${salesTableTdClass} text-slate-600`}>{agent.email}</td>
                  {canManageAgents ? (
                    <td className={`${salesTableTdClass} text-right`}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditingAgent(agent)} className="text-slate-400 hover:text-accent transition-colors p-1 rounded-lg hover:bg-accent/5" title="Edit Agent">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        <button onClick={() => setDeletingAgent(agent)} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50" title="Delete Agent">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className={`${portalMobileCardListClass} md:hidden`}>
          {loading ? (
            <div className="flex flex-col gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-lg bg-slate-100 animate-pulse" />)}</div>
          ) : sortedAgents.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No delivery agents found.</div>
          ) : (
            sortedAgents.map(agent => (
              <div key={agent.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-4 shadow-surface-xs">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-slate-900">{agent.name}</span>
                    <span className="text-xs text-slate-500">{agent.email}</span>
                    {agent.phone && <span className="text-xs text-slate-400">{agent.phone}</span>}
                  </div>
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">{agent.account_id}</span>
                </div>
                {canManageAgents && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                    <button onClick={() => setEditingAgent(agent)} className="text-xs font-bold text-slate-500 hover:text-accent transition-colors">Edit</button>
                    <button onClick={() => setDeletingAgent(agent)} className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors">Delete</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </SalesTableShell>

      {isAddModalOpen && warehouseId && (
        <CreateDeliveryAgentModal
          warehouseId={warehouseId}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => { setIsAddModalOpen(false); loadAgents(); }}
        />
      )}

      {editingAgent && warehouseId && (
        <EditDeliveryAgentModal
          agent={editingAgent}
          warehouseId={warehouseId}
          onClose={() => setEditingAgent(null)}
          onSuccess={() => { setEditingAgent(null); loadAgents(); }}
        />
      )}

      <ConfirmModal
        open={!!deletingAgent}
        title="Delete Delivery Agent"
        message={`Are you sure you want to delete "${deletingAgent?.name}"? This will remove their login and all associated data.`}
        confirmLabel="Delete Agent"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeletingAgent(null)}
      />
    </WarehousePortalShell>
  );
}
