'use client';

import { useEffect, useRef, useState } from 'react';
import {
  listAvailableMetalLotsAction,
  type AvailableMetalLot,
} from '@/app/actions/icTransferActions';

function cacheKey(warehouseId: string, excludeSaleId?: string): string {
  return `${warehouseId}|${excludeSaleId?.trim() || ''}`;
}

const lotsCache = new Map<string, AvailableMetalLot[]>();
const inflight = new Map<string, Promise<AvailableMetalLot[]>>();

function fetchLots(warehouseId: string, excludeSaleId?: string): Promise<AvailableMetalLot[]> {
  const key = cacheKey(warehouseId, excludeSaleId);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = listAvailableMetalLotsAction(warehouseId, excludeSaleId)
    .then(lots => {
      lotsCache.set(key, lots);
      return lots;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Cached metal lots for a warehouse — prefetches on open, SWR on warehouse change. */
export function useAvailableMetalLots(
  open: boolean,
  warehouseId: string,
  excludeSaleId?: string,
): { lots: AvailableMetalLot[]; loading: boolean } {
  const key = warehouseId?.trim() ? cacheKey(warehouseId, excludeSaleId) : '';
  const [lots, setLots] = useState<AvailableMetalLot[]>(() =>
    key ? (lotsCache.get(key) ?? []) : [],
  );
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open || !key) {
      setLots([]);
      setLoading(false);
      return;
    }

    const cached = lotsCache.get(key);
    if (cached) {
      setLots(cached);
      setLoading(false);
    } else {
      setLots([]);
      setLoading(true);
    }

    const id = ++requestId.current;
    void fetchLots(warehouseId, excludeSaleId).then(next => {
      if (id !== requestId.current) return;
      setLots(next);
      setLoading(false);
    });

    return () => {
      requestId.current += 1;
    };
  }, [open, key, warehouseId, excludeSaleId]);

  return { lots, loading };
}

/** Warm cache when warehouse is known (e.g. before user switches to metal). */
export function prefetchAvailableMetalLots(warehouseId: string, excludeSaleId?: string): void {
  if (!warehouseId?.trim()) return;
  const key = cacheKey(warehouseId, excludeSaleId);
  if (lotsCache.has(key) || inflight.has(key)) return;
  void fetchLots(warehouseId, excludeSaleId);
}

export function invalidateAvailableMetalLotsCache(): void {
  lotsCache.clear();
}
