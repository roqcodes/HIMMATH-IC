import 'server-only';

import { query, runQueryBatch } from '@/lib/db';
import {
  accountBalanceSql,
  accountMovementJoinSql,
  inrAccountBalanceSql,
  inrAccountMovementJoinSql,
} from '@/lib/icFunds/accountBalance';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';

export type CapitalInvestorRow = {
  id: string;
  name: string;
  status: string;
  isHouse: boolean;
  capitalAed: number;
  capitalInr: number;
  aedEq: number;
  sharePct: number;
  profitDueAed: number;
  profitDueInr: number;
};

export type CapitalDashboard = {
  cashAed: number;
  cashInr: number;
  capitalAedEq: number;
  profitDueAed: number;
  profitDueInr: number;
  managementSharePct: number;
  openingLocked: boolean;
  investors: CapitalInvestorRow[];
};

export type CapitalSettingsSnapshot = {
  openingAed: number;
  openingInr: number;
  openingInrPerAed: number;
  managementInvestorId: string | null;
  managementSharePct: number;
  openingLocked: boolean;
};

export async function loadCapitalDashboard(
  branchId: string,
): Promise<CapitalDashboard & { settings: CapitalSettingsSnapshot }> {
  const [
    aedBankBal,
    inrBankBal,
    settingsRes,
    lotAgg,
    allocAgg,
    investorsRes,
  ] = await runQueryBatch([
    () =>
      query(
        `SELECT COALESCE(SUM(${accountBalanceSql()}), 0) AS total
         FROM ic_fund_accounts a
         ${accountMovementJoinSql({ branchParam: '$1' })}
         WHERE a.branch_id = $1 AND a.account_type = 'bank' AND a.status = 'active'`,
        [branchId],
      ),
    () =>
      query(
        `SELECT COALESCE(SUM(${inrAccountBalanceSql()}), 0) AS total
         FROM inr_fund_accounts a
         ${inrAccountMovementJoinSql({ branchParam: '$1' })}
         WHERE a.branch_id = $1 AND a.account_type = 'bank' AND a.status = 'active'`,
        [branchId],
      ),
    () =>
      query(
        `SELECT opening_aed, opening_inr, opening_inr_per_aed, management_investor_id,
                management_share_bps, opening_locked_at
         FROM ic_capital_settings WHERE id = 'hq' LIMIT 1`,
      ),
    () =>
      query(
        `SELECT
           l.investor_id,
           COALESCE(SUM(l.amount_native) FILTER (WHERE l.book = 'AED'), 0) AS cap_aed,
           COALESCE(SUM(l.amount_native) FILTER (WHERE l.book = 'INR'), 0) AS cap_inr,
           COALESCE(SUM(l.aed_eq), 0) AS aed_eq
         FROM ic_capital_lots l
         WHERE l.branch_id = $1 AND l.status = 'active'
           AND l.movement_type IN ('opening', 'deposit', 'withdraw')
         GROUP BY l.investor_id`,
        [branchId],
      ),
    () =>
      query(
        `SELECT
           investor_id,
           COALESCE(SUM(allocated_amount) FILTER (WHERE book = 'AED' AND kind <> 'payout'), 0)
             - COALESCE(SUM(allocated_amount) FILTER (WHERE book = 'AED' AND kind = 'payout'), 0) AS due_aed,
           COALESCE(SUM(allocated_amount) FILTER (WHERE book = 'INR' AND kind <> 'payout'), 0)
             - COALESCE(SUM(allocated_amount) FILTER (WHERE book = 'INR' AND kind = 'payout'), 0) AS due_inr
         FROM ic_capital_allocations
         WHERE branch_id = $1 AND status = 'active'
         GROUP BY investor_id`,
        [branchId],
      ),
    () =>
      query(
        `SELECT id, name, status, is_house
         FROM ic_capital_investors
         WHERE branch_id = $1
         ORDER BY is_house DESC, LOWER(name)`,
        [branchId],
      ),
  ]);

  const cashAed = Number(aedBankBal.rows[0]?.total) || 0;
  const cashInr = Number(inrBankBal.rows[0]?.total) || 0;
  const settingsRow = settingsRes.rows[0];
  const managementSharePct = (Number(settingsRow?.management_share_bps) || 0) / 100;
  const openingLocked = Boolean(settingsRow?.opening_locked_at);

  const allocMap = new Map<string, { aed: number; inr: number }>();
  for (const row of allocAgg.rows) {
    allocMap.set(String(row.investor_id), {
      aed: Number(row.due_aed) || 0,
      inr: Number(row.due_inr) || 0,
    });
  }

  const lotMap = new Map<string, { aed: number; inr: number; aedEq: number }>();
  let capitalAedEq = 0;
  for (const row of lotAgg.rows) {
    const id = String(row.investor_id);
    const aedEq = Number(row.aed_eq) || 0;
    capitalAedEq += aedEq;
    lotMap.set(id, {
      aed: Number(row.cap_aed) || 0,
      inr: Number(row.cap_inr) || 0,
      aedEq,
    });
  }

  let profitDueAed = 0;
  let profitDueInr = 0;

  const investors: CapitalInvestorRow[] = investorsRes.rows.map(row => {
    const id = String(row.id);
    const lots = lotMap.get(id) ?? { aed: 0, inr: 0, aedEq: 0 };
    const due = allocMap.get(id) ?? { aed: 0, inr: 0 };
    profitDueAed += due.aed;
    profitDueInr += due.inr;
    const sharePct = capitalAedEq > 0 ? (lots.aedEq / capitalAedEq) * 100 : row.is_house ? 100 : 0;
    return {
      id,
      name: String(row.name),
      status: String(row.status),
      isHouse: Boolean(row.is_house),
      capitalAed: lots.aed,
      capitalInr: lots.inr,
      aedEq: lots.aedEq,
      sharePct,
      profitDueAed: due.aed,
      profitDueInr: due.inr,
    };
  });

  return {
    cashAed,
    cashInr,
    capitalAedEq,
    profitDueAed,
    profitDueInr,
    managementSharePct,
    openingLocked,
    investors,
    settings: {
      openingAed: Number(settingsRow?.opening_aed) || 0,
      openingInr: Number(settingsRow?.opening_inr) || 0,
      openingInrPerAed: Number(settingsRow?.opening_inr_per_aed) || 0,
      managementInvestorId: settingsRow?.management_investor_id
        ? String(settingsRow.management_investor_id)
        : null,
      managementSharePct,
      openingLocked,
    },
  };
}

export async function defaultCapitalBranchId(): Promise<string> {
  return HQ_IC_FUNDS_BRANCH_ID;
}
