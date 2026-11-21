'use client';

import { useEffect, useState } from 'react';
import { getWarehouseInrLedgerKpisAction } from '@/app/actions/icFundsActions';
import type { DealBookPair } from '@/lib/icTransfer/dealBookKpis';

export type WarehouseInrLedgerKpi = DealBookPair['inr'] & { accountFound: boolean };

export function useWarehouseInrLedgerKpis(options: {
  branchId: string;
  warehouseIds: string[];
  startDate?: string | null;
  endDate?: string | null;
  refreshKey?: number;
}) {
  const warehouseIdsKey = [...new Set(options.warehouseIds)].sort().join(',');
  const [data, setData] = useState<Record<string, WarehouseInrLedgerKpi>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const warehouseIds = warehouseIdsKey ? warehouseIdsKey.split(',') : [];
    if (warehouseIds.length === 0) {
      setData({});
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    void getWarehouseInrLedgerKpisAction({
      branchId: options.branchId,
      warehouseIds,
      startDate: options.startDate ?? undefined,
      endDate: options.endDate ?? undefined,
    }).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setData({});
        setStatus('error');
        return;
      }
      const complete = warehouseIds.every((id) => result.data[id]?.accountFound);
      setData(result.data);
      setStatus(complete ? 'ready' : 'error');
    }).catch(() => {
      if (cancelled) return;
      setData({});
      setStatus('error');
    });

    return () => {
      cancelled = true;
    };
  }, [warehouseIdsKey, options.branchId, options.startDate, options.endDate, options.refreshKey]);

  return { data, status } as const;
}
