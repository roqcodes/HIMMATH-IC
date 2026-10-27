'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DateFilterBar from '@/components/ui/DateFilterBar';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Modal from '@/components/ui/Modal';
import { ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { PRODUCT_NAME } from '@/lib/brand';
import {
  asicBtnDanger,
  asicBtnGhost,
  asicBtnOutline,
  asicBtnPrimary,
  asicCard,
  asicInput,
  asicLabel,
  asicTable,
  asicTd,
  asicTh,
  asicTheadRow,
  asicTr,
} from '@/components/asic/ui';
import { useApp } from '@/context/AppContext';
import {
  createAppBackupAction,
  deleteAppBackupAction,
  getAppBackupPayloadAction,
  listAppBackupsAction,
  restoreAppBackupAction,
} from '@/app/actions/backupActions';
import { useDateFilterState } from '@/hooks/useDateFilterState';
import {
  BACKUP_GROUPS,
  downloadBackupJson,
  formatBackupBytes,
  tablesForGroups,
  totalBackupRows,
  validateAsicBackup,
  type AsicBackupFile,
  type BackupDestination,
  type BackupGroupId,
  type BackupHistoryRow,
  type BackupMode,
} from '@/lib/asic/backup';

const ALL_GROUP_IDS = BACKUP_GROUPS.map(g => g.id);
const HISTORY_KEY = ['admin', 'backups'] as const;

function defaultGroups(): BackupGroupId[] {
  return [...ALL_GROUP_IDS];
}

export default function BackupScreen() {
  const { showToast } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useDateFilterState({ defaultFilter: 'all-time' });
  const [mode, setMode] = useState<BackupMode>('full');
  const [groups, setGroups] = useState<BackupGroupId[]>(defaultGroups);
  const [replaceDated, setReplaceDated] = useState(false);
  const [localFile, setLocalFile] = useState<AsicBackupFile | null>(null);
  const [localFileName, setLocalFileName] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<
    { source: 'file' | 'history'; historyId?: string; label: string } | null
  >(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const selectedTables = useMemo(
    () => (mode === 'full' ? tablesForGroups(ALL_GROUP_IDS) : tablesForGroups(groups)),
    [mode, groups],
  );

  const historyQuery = useQuery({
    queryKey: HISTORY_KEY,
    queryFn: async () => {
      const res = await listAppBackupsAction();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
  });

  const createMut = useMutation({
    mutationFn: (destination: BackupDestination) =>
      createAppBackupAction({
        destination,
        mode,
        tableIds: selectedTables.map(t => t.id),
        dateFilter,
        customStartDate,
        customEndDate,
      }),
    onSuccess: (res, destination) => {
      if (!res.success) {
        showToast(res.error, 'error');
        return;
      }
      if (destination === 'local' && res.data.payload) {
        downloadBackupJson(res.data.payload, res.data.history.filename);
        showToast('JSON backup downloaded.', 'success');
      } else {
        showToast('Backup saved to history.', 'success');
      }
      qc.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const restoreMut = useMutation({
    mutationFn: async () => {
      if (!restoreTarget) throw new Error('Nothing to restore.');
      return restoreAppBackupAction({
        replaceDated,
        source: restoreTarget.source,
        historyId: restoreTarget.historyId,
        payload: restoreTarget.source === 'file' ? localFile : undefined,
      });
    },
    onSuccess: res => {
      if (!res.success) {
        showToast(res.error, 'error');
        return;
      }
      const rows = totalBackupRows(res.data.restored);
      showToast(`Restored ${rows} rows.`, 'success');
      setRestoreTarget(null);
      setConfirmText('');
      qc.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAppBackupAction(id),
    onSuccess: res => {
      if (!res.success) {
        showToast(res.error, 'error');
        return;
      }
      showToast('History entry removed.', 'success');
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: HISTORY_KEY });
    },
    onError: (error: Error) => showToast(error.message, 'error'),
  });

  async function downloadHistory(row: BackupHistoryRow) {
    const res = await getAppBackupPayloadAction(row.id);
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    downloadBackupJson(res.data.payload, res.data.filename);
  }

  function toggleGroup(id: BackupGroupId) {
    setGroups(prev => (prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]));
  }

  function onPickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!validateAsicBackup(parsed)) {
          showToast(`That file is not a valid ${PRODUCT_NAME} backup.`, 'error');
          setLocalFile(null);
          setLocalFileName('');
          return;
        }
        setLocalFile(parsed);
        setLocalFileName(file.name);
      } catch {
        showToast('Could not read that JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  const creating = createMut.isPending;
  const restoring = restoreMut.isPending;
  const confirmReady = confirmText.trim().toUpperCase() === 'RESTORE';

  return (
    <div className="space-y-3">
      <AsicPageHeader
        title="Backup"
        subtitle="Manual JSON backups of live data. Local downloads a file; database stores a copy in history. Date range filters sales, purchases, vouchers, warehouse movements, and audit rows. Master data is always included in full when selected."
      />

      <DateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className={`${asicCard} p-4`} aria-labelledby="backup-create-heading">
          <h2 id="backup-create-heading" className="text-sm font-semibold text-slate-900">
            Create backup
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">Stored as JSON. Full or a custom set of groups.</p>

          <fieldset className="mt-3">
            <legend className={asicLabel}>Scope</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(['full', 'custom'] as const).map(id => (
                <button
                  key={id}
                  type="button"
                  className={mode === id ? asicBtnPrimary : asicBtnOutline}
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                >
                  {id === 'full' ? 'Full backup' : 'Custom'}
                </button>
              ))}
            </div>
          </fieldset>

          {mode === 'custom' ? (
            <fieldset className="mt-3">
              <legend className={asicLabel}>Include</legend>
              <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {BACKUP_GROUPS.map(group => {
                  const checked = groups.includes(group.id);
                  return (
                    <label
                      key={group.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${
                        checked ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleGroup(group.id)}
                      />
                      <span>
                        <span className="block font-medium text-slate-800">{group.label}</span>
                        <span className="block text-[11px] text-slate-500">{group.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <p className="mt-3 text-[12px] text-slate-500">
            {selectedTables.length} tables · {selectedTables.filter(t => t.dated).length} date-filtered
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={asicBtnPrimary}
              disabled={creating || selectedTables.length === 0}
              onClick={() => createMut.mutate('local')}
            >
              {creating && createMut.variables === 'local' ? 'Preparing…' : 'Download JSON'}
            </button>
            <button
              type="button"
              className={asicBtnOutline}
              disabled={creating || selectedTables.length === 0}
              onClick={() => createMut.mutate('db')}
            >
              {creating && createMut.variables === 'db' ? 'Saving…' : 'Save to database'}
            </button>
          </div>
        </section>

        <section className={`${asicCard} p-4`} aria-labelledby="backup-restore-heading">
          <h2 id="backup-restore-heading" className="text-sm font-semibold text-slate-900">
            Restore
          </h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Restore from a local JSON file or from a database history row. Merge upserts by primary
            key. Replace deletes matching dated rows in the backup’s range first.
          </p>

          <div className="mt-3">
            <label className={asicLabel} htmlFor="backup-file">
              Local file
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                id="backup-file"
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={e => onPickFile(e.target.files?.[0])}
              />
              <button type="button" className={asicBtnOutline} onClick={() => fileRef.current?.click()}>
                Choose JSON
              </button>
              <span className="text-xs text-slate-500">
                {localFile
                  ? `${localFileName} · ${totalBackupRows(localFile.counts)} rows`
                  : 'No file selected'}
              </span>
            </div>
          </div>

          <fieldset className="mt-3">
            <legend className={asicLabel}>Restore mode</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                className={!replaceDated ? asicBtnPrimary : asicBtnOutline}
                aria-pressed={!replaceDated}
                onClick={() => setReplaceDated(false)}
              >
                Merge
              </button>
              <button
                type="button"
                className={replaceDated ? asicBtnDanger : asicBtnOutline}
                aria-pressed={replaceDated}
                disabled={!canWrite}
                onClick={() => setReplaceDated(true)}
              >
                Replace dated rows
              </button>
            </div>
          </fieldset>

          <button
            type="button"
            className={`${asicBtnPrimary} mt-4`}
            disabled={!canWrite || !localFile || restoring}
            onClick={() =>
              setRestoreTarget({
                source: 'file',
                label: localFileName || 'local file',
              })
            }
          >
            Restore from file
          </button>
          {!canWrite ? (
            <p className="mt-2 text-[12px] text-slate-500">Only admins can restore. You can still create and download backups.</p>
          ) : null}
        </section>
      </div>

      <section className={asicCard} aria-labelledby="backup-history-heading">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 id="backup-history-heading" className="text-sm font-semibold text-slate-900">
              Backup history
            </h2>
            <p className="text-[12px] text-slate-500">Every backup is kept here as JSON. Download or restore any row, or restore from a file you have locally.</p>
          </div>
        </div>
        {historyQuery.isLoading ? (
          <ASICTableSkeleton cols={7} />
        ) : historyQuery.error ? (
          <p className="p-4 text-sm text-red-600">{(historyQuery.error as Error).message}</p>
        ) : (historyQuery.data ?? []).length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No backups yet. Download a JSON file or save one to the database.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className={`${asicTable} min-w-[880px]`}>
                <thead>
                  <tr className={asicTheadRow}>
                    {['When', 'Source', 'Scope', 'Range', 'Rows', 'Size', 'Actions'].map(h => (
                      <th key={h} className={asicTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(historyQuery.data ?? []).map(row => (
                    <HistoryRow
                      key={row.id}
                      row={row}
                      canWrite={canWrite}
                      onDownload={() => downloadHistory(row)}
                      onRestore={() =>
                        setRestoreTarget({
                          source: 'history',
                          historyId: row.id,
                          label: row.filename,
                        })
                      }
                      onDelete={() => setDeleteId(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 p-3 md:hidden">
              {(historyQuery.data ?? []).map(row => (
                <article key={row.id} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="font-medium">{row.filename}</div>
                  <div className="text-[11px] text-slate-500">
                    {row.createdAt.replace('T', ' ').slice(0, 19)} · {row.destination === 'db' ? 'Database' : 'Local'} · {row.mode}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.hasPayload ? (
                      <button type="button" className={asicBtnOutline} onClick={() => downloadHistory(row)}>
                        Download
                      </button>
                    ) : null}
                    {canWrite && row.hasPayload ? (
                      <button
                        type="button"
                        className={asicBtnOutline}
                        onClick={() => setRestoreTarget({ source: 'history', historyId: row.id, label: row.filename })}
                      >
                        Restore
                      </button>
                    ) : null}
                    {canWrite ? (
                      <button type="button" className={asicBtnGhost} onClick={() => setDeleteId(row.id)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <Modal
        open={!!restoreTarget}
        onClose={() => {
          if (!restoring) {
            setRestoreTarget(null);
            setConfirmText('');
          }
        }}
        title="Restore backup?"
        maxWidth="max-w-md"
        footer={
          <div className="flex w-full justify-end gap-2">
            <button
              type="button"
              className={asicBtnOutline}
              disabled={restoring}
              onClick={() => {
                setRestoreTarget(null);
                setConfirmText('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={replaceDated ? asicBtnDanger : asicBtnPrimary}
              disabled={!confirmReady || restoring}
              onClick={() => restoreMut.mutate()}
            >
              {restoring ? 'Restoring…' : 'Restore now'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          This writes to the live database from <span className="font-medium text-slate-900">{restoreTarget?.label}</span>.
          {replaceDated
            ? ' Replace will delete dated rows in the backup range before inserting.'
            : ' Merge updates matching rows and inserts missing ones. Master data is never wiped.'}
        </p>
        <label className={`${asicLabel} mt-3`} htmlFor="restore-confirm">
          Type RESTORE to confirm
        </label>
        <input
          id="restore-confirm"
          className={asicInput}
          value={confirmText}
          onChange={e => setConfirmText(e.target.value)}
          autoComplete="off"
          disabled={restoring}
        />
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        title="Delete history entry?"
        message="This removes the stored JSON copy. Live data is not changed."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMut.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteMut.mutate(deleteId);
        }}
      />
    </div>
  );
}

function HistoryRow({
  row,
  canWrite,
  onDownload,
  onRestore,
  onDelete,
}: {
  row: BackupHistoryRow;
  canWrite: boolean;
  onDownload: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const range =
    row.startDate || row.endDate ? `${row.startDate || '…'} → ${row.endDate || '…'}` : 'All time';
  return (
    <tr className={asicTr}>
      <td className={`${asicTd} whitespace-nowrap tabular-nums text-xs`}>
        {row.createdAt.replace('T', ' ').slice(0, 19)}
      </td>
      <td className={asicTd}>{row.destination === 'db' ? 'Database' : 'Local file'}</td>
      <td className={asicTd}>{row.mode === 'full' ? 'Full' : 'Custom'}</td>
      <td className={`${asicTd} text-xs`}>{range}</td>
      <td className={`${asicTd} tabular-nums`}>{totalBackupRows(row.rowCounts)}</td>
      <td className={`${asicTd} tabular-nums`}>{formatBackupBytes(row.fileSizeBytes)}</td>
      <td className={asicTd}>
        <div className="flex flex-wrap gap-1.5">
          {row.hasPayload ? (
            <button type="button" className={asicBtnOutline} onClick={onDownload}>
              Download
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">File only</span>
          )}
          {canWrite && row.hasPayload ? (
            <button type="button" className={asicBtnOutline} onClick={onRestore}>
              Restore
            </button>
          ) : null}
          {canWrite ? (
            <button type="button" className={asicBtnGhost} onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
