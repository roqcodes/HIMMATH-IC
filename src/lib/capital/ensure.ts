import 'server-only';

import type { QueryResult } from 'pg';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { CAPITAL_SETTINGS_ID, HQ_INVESTOR_NAME, HOUSE_INVESTOR_ID } from '@/lib/capital/constants';
import { postVoucherInTx } from '@/lib/icFunds/icTransferFundSync';
import { ensureInrCashTill, postInrVoucherInTx } from '@/lib/ledgers/inr/inrFundSync';
import { roundLedgerAmount } from '@/lib/icFunds/currencyPolicy';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

async function insertCapitalInvestorAccount(
  client: DbClient,
  branchId: string,
  investorId: string,
  name: string,
  book: 'AED' | 'INR',
): Promise<string> {
  const table = book === 'AED' ? 'ic_fund_accounts' : 'inr_fund_accounts';
  const existing = await client.query(
    `SELECT id FROM ${table}
     WHERE branch_id = $1 AND source_type = 'ic_capital_investor' AND source_id = $2
     LIMIT 1`,
    [branchId, investorId],
  );
  if (existing.rows.length > 0) return String(existing.rows[0].id);

  const prefix = book === 'AED' ? 'ICFA' : 'INFA';
  const id = `${prefix}-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
  await client.query(
    `INSERT INTO ${table} (
       id, branch_id, name, account_type, opening_balance, notes, source_type, source_id
     ) VALUES ($1,$2,$3,'capital',0,'','ic_capital_investor',$4)`,
    [id, branchId, `${name} capital`, investorId],
  );
  return id;
}

export async function ensureCapitalSettingsRow(client: DbClient, branchId: string): Promise<void> {
  await client.query(
    `INSERT INTO ic_capital_settings (id, branch_id)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [CAPITAL_SETTINGS_ID, branchId],
  );
}

export async function ensureHouseInvestor(client: DbClient, branchId: string): Promise<string> {
  await ensureCapitalSettingsRow(client, branchId);
  const existing = await client.query(
    `SELECT id FROM ic_capital_investors WHERE branch_id = $1 AND is_house = true LIMIT 1`,
    [branchId],
  );
  if (existing.rows.length > 0) {
    const id = String(existing.rows[0].id);
    await client.query(
      `UPDATE ic_capital_investors
       SET name = $3, notes = 'Opening / HQ capital'
       WHERE id = $1 AND branch_id = $2 AND (name <> $3 OR notes <> 'Opening / HQ capital')`,
      [id, branchId, HQ_INVESTOR_NAME],
    );
    await insertCapitalInvestorAccount(client, branchId, id, HQ_INVESTOR_NAME, 'AED');
    await insertCapitalInvestorAccount(client, branchId, id, HQ_INVESTOR_NAME, 'INR');
    return id;
  }

  await client.query(
    `INSERT INTO ic_capital_investors (id, branch_id, name, status, is_house, notes)
     VALUES ($1, $2, $3, 'active', true, 'Opening / HQ capital')
     ON CONFLICT (id) DO NOTHING`,
    [HOUSE_INVESTOR_ID, branchId, HQ_INVESTOR_NAME],
  );

  await insertCapitalInvestorAccount(client, branchId, HOUSE_INVESTOR_ID, HQ_INVESTOR_NAME, 'AED');
  await insertCapitalInvestorAccount(client, branchId, HOUSE_INVESTOR_ID, HQ_INVESTOR_NAME, 'INR');
  return HOUSE_INVESTOR_ID;
}

export async function ensureCapitalInvestorAccounts(
  client: DbClient,
  branchId: string,
  investorId: string,
  name: string,
): Promise<{ aedAccountId: string; inrAccountId: string }> {
  const aedAccountId = await insertCapitalInvestorAccount(client, branchId, investorId, name, 'AED');
  const inrAccountId = await insertCapitalInvestorAccount(client, branchId, investorId, name, 'INR');
  return { aedAccountId, inrAccountId };
}

export async function resolveCapitalInvestorAccountId(
  client: DbClient,
  branchId: string,
  investorId: string,
  book: 'AED' | 'INR',
): Promise<string> {
  const table = book === 'AED' ? 'ic_fund_accounts' : 'inr_fund_accounts';
  const res = await client.query(
    `SELECT id FROM ${table}
     WHERE branch_id = $1 AND source_type = 'ic_capital_investor' AND source_id = $2 AND account_type = 'capital'
     LIMIT 1`,
    [branchId, investorId],
  );
  if (res.rows.length === 0) throw new Error('Capital account not found for investor');
  return String(res.rows[0].id);
}

export async function postOpeningCapitalJournal(
  client: DbClient,
  params: {
    branchId: string;
    book: 'AED' | 'INR';
    investorId: string;
    bankAccountId: string;
    amount: number;
    voucherDate: string;
    inrPerAed: number;
    lotId: string;
  },
): Promise<string> {
  const amount = roundLedgerAmount(params.amount);
  if (amount <= 0) throw new Error('Opening amount must be positive');
  const capitalAccountId = await resolveCapitalInvestorAccountId(
    client,
    params.branchId,
    params.investorId,
    params.book,
  );

  if (params.book === 'AED') {
    const voucherId = await postVoucherInTx(client, {
      branchId: params.branchId,
      voucherType: 'journal',
      voucherDate: params.voucherDate,
      debitAccountId: params.bankAccountId,
      creditAccountId: capitalAccountId,
      amount,
      notes: `Opening capital (${params.lotId})`,
      referenceType: 'capital_opening',
      referenceId: params.lotId,
    });
    if (!voucherId) throw new Error('Failed to post opening capital journal');
    return voucherId;
  }

  await ensureInrCashTill(client, params.branchId);
  const voucherId = await postInrVoucherInTx(client, {
    branchId: params.branchId,
    voucherType: 'journal',
    voucherDate: params.voucherDate,
    debitAccountId: params.bankAccountId,
    creditAccountId: capitalAccountId,
    amount,
    notes: `Opening capital (${params.lotId}) · rate ${params.inrPerAed}`,
    referenceType: 'capital_opening',
    referenceId: params.lotId,
  });
  if (!voucherId) throw new Error('Failed to post opening capital journal');
  return voucherId;
}
