'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import type { PageAccessLevel, PagePermissionMap } from '@/types';
import {
  fetchStaffPermissionsAction,
  updateStaffPermissionsAction,
} from '@/app/actions/permissionActions';
import {
  defaultAdminStaffPermissionMap,
  legacyPermissionsToSectionMap,
  sectionLabel,
  sectionMapToStoredPermissions,
  staffPermissionGroups,
  staffPermissionSections,
  type StaffPermissionPortal,
} from '@/lib/staffSectionPermissions';
import { asicBtnGhost, asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import SectionAccessToggle from './SectionAccessToggle';
import WriteGate from '@/components/rbac/WriteGate';
import { useWriteAccess } from '@/context/RbacWriteContext';

type Props = {
  open: boolean;
  onClose: () => void;
  branchSlug?: string;
  branchId?: string;
  portal?: StaffPermissionPortal;
  user: { email: string; name: string; userId?: string };
  onSaved?: () => void;
};

export default function UserPermissionsPanel({
  open,
  onClose,
  branchSlug,
  branchId,
  portal = 'branch',
  user,
  onSaved,
}: Props) {
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [sectionAccess, setSectionAccess] = useState<Record<string, PageAccessLevel>>({});
  const [storedBase, setStoredBase] = useState<PagePermissionMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => staffPermissionGroups(portal), [portal]);
  const allSectionIds = useMemo(() => staffPermissionSections(portal), [portal]);

  useEffect(() => {
    if (!open || !user.userId || (!branchSlug && !branchId)) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    const sectionList = staffPermissionSections(portal);

    fetchStaffPermissionsAction(user.userId, branchSlug, branchId).then(res => {
      if (cancelled) return;
      if (res.success) {
        setStoredBase(res.data);
        setSectionAccess(
          legacyPermissionsToSectionMap(res.data, sectionList) as Record<string, PageAccessLevel>,
        );
      } else {
        setError(res.error);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, branchSlug, branchId, user.userId, portal]);

  const handleSave = async () => {
    if (!canWrite || !user.userId || (!branchSlug && !branchId)) return;
    setSaving(true);
    setError(null);
    const permissions = sectionMapToStoredPermissions(sectionAccess, portal, storedBase);
    const res = await updateStaffPermissionsAction(user.userId, permissions, branchSlug, branchId);
    setSaving(false);
    if (res.success) {
      onSaved?.();
      onClose();
    } else {
      setError(res.error);
    }
  };

  const setPageAccess = (sectionId: string, level: PageAccessLevel) => {
    setSectionAccess(prev => ({ ...prev, [sectionId]: level }));
  };

  const applyBulk = (level: PageAccessLevel) => {
    setSectionAccess(prev => {
      const next = { ...prev };
      for (const id of allSectionIds) {
        next[id] = level;
      }
      next.dashboard = 'read';
      return next;
    });
  };

  const applyDefaults = () => {
    if (portal === 'admin') {
      setSectionAccess(defaultAdminStaffPermissionMap());
      return;
    }
    setSectionAccess(prev => {
      const next = { ...prev };
      for (const id of allSectionIds) {
        next[id] = 'read';
      }
      next.dashboard = 'read';
      return next;
    });
  };

  const summary = useMemo(() => {
    let read = 0;
    let write = 0;
    let none = 0;
    for (const id of allSectionIds) {
      const level = sectionAccess[id] ?? 'read';
      if (level === 'write') write++;
      else if (level === 'read') read++;
      else none++;
    }
    return { read, write, none, total: allSectionIds.length };
  }, [allSectionIds, sectionAccess]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Staff access control"
      maxWidth="max-w-6xl w-[min(96vw,72rem)]"
      maxHeight="sm:max-h-[min(90dvh,820px)]"
      footer={
        <>
          <button type="button" className={asicBtnOutline} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className={asicBtnPrimary}
            onClick={handleSave}
            {...wp({ disabled: saving || loading || !user.userId })}
          >
            {saving ? 'Saving…' : 'Save permissions'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Selected user</p>
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
              {portal === 'admin' ? 'HQ admin panel' : 'Branch portal'}
            </span>
            <span className="text-[11px] text-slate-500">
              {summary.write} write · {summary.read} read · {summary.none} none
            </span>
          </div>
        </div>

        <WriteGate className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Quick set:</span>
          <button type="button" className={asicBtnGhost} onClick={() => applyBulk('write')} disabled={loading}>
            All write
          </button>
          <button type="button" className={asicBtnGhost} onClick={() => applyBulk('read')} disabled={loading}>
            All read
          </button>
          <button type="button" className={asicBtnGhost} onClick={() => applyBulk('none')} disabled={loading}>
            Revoke all
          </button>
          <button type="button" className={asicBtnGhost} onClick={applyDefaults} disabled={loading}>
            Defaults
          </button>
          <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">
            — none · R read · W write
          </span>
        </WriteGate>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        {!user.userId ? (
          <p className="text-sm text-amber-700">User ID unavailable — refresh the user list and try again.</p>
        ) : loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
            ))}
          </div>
        ) : (
          <WriteGate className="grid gap-3 lg:grid-cols-2">
            {groups.map(group => (
              <section
                key={group.id}
                className="rounded-lg border border-slate-200 bg-white"
                aria-labelledby={`perm-group-${group.id}`}
              >
                <header className="border-b border-slate-100 bg-slate-50/90 px-3 py-2">
                  <h3
                    id={`perm-group-${group.id}`}
                    className="text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {group.label}
                  </h3>
                </header>
                <div className="grid gap-1.5 p-2 sm:grid-cols-2">
                  {group.sections.map(sectionId => (
                    <SectionAccessToggle
                      key={sectionId}
                      label={sectionLabel(sectionId)}
                      value={sectionAccess[sectionId] ?? 'read'}
                      onChange={level => setPageAccess(sectionId, level)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </WriteGate>
        )}
      </div>
    </Modal>
  );
}
