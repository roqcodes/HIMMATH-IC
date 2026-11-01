import 'server-only';

import { query } from '@/lib/db';
import { COUNTERPARTY_SELECT, mapICCounterpartyRow } from '@/lib/counterparties/mapper';
import type { ICSupplier } from '@/types';
import { counterpartyShortSlug, isFullCounterpartyUuid } from '@/lib/counterparties/counterpartySlug';

export async function fetchCounterpartyByRouteParam(param: string): Promise<ICSupplier | null> {
  if (!param) return null;

  if (isFullCounterpartyUuid(param)) {
    const res = await query(`SELECT ${COUNTERPARTY_SELECT} FROM ic_counterparties WHERE id = $1 LIMIT 1`, [
      param,
    ]);
    return res.rows[0] ? mapICCounterpartyRow(res.rows[0]) : null;
  }

  const slug = param.toLowerCase();
  const res = await query(`SELECT ${COUNTERPARTY_SELECT} FROM ic_counterparties`);
  const matches = res.rows.map(row => mapICCounterpartyRow(row)).filter(s => counterpartyShortSlug(s.id) === slug);
  if (matches.length !== 1) return null;
  return matches[0];
}
