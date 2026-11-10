import type { ICFundVoucherType } from '@/lib/icFunds/constants';

export type VoucherDeepLinkBook = 'AED' | 'INR';

export function voucherSectionPath(
  voucherType: Extract<ICFundVoucherType, 'payment' | 'receipt'>,
  opts?: { branchSlug?: string },
): string {
  const section = voucherType === 'payment' ? 'payments' : 'receipts';
  if (opts?.branchSlug?.trim()) {
    return `/${opts.branchSlug.trim()}/ic-funds/${section}`;
  }
  return `/admin/${section}`;
}

/** Open payments / receipts with party ledger prefilled (Paid to / Received from). */
export function counterpartyVoucherHref(
  voucherType: Extract<ICFundVoucherType, 'payment' | 'receipt'>,
  opts: {
    partyAccountId?: string | null;
    book?: VoucherDeepLinkBook;
    branchSlug?: string;
  },
): string {
  const base = voucherSectionPath(voucherType, { branchSlug: opts.branchSlug });
  const params = new URLSearchParams();
  const partyId = opts.partyAccountId?.trim();
  if (partyId) params.set('partyAccountId', partyId);
  if (opts.book === 'AED' || opts.book === 'INR') params.set('book', opts.book);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function pickCounterpartyVoucherBook(aedAccountId?: string | null, inrAccountId?: string | null): VoucherDeepLinkBook {
  if (aedAccountId?.trim()) return 'AED';
  if (inrAccountId?.trim()) return 'INR';
  return 'AED';
}

export function counterpartyPartyAccountId(
  book: VoucherDeepLinkBook,
  aedAccountId?: string | null,
  inrAccountId?: string | null,
): string | null {
  const id = book === 'INR' ? inrAccountId : aedAccountId;
  return id?.trim() ? id.trim() : null;
}
