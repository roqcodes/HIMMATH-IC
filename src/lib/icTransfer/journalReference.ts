import type { ICFundVoucherType } from '@/lib/icFunds/constants';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import type { ICTransferPortalMode } from '@/lib/icTransfer/branchPortalScope';
import type { ICPurchase, ICSale, ICFundVoucher } from '@/types';

const PURCHASE_REFERENCE_TYPES = new Set([
  'ic_purchase',
  'metal_purchase',
  'metal_purchase_aed',
  'lab_test_purchase',
]);

const SALE_REFERENCE_TYPES = new Set([
  'ic_sale',
  'ic_sale_cogs',
  'ic_sale_profit',
  'lab_test_sale',
  'metal_sale_receipt',
  'metal_sale_aed',
  'metal_sale_cogs',
  'metal_sale_profit',
  'metal_sale_ic_stock',
  'metal_fx_profit',
]);

export type JournalReferenceLink =
  | {
      kind: 'purchase';
      purchase: ICPurchase;
      label: string;
    }
  | {
      kind: 'sale';
      sale: ICSale;
      label: string;
    }
  | {
      kind: 'manual';
      label: string;
      href: string;
      description: string;
    }
  | {
      kind: 'unknown';
      label: string;
      description?: string;
    };

export function icFundVoucherSectionPath(
  icFundsSlug: string,
  voucherType: ICFundVoucherType,
  portalMode: ICTransferPortalMode = 'admin',
): string {
  const section =
    voucherType === 'payment'
      ? 'payments'
      : voucherType === 'receipt'
        ? 'receipts'
        : voucherType;
  if (portalMode === 'branch' && icFundsSlug) {
    return `/${icFundsSlug}/ic-funds/${section}`;
  }
  return `/admin/${section}`;
}

export function resolveJournalReferenceLink(
  voucher: Pick<ICFundVoucher, 'referenceType' | 'referenceId' | 'voucherType' | 'voucherNo'>,
  purchases: ICPurchase[],
  sales: ICSale[],
  opts: {
    icFundsSlug: string;
    portalMode?: ICTransferPortalMode;
  },
): JournalReferenceLink {
  const ref = voucher.referenceType;
  const id = voucher.referenceId;

  if (ref && id && PURCHASE_REFERENCE_TYPES.has(ref)) {
    const purchase = purchases.find(p => p.id === id);
    const label = purchase
      ? getFormattedTxnId(purchase.id, 'purchase', purchase)
      : id.slice(0, 8);
    if (purchase) {
      return { kind: 'purchase', purchase, label };
    }
    return {
      kind: 'unknown',
      label,
      description: 'Purchase record is not loaded in this view.',
    };
  }

  if (ref && id && SALE_REFERENCE_TYPES.has(ref)) {
    const sale = sales.find(s => s.id === id);
    const label = sale ? getFormattedTxnId(sale.id, 'sale', sale) : id.slice(0, 8);
    if (sale) {
      return { kind: 'sale', sale, label };
    }
    return {
      kind: 'unknown',
      label,
      description: 'Sale record is not loaded in this view.',
    };
  }

  if (ref === 'currency_exchange') {
    return {
      kind: 'manual',
      label: 'Currency exchange',
      href: '/admin/fx',
      description: 'AED ↔ INR cash conversion (not profit).',
    };
  }

  if (!ref && !id) {
    const section = icFundVoucherSectionPath(
      opts.icFundsSlug,
      voucher.voucherType,
      opts.portalMode ?? 'admin',
    );
    return {
      kind: 'manual',
      label: `Manual ${voucher.voucherType} #${voucher.voucherNo}`,
      href: section,
      description: 'Posted directly in IC Funds (not tied to a deal).',
    };
  }

  return {
    kind: 'unknown',
    label: ref ? `${ref}${id ? ` · ${id.slice(0, 8)}` : ''}` : '—',
    description: id ? undefined : 'No linked document.',
  };
}
