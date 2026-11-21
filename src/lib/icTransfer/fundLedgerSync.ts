import type { PoolClient } from 'pg';
import type { DbClient } from '@/lib/icFunds/icTransferFundSync';
import {
  syncICSaleToICFunds,
  syncICPurchaseToICFunds,
  removeICSaleFromICFunds,
  removeICPurchaseFromICFunds,
} from '@/lib/icFunds/icTransferFundSync';

/** Bridge IC Transfer lifecycle events into the IC Funds cash book. */
export async function syncICSaleFundLedger(
  saleId: string,
  client?: PoolClient,
  options?: { deferWarehouseMarginRepair?: boolean },
): Promise<void> {
  await syncICSaleToICFunds(saleId, client as DbClient | undefined, options);
}

export async function syncICPurchaseFundLedger(purchaseId: string, client?: PoolClient): Promise<void> {
  await syncICPurchaseToICFunds(purchaseId, client as DbClient | undefined);
}

export async function removeICSaleFundLedger(saleId: string, client?: PoolClient): Promise<void> {
  await removeICSaleFromICFunds(saleId, client as DbClient | undefined);
}

export async function removeICPurchaseFundLedger(purchaseId: string, client?: PoolClient): Promise<void> {
  await removeICPurchaseFromICFunds(purchaseId, client as DbClient | undefined);
}
