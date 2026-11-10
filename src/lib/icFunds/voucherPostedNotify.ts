import type { ICFundAccount } from '@/types';

export type IcFundsVoucherPostedDetail = {
  counterpartyIds?: string[];
};

const EVENT = 'ic-funds-voucher-posted';

export function notifyIcFundsVoucherPosted(detail?: IcFundsVoucherPostedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<IcFundsVoucherPostedDetail>(EVENT, { detail }));
}

export function subscribeIcFundsVoucherPosted(
  listener: (detail?: IcFundsVoucherPostedDetail) => void,
): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<IcFundsVoucherPostedDetail>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

export function voucherPostedTargetsCounterparty(
  detail: IcFundsVoucherPostedDetail | undefined,
  counterpartyId: string,
): boolean {
  const ids = detail?.counterpartyIds;
  if (!ids?.length) return true;
  return ids.includes(counterpartyId);
}

export function counterpartyIdsFromVoucherAccounts(
  accounts: ICFundAccount[],
  debitAccountId: string,
  creditAccountId: string,
): string[] {
  const ids = new Set<string>();
  for (const accountId of [debitAccountId, creditAccountId]) {
    const account = accounts.find(a => a.id === accountId);
    if (!account?.sourceId) continue;
    const st = account.sourceType ?? '';
    const sid = account.sourceId;
    if (st === 'ic_counterparty' && !sid.startsWith('aed_agent:') && !sid.startsWith('purchase:')) {
      ids.add(sid);
    }
  }
  return [...ids];
}
