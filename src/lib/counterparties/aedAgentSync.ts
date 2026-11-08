import 'server-only';

import type { QueryResult } from 'pg';
import { query } from '@/lib/db';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

/** Ensure ic_aed_agents row exists when counterparty has agent role; remove link when not. */
export async function syncCounterpartyAedAgent(
  client: DbClient,
  params: { counterpartyId: string; name: string; hasAgentRole: boolean },
): Promise<void> {
  const { counterpartyId, name, hasAgentRole } = params;
  if (!hasAgentRole) {
    await client.query(
      `UPDATE ic_aed_agents SET status = 'inactive' WHERE counterparty_id = $1`,
      [counterpartyId],
    );
    return;
  }

  const existing = await client.query(
    `SELECT id FROM ic_aed_agents WHERE counterparty_id = $1 LIMIT 1`,
    [counterpartyId],
  );
  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE ic_aed_agents SET name = $2, status = 'active' WHERE counterparty_id = $1`,
      [counterpartyId, name.trim()],
    );
    return;
  }

  await client.query(
    `INSERT INTO ic_aed_agents (counterparty_id, name, status)
     VALUES ($1, $2, 'active')`,
    [counterpartyId, name.trim()],
  );
}

export async function resolveAedAgentIdForCounterpartyWithClient(
  client: DbClient,
  counterpartyOrAgentId: string,
): Promise<string | null> {
  const asAgent = await client.query(`SELECT id FROM ic_aed_agents WHERE id = $1 LIMIT 1`, [
    counterpartyOrAgentId,
  ]);
  if (asAgent.rows.length > 0) return counterpartyOrAgentId;

  const counterpartyId = counterpartyOrAgentId;
  const res = await client.query(
    `SELECT id FROM ic_aed_agents
     WHERE counterparty_id = $1 AND status = 'active'
     LIMIT 1`,
    [counterpartyId],
  );
  if (res.rows.length > 0) return String(res.rows[0].id);
  const cp = await client.query(`SELECT name FROM ic_counterparties WHERE id = $1 LIMIT 1`, [
    counterpartyId,
  ]);
  if (cp.rows.length === 0) return null;
  await syncCounterpartyAedAgent(client, {
    counterpartyId,
    name: String(cp.rows[0].name),
    hasAgentRole: true,
  });
  const again = await client.query(
    `SELECT id FROM ic_aed_agents WHERE counterparty_id = $1 LIMIT 1`,
    [counterpartyId],
  );
  return again.rows.length > 0 ? String(again.rows[0].id) : null;
}

export async function resolveAedAgentIdForCounterparty(
  counterpartyId: string,
): Promise<string | null> {
  return resolveAedAgentIdForCounterpartyWithClient({ query }, counterpartyId);
}

let relinkDone = false;
let relinkInflight: Promise<void> | null = null;

/**
 * Point historic `aed_agent:{uuid}` fund accounts (and their vouchers) at the
 * agent counterparty so KPIs, journals, and Books match the party page.
 * Skip when no shadow accounts remain — never run this DDL-heavy remap on every read.
 */
export async function relinkAedAgentLedgerAccounts(client: DbClient = { query }): Promise<void> {
  if (relinkDone) return;
  if (!relinkInflight) {
    relinkInflight = runRelinkAedAgentLedgerAccounts(client).finally(() => {
      relinkInflight = null;
    });
  }
  await relinkInflight;
}

async function runRelinkAedAgentLedgerAccounts(client: DbClient): Promise<void> {
  const pending = await client.query(
    `SELECT 1 FROM ic_fund_accounts
     WHERE source_type = 'ic_counterparty' AND source_id LIKE 'aed_agent:%'
     LIMIT 1`,
  );
  if (pending.rows.length === 0) {
    relinkDone = true;
    return;
  }

  await client.query(
    `UPDATE ic_fund_vouchers v
     SET debit_account_id = cp.id
     FROM ic_fund_accounts shadow
     JOIN ic_aed_agents ag
       ON shadow.source_type = 'ic_counterparty'
      AND shadow.source_id = ('aed_agent:' || ag.id::text)
     JOIN ic_fund_accounts cp
       ON cp.branch_id = shadow.branch_id
      AND cp.source_type = 'ic_counterparty'
      AND cp.source_id = ag.counterparty_id::text
      AND cp.id <> shadow.id
     WHERE v.debit_account_id = shadow.id
       AND ag.counterparty_id IS NOT NULL`,
  );
  await client.query(
    `UPDATE ic_fund_vouchers v
     SET credit_account_id = cp.id
     FROM ic_fund_accounts shadow
     JOIN ic_aed_agents ag
       ON shadow.source_type = 'ic_counterparty'
      AND shadow.source_id = ('aed_agent:' || ag.id::text)
     JOIN ic_fund_accounts cp
       ON cp.branch_id = shadow.branch_id
      AND cp.source_type = 'ic_counterparty'
      AND cp.source_id = ag.counterparty_id::text
      AND cp.id <> shadow.id
     WHERE v.credit_account_id = shadow.id
       AND ag.counterparty_id IS NOT NULL`,
  );
  await client.query(
    `UPDATE ic_fund_accounts a
     SET source_id = ag.counterparty_id::text,
         name = COALESCE(NULLIF(btrim(ag.name), ''), a.name)
     FROM ic_aed_agents ag
     WHERE a.source_type = 'ic_counterparty'
       AND a.source_id = ('aed_agent:' || ag.id::text)
       AND ag.counterparty_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM ic_fund_accounts x
         WHERE x.branch_id = a.branch_id
           AND x.source_type = 'ic_counterparty'
           AND x.source_id = ag.counterparty_id::text
           AND x.id <> a.id
       )`,
  );
  await client.query(
    `UPDATE ic_fund_accounts cp
     SET opening_balance = COALESCE(cp.opening_balance, 0) + COALESCE(shadow.opening_balance, 0)
     FROM ic_fund_accounts shadow
     JOIN ic_aed_agents ag
       ON shadow.source_type = 'ic_counterparty'
      AND shadow.source_id = ('aed_agent:' || ag.id::text)
     WHERE cp.branch_id = shadow.branch_id
       AND cp.source_type = 'ic_counterparty'
       AND cp.source_id = ag.counterparty_id::text
       AND cp.id <> shadow.id
       AND ag.counterparty_id IS NOT NULL
       AND COALESCE(shadow.opening_balance, 0) <> 0`,
  );
  await client.query(
    `UPDATE ic_fund_accounts a
     SET source_id = 'amrg:' || ag.id::text,
         opening_balance = 0,
         status = 'inactive'
     FROM ic_aed_agents ag
     WHERE a.source_type = 'ic_counterparty'
       AND a.source_id = ('aed_agent:' || ag.id::text)
       AND ag.counterparty_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM ic_fund_accounts x
         WHERE x.branch_id = a.branch_id
           AND x.source_type = 'ic_counterparty'
           AND x.source_id = ag.counterparty_id::text
           AND x.id <> a.id
       )
       AND EXISTS (
         SELECT 1 FROM ic_fund_vouchers v
         WHERE v.debit_account_id = a.id OR v.credit_account_id = a.id
       )`,
  );
  await client.query(
    `DELETE FROM ic_fund_accounts a
     USING ic_aed_agents ag
     WHERE a.source_type = 'ic_counterparty'
       AND a.source_id = ('aed_agent:' || ag.id::text)
       AND ag.counterparty_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM ic_fund_accounts x
         WHERE x.branch_id = a.branch_id
           AND x.source_type = 'ic_counterparty'
           AND x.source_id = ag.counterparty_id::text
           AND x.id <> a.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM ic_fund_vouchers v
         WHERE v.debit_account_id = a.id OR v.credit_account_id = a.id
       )`,
  );
  relinkDone = true;
}
