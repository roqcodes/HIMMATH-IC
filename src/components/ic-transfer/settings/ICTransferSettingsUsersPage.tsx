'use client';

import React, { useState } from 'react';
import { badgeClass } from '@/lib/badgeClass';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { asicTable, asicTd, asicTr } from '@/components/asic/ui';
import {
  AddButton,
  icRowLabelClass,
  icThClass,
  icTheadRow,
  PageHeader,
  PageShell,
  SearchInput,
  SectionCard,
} from '../ui';
import AddUserModal from './AddUserModal';
import { portalMobileToolbarClass } from '@/lib/icTransfer/layoutConstants';

type Props = {
  title: string;
  subtitle?: string;
  addButtonLabel?: string;
  modalTitle?: string;
  showCommission?: boolean;
  showRate?: boolean;
  nameColumn?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  data?: any[];
  onEditItem?: (item: any) => void;
  onDeleteItem?: (id: string) => void;
  onRowClick?: (item: any) => void;
};

export default function ICTransferSettingsUsersPage({
  title,
  subtitle,
  addButtonLabel = 'Add Setting',
  modalTitle = 'Add Setting',
  showCommission = false,
  showRate = true,
  nameColumn = 'Name',
  actions,
  children,
  data = [],
  onEditItem,
  onDeleteItem,
  onRowClick,
}: Props) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const columns = ['#', 'ID', nameColumn, 'Phone Number', ...(showRate || showCommission ? [showRate ? 'Rate' : 'Commission'] : []), 'Status', 'Action'];

  const filtered = data.filter((item) => 
    item.name?.toLowerCase().includes(search.toLowerCase()) || 
    item.id?.toLowerCase().includes(search.toLowerCase())
  );

  const kpi = {
    total: data.length,
    withPhone: data.filter(item => item.phone).length,
    withRate: data.filter(item => item.rate || item.commission).length,
  };

  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions || <AddButton label={addButtonLabel} onClick={() => setModalOpen(true)} />}
      />

      <AsicKpiStrip
        metrics={[
          { label: title, value: kpi.total.toLocaleString(), hint: 'Records' },
          { label: 'With phone', value: kpi.withPhone.toLocaleString(), hint: 'Contact on file' },
          {
            label: showCommission ? 'With commission' : showRate ? 'With rate' : 'Listed',
            value: (showCommission || showRate ? kpi.withRate : kpi.total).toLocaleString(),
            hint: showCommission ? 'Commission set' : showRate ? 'Rate set' : 'In directory',
            tone: 'indigo',
          },
        ]}
        columns={3}
      />

      <SectionCard>
        <div className={`${portalMobileToolbarClass} md:border-b md:border-slate-100 md:px-6 md:py-4 md:pb-3`}>
          <h3 className="shrink-0 text-base font-bold text-slate-900 sm:text-lg">All Settings</h3>
          <SearchInput value={search} onChange={setSearch} placeholder="Search settings..." className="min-w-0 max-sm:w-full flex-1" />
        </div>
        <div className="p-0 pb-3 md:pb-5">
          <div className="overflow-x-auto">
            <table className={`${asicTable} min-w-[640px]`}>
              <thead>
                <tr className={icTheadRow}>
                  {columns.map(col => (
                    <th key={col} className={icThClass('left')}>
                      {col === 'Action' ? <span className="sr-only">Actions</span> : col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user, i) => (
                  <tr 
                    key={user.id} 
                    data-interactive-row 
                    onClick={onRowClick ? () => onRowClick(user) : undefined}
                    className={`${asicTr} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className={icRowLabelClass}>{i + 1}</td>
                    <td className={asicTd}>
                      <div className="max-w-[100px] truncate font-mono text-xs text-slate-500" title={user.id}>
                        {user.id.substring(0, 8).toUpperCase()}
                      </div>
                      <div className="text-[11px] text-slate-400">Registered: {new Date(user.createdAt || Date.now()).toLocaleDateString()}</div>
                    </td>
                    <td className={`${asicTd} font-medium text-slate-900`}>{user.name}</td>
                    <td className={`${asicTd} text-slate-600`}>{user.phone || '—'}</td>
                    {(showRate || showCommission) && (
                      <td className={`${asicTd} font-mono`}>{user.rate || user.commission || '—'}</td>
                    )}
                    <td className={asicTd}>
                      <span className={badgeClass('active')}>Active</span>
                    </td>
                    <td className={`${asicTd} text-right`} onClick={e => e.stopPropagation()}>
                      <div className="flex flex-wrap justify-end gap-1">
                        {onEditItem && (
                          <button type="button" onClick={() => onEditItem(user)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                            Edit
                          </button>
                        )}
                        {onDeleteItem && (
                          <button type="button" onClick={() => { if(confirm('Are you sure you want to delete this?')) onDeleteItem(user.id); }} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-slate-400">No settings found.</div>
            )}
          </div>
        </div>
      </SectionCard>

      {!actions && (
        <AddUserModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={modalTitle}
          showCommission={showCommission}
          showRate={showRate}
        />
      )}
      {children}
    </PageShell>
  );
}
