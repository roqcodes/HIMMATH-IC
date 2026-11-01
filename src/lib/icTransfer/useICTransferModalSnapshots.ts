'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listHQICFundAccountsAction } from '@/app/actions/icFundsActions';
import { getICTransferModalSnapshotsAction } from '@/app/actions/icTransferModalSnapshotActions';
import { indexICFundBalancesBySource } from '@/lib/icTransfer/entitySearchOptions';

type Snapshots = {
  supplierBalances: Record<string, number>;
  customerBalances: Record<string, number>;
  warehouseAvailableById: Record<string, number>;
  warehouseMetalGById: Record<string, number>;
};

const EMPTY: Snapshots = {
  supplierBalances: {},
  customerBalances: {},
  warehouseAvailableById: {},
  warehouseMetalGById: {},
};

/** Refetch ledger balances and warehouse availability when modal opens or selection changes. */
export function useICTransferModalSnapshots(
  open: boolean,
  selectionKey: string,
): Snapshots & { refresh: () => Promise<void>; refreshing: boolean } {
  const [data, setData] = useState<Snapshots>(EMPTY);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const [accounts, snapshot] = await Promise.all([
        listHQICFundAccountsAction(),
        getICTransferModalSnapshotsAction(),
      ]);
      if (id !== requestId.current) return;
      const { suppliers, customers, counterparties } = indexICFundBalancesBySource(accounts);
      const mergedCounterpartyBalances = { ...counterparties };
      setData({
        supplierBalances: { ...suppliers, ...mergedCounterpartyBalances },
        customerBalances: { ...customers, ...mergedCounterpartyBalances },
        warehouseAvailableById: snapshot.warehouseAvailableById,
        warehouseMetalGById: snapshot.warehouseMetalGById ?? {},
      });
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, selectionKey, refresh]);

  return { ...data, refresh, refreshing };
}
