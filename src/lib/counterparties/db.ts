import 'server-only';

import { query } from '@/lib/db';

export type CounterpartyLink = {
  counterpartyId: string;
  name: string;
  phone: string | null;
  email: string | null;
  branchId: string | null;
  legacyCustomerId: string | null;
  legacySupplierId: string | null;
};

type Queryable = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

export async function loadCounterpartyLink(
  client: Queryable,
  counterpartyId: string,
): Promise<CounterpartyLink | null> {
  const res = await client.query(
    `SELECT id, name, phone, email, branch_id, legacy_customer_id, legacy_supplier_id
     FROM ic_counterparties WHERE id = $1 LIMIT 1`,
    [counterpartyId],
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    counterpartyId: String(row.id),
    name: String(row.name),
    phone: row.phone ? String(row.phone) : null,
    email: row.email ? String(row.email) : null,
    branchId: row.branch_id ? String(row.branch_id) : null,
    legacyCustomerId: row.legacy_customer_id ? String(row.legacy_customer_id) : null,
    legacySupplierId: row.legacy_supplier_id ? String(row.legacy_supplier_id) : null,
  };
}
