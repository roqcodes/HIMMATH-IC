'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getICTransferModalSnapshotsAction,
  getWarehouseStockSnapshotAction,
} from '@/app/actions/icTransferModalSnapshotActions';
import {
  buildEntityLedgerMap,
  indexICFundBalancesBySource,
  type EntityLedgerBalances,
} from '@/lib/icTransfer/entitySearchOptions';

type Snapshots = {
  entityLedgerById: Record<string, EntityLedgerBalances>;
  warehouseAvailableById: Record<string, number>;
  warehouseMetalGById: Record<string, number>;
};

const EMPTY: Snapshots = {
  entityLedgerById: {},
  warehouseAvailableById: {},
  warehouseMetalGById: {},
};

const CACHE_MS = 60_000;
let cached: { data: Snapshots; at: number } | null = null;
let inflight: Promise<Snapshots> | null = null;

function snapshotToClientData(
  snapshot: Awaited<ReturnType<typeof getICTransferModalSnapshotsAction>>,
): Snapshots {
  const aedIndexed = indexICFundBalancesBySource(snapshot.aedFundAccounts ?? []);
  return {
    entityLedgerById: buildEntityLedgerMap(aedIndexed, snapshot.inrBalanceByEntityId ?? {}),
    warehouseAvailableById: snapshot.warehouseAvailableById,
    warehouseMetalGById: snapshot.warehouseMetalGById ?? {},
  };
}

async function loadSnapshots(force: boolean): Promise<Snapshots> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) {
    return cached.data;
  }
  if (inflight) return inflight;

  inflight = getICTransferModalSnapshotsAction()
    .then(snapshot => {
      const data = snapshotToClientData(snapshot);
      cached = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

type Options = {
  /** When set, patch warehouse units/metal from a cheap single-row query (no full snapshot). */
  warehouseId?: string;
};

/** Ledger + warehouse stock for IC transfer modals. One fetch on open; ~60s client cache. */
export function useICTransferModalSnapshots(
  open: boolean,
  options: Options = {},
): Snapshots & { refresh: () => void; refreshing: boolean } {
  const warehouseId = options.warehouseId?.trim() ?? '';
  const [data, setData] = useState<Snapshots>(() => cached?.data ?? EMPTY);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyWarehousePatch = useCallback(
    (units: number, metalG: number) => {
      if (!warehouseId) return;
      setData(prev => ({
        ...prev,
        warehouseAvailableById: { ...prev.warehouseAvailableById, [warehouseId]: units },
        warehouseMetalGById: { ...prev.warehouseMetalGById, [warehouseId]: metalG },
      }));
      if (cached) {
        cached = {
          at: cached.at,
          data: {
            ...cached.data,
            warehouseAvailableById: { ...cached.data.warehouseAvailableById, [warehouseId]: units },
            warehouseMetalGById: { ...cached.data.warehouseMetalGById, [warehouseId]: metalG },
          },
        };
      }
    },
    [warehouseId],
  );

  const refreshInternal = useCallback(async (force = false) => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const next = await loadSnapshots(force);
      if (id !== requestId.current) return;
      setData(next);
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      void refreshInternal(true);
    }, 600);
  }, [refreshInternal]);

  useEffect(() => {
    if (!open) return;
    if (cached) setData(cached.data);
    void refreshInternal(cached == null || Date.now() - cached.at >= CACHE_MS);
  }, [open, refreshInternal]);

  useEffect(() => {
    if (!open || !warehouseId) return;
    let cancelled = false;
    void getWarehouseStockSnapshotAction(warehouseId).then(row => {
      if (cancelled || !row) return;
      applyWarehousePatch(row.units, row.metalG);
    });
    return () => {
      cancelled = true;
    };
  }, [open, warehouseId, applyWarehousePatch]);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  return { ...data, refresh, refreshing };
}

export function invalidateICTransferModalSnapshotCache(): void {
  cached = null;
}
