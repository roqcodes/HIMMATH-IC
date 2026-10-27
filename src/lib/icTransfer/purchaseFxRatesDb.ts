import 'server-only';

import type { ICPurchase } from '@/types';

/** Legacy purchase FX snapshots were removed; keep call sites as a no-op. */
export async function attachPurchaseFxRates(purchases: ICPurchase[]): Promise<ICPurchase[]> {
  return purchases;
}
