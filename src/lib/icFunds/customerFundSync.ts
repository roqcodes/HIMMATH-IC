import 'server-only';

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { syncICCounterpartyFundAccount } from '@/lib/icFunds/icTransferFundSync';

/** Ensure every counterparty has a personal IC Funds account on the HQ ledger. */
export async function syncCustomerFundAccount(counterpartyId: string): Promise<void> {
  return syncICCounterpartyFundAccount(counterpartyId);
}

export async function deactivateCustomerFundAccount(_counterpartyId: string): Promise<void> {
  try {
    await query(
      `UPDATE ic_fund_accounts
       SET status = 'inactive'
       WHERE source_type = 'ic_counterparty' AND source_id = $1`,
      [_counterpartyId],
    );
  } catch (err) {
    logger.error({ err, counterpartyId: _counterpartyId }, 'Failed to deactivate counterparty fund account');
  }
}
