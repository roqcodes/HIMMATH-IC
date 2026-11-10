import type { ICFundAccount } from '@/types';
import { accountTypeLabel, type ICFundAccountType } from '@/lib/icFunds/constants';

/** Clearing / inventory ledgers posted by deals — not manual pay-to / receive-from parties. */
const BLOCKED_COUNTERPARTY_SOURCE_IDS = new Set([
  'metal_purchase_aed_clearing',
  'metal_aed_settlement',
]);

const BLOCKED_SOURCE_ID_PREFIXES = ['purchase:'];

export function isVoucherPartyAccount(
  account: Pick<ICFundAccount, 'accountType' | 'sourceType' | 'sourceId'>,
): boolean {
  if (account.accountType !== 'personal') return false;

  const st = (account.sourceType ?? '').toLowerCase();
  const sid = String(account.sourceId ?? '');

  if (st === 'ic_system' || st === 'system') return false;

  if (st === 'ic_counterparty') {
    if (BLOCKED_COUNTERPARTY_SOURCE_IDS.has(sid)) return false;
    if (BLOCKED_SOURCE_ID_PREFIXES.some(prefix => sid.startsWith(prefix))) return false;
    return true;
  }
  if (st === 'ic_customer' || st === 'ic_supplier') return true;
  if (!st) return true;
  if (st === 'ic_warehouse') return false;
  return false;
}

/** Counterparty / customer / supplier ledgers (excludes deal & clearing system accounts). */
export const isTradePartyLedgerAccount = isVoucherPartyAccount;

export function voucherPartyAccountSubtitle(
  account: Pick<ICFundAccount, 'accountType' | 'sourceType' | 'sourceId'>,
): string {
  const st = account.sourceType ?? '';
  const sid = account.sourceId ?? '';
  if (st === 'ic_counterparty' && sid.startsWith('aed_agent:')) return 'Agent';
  if (st === 'ic_counterparty') return 'Counterparty';
  if (st === 'ic_customer') return 'Customer';
  if (st === 'ic_supplier') return 'Supplier';
  if (!st) return 'Party';
  return accountTypeLabel(account.accountType as ICFundAccountType);
}

/** Same tolerance as FmtLedgerAed / FmtLedgerInr zero display (0.005). */
export const LEDGER_BALANCE_EPS = 0.005;

export function isTradeReceivableLedger(account: Pick<ICFundAccount, 'balance' | 'pendingBalance'>): boolean {
  const pending = account.pendingBalance ?? 0;
  return account.balance > LEDGER_BALANCE_EPS || pending > LEDGER_BALANCE_EPS;
}

export function isTradePayableLedger(account: Pick<ICFundAccount, 'balance' | 'pendingBalance'>): boolean {
  const pending = account.pendingBalance ?? 0;
  return account.balance < -LEDGER_BALANCE_EPS || pending < -LEDGER_BALANCE_EPS;
}

/** Type column on reports — party roles vs bank/expense vs internal system ledgers. */
export function ledgerAccountTypeCaption(
  account: Pick<ICFundAccount, 'accountType' | 'sourceType' | 'sourceId'>,
): string {
  if (isTradePartyLedgerAccount(account)) return voucherPartyAccountSubtitle(account);
  if (account.accountType === 'personal') {
    const st = (account.sourceType ?? '').toLowerCase();
    if (st === 'ic_system' || st === 'system') return 'System ledger';
    if (st === 'ic_warehouse') return 'Warehouse';
    if (st) return 'Internal ledger';
  }
  return accountTypeLabel(account.accountType as ICFundAccountType);
}

export function splitTradeReceivablesPayables(accounts: ICFundAccount[]): {
  receivables: ICFundAccount[];
  payables: ICFundAccount[];
} {
  const trade = accounts.filter(isTradePartyLedgerAccount);
  return {
    receivables: trade.filter(isTradeReceivableLedger),
    payables: trade.filter(isTradePayableLedger),
  };
}
