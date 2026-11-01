'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchICTransferSettingsAction,
  updateICTransferAutoRateResetAction,
  updateICTransferSalesEnabledAction,
  updateICTransferWarehouseFulfillmentAction,
} from '@/app/actions/icTransferSettingsActions';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import { asicCard, asicBtnPrimary } from '@/components/asic/ui';
import { ASICFormSkeleton } from '@/components/asic/ASICTableSkeleton';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { useApp } from '@/context/AppContext';

export default function GlobalSettingsScreen() {
  const qc = useQueryClient();
  const { canWrite } = useWriteAccess();
  const { refetchData } = useApp();
  const [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'global-settings'],
    queryFn: async () => {
      const res = await fetchICTransferSettingsAction();
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to load');
      return res.data;
    },
  });

  const salesMut = useMutation({
    mutationFn: (enabled: boolean) => updateICTransferSalesEnabledAction(enabled),
    onSuccess: res => {
      if (!res.success) setError(res.error || 'Update failed');
      qc.invalidateQueries({ queryKey: ['admin', 'global-settings'] });
    },
  });

  const resetMut = useMutation({
    mutationFn: (enabled: boolean) => updateICTransferAutoRateResetAction(enabled),
    onSuccess: res => {
      if (!res.success) setError(res.error || 'Update failed');
      qc.invalidateQueries({ queryKey: ['admin', 'global-settings'] });
    },
  });

  const fulfillmentMut = useMutation({
    mutationFn: (enabled: boolean) => updateICTransferWarehouseFulfillmentAction(enabled),
    onSuccess: async res => {
      if (!res.success) setError(res.error || 'Update failed');
      qc.invalidateQueries({ queryKey: ['admin', 'global-settings'] });
      await refetchData();
    },
  });

  if (query.isLoading) return <ASICFormSkeleton fields={4} />;
  if (query.error) return <p className="text-sm text-red-600">{(query.error as Error).message}</p>;
  const settings = query.data;

  return (
    <div>
      <AsicPageHeader title="Company Settings" />
      <div className={`${asicCard} max-w-xl p-4 text-sm`}>
        {error ? <p className="mb-2 text-red-600">{error}</p> : null}
        <label className="mb-3 flex items-center justify-between gap-4">
          <span>Sales enabled</span>
          <input
            type="checkbox"
            checked={!!settings?.salesEnabled}
            disabled={!canWrite}
            onChange={e => canWrite && salesMut.mutate(e.target.checked)}
          />
        </label>
        <label className="mb-3 flex items-center justify-between gap-4">
          <span>Warehouse portal &amp; delivery workflow</span>
          <input
            type="checkbox"
            checked={!!settings?.warehouseFulfillmentEnabled}
            disabled={!canWrite}
            onChange={e => canWrite && fulfillmentMut.mutate(e.target.checked)}
          />
        </label>
        <p className="mb-3 text-[11px] text-slate-500">
          Off: admin sales save as completed entries (no accept / assign / deliver steps). Purchases and
          sales still require a warehouse for stock and HQ ledger COGS.
        </p>
        <label className="mb-4 flex items-center justify-between gap-4">
          <span>Auto rate reset (5pm Dubai)</span>
          <input
            type="checkbox"
            checked={!!settings?.autoRateResetEnabled}
            disabled={!canWrite}
            onChange={e => canWrite && resetMut.mutate(e.target.checked)}
          />
        </label>
        <p className="text-[11px] text-slate-500">Changes are audited. Posted finance vouchers remain immutable.</p>
        <button
          type="button"
          className={`${asicBtnPrimary} mt-3`}
          onClick={() => query.refetch()}
          data-readonly-allow
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
