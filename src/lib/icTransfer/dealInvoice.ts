import { TRADE_ADDRESS, TRADE_LOGO_URL, TRADE_NAME, TRADE_PHONE } from '@/lib/brand';
import { isMetalAedPayment } from '@/lib/domain/books';
import { dealPurchaseAed, dealSaleAed } from '@/lib/icTransfer/dealBookKpis';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { hasLab, netMetalInr } from '@/lib/icTransfer/labTest';
import { formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
import type { Branch, ICPurchase, ICSale, ICWarehouse } from '@/types';

export type DealInvoiceKind = 'purchase' | 'sale';
export type DealInvoiceBook = 'metal' | 'ic';
export type DealInvoiceCurrency = 'INR' | 'AED';

export type DealInvoiceIssuer = {
  name: string;
  addressLines: string[];
  phone?: string;
  logoUrl: string;
};

export type DealInvoiceDoc = {
  kind: DealInvoiceKind;
  book: DealInvoiceBook;
  number: string;
  filename: string;
  dateLabel: string;
  currency: DealInvoiceCurrency;
  titleEn: string;
  titleAr: string;
  issuer: DealInvoiceIssuer;
  branchName: string;
  partyLabel: string;
  partyLabelAr: string;
  partyName: string;
  partyHint?: string;
  detailsTitle: string;
  detailsTitleAr: string;
  details: string[];
  item: {
    name: string;
    serial: string;
    status: string;
    purity: string;
    pcs: string;
    grossG: string;
    pureG: string;
    value: string;
  };
  valueHeader: string;
  pricing: {
    kind: string;
    originalRate: string;
    adjustmentLabel: string;
    adjustmentRate: string;
    fxRate: string;
    rateSource: string;
  };
  summary: { label: string; value: string }[];
  totalBarLabel: string;
  totalBarValue: string;
  notes: string[];
  footerLeft: string;
  footerRight: string;
};

export type DealInvoiceBuildContext = {
  issuer: DealInvoiceIssuer;
  branchName: string;
  warehouseName: string;
  partyName: string;
  agentName?: string | null;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function formatDateLabel(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function formatQty(n: number, digits = 3): string {
  return (Number(n) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: Math.max(3, digits),
  });
}

function formatPcs(n: number): string {
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

/** ASCII money for PDF + tests. HTML renderer styles this separately. */
export function formatInvoiceMoney(amount: number, currency: DealInvoiceCurrency): string {
  const n = round2(amount);
  if (currency === 'INR') {
    return `INR ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRate(amount: number, currency: DealInvoiceCurrency, per: 'g' | 'unit'): string {
  const n = round2(amount);
  const num =
    currency === 'INR'
      ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${num} ${currency}/${per === 'g' ? 'G' : 'U'}`;
}

function slugFile(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

export const DEAL_INVOICE_ISSUER: DealInvoiceIssuer = {
  name: TRADE_NAME,
  addressLines: [TRADE_ADDRESS],
  phone: TRADE_PHONE,
  logoUrl: TRADE_LOGO_URL,
};

export function resolveDealInvoiceIssuer(
  branches: Branch[],
  opts: { currentSlug?: string; userBranchId?: string; warehouse?: ICWarehouse | null },
): { issuer: DealInvoiceIssuer; branchName: string } {
  const branch =
    (opts.userBranchId && branches.find(b => b.id === opts.userBranchId)) ||
    (opts.currentSlug && opts.currentSlug !== 'superadmin'
      ? branches.find(b => b.slug === opts.currentSlug)
      : null) ||
    (opts.warehouse?.branchId ? branches.find(b => b.id === opts.warehouse?.branchId) : null) ||
    branches.find(b => b.status === 'active') ||
    branches[0];

  return {
    branchName: branch?.name || 'Main Branch',
    issuer: DEAL_INVOICE_ISSUER,
  };
}

function metalGrossInr(deal: { inrTotal?: number | null }): number {
  return round2(Number(deal.inrTotal) || 0);
}

function metalNetInr(deal: { inrTotal?: number | null; labTotalInr?: number | null }): number {
  return netMetalInr(Number(deal.inrTotal) || 0, Number(deal.labTotalInr) || 0);
}

function weightLabel(g: number): string {
  return `${formatQty(g, 4)} g`;
}

export function buildPurchaseInvoice(
  purchase: ICPurchase,
  ctx: DealInvoiceBuildContext,
): DealInvoiceDoc {
  const isMetal = purchase.settlementMode === 'metal';
  const agentAed = isMetal && isMetalAedPayment(purchase.metalPaymentMethod);
  const currency: DealInvoiceCurrency = isMetal && !agentAed ? 'INR' : 'AED';
  const number = getFormattedTxnId(purchase.id, 'purchase', purchase);
  const gross = isMetal
    ? agentAed
      ? round2(dealPurchaseAed(purchase))
      : metalGrossInr(purchase)
    : round2(Number(purchase.aedTotal) || Number(purchase.units) * Number(purchase.unitRate) || 0);
  const lab = isMetal && !agentAed && hasLab(purchase) ? round2(Number(purchase.labTotalInr) || 0) : 0;
  const net = isMetal && !agentAed ? metalNetInr(purchase) : gross;
  const weight = Number(purchase.metalWeightG) || 0;
  const rate = isMetal
    ? agentAed
      ? Number(purchase.metalRateAedPerG) || (weight > 0 ? gross / weight : 0)
      : Number(purchase.metalRateInrPerG) || (weight > 0 ? metalGrossInr(purchase) / weight : 0)
    : Number(purchase.unitRate) || 0;
  const settlement = formatSettlementModeLabel(purchase.settlementMode, purchase.metalPaymentMethod);

  const details = [
    'Posted',
    isMetal ? 'Original pricing: Unfixed' : 'Original pricing: Fixed',
    `Journal: ${number}`,
    isMetal ? (agentAed ? 'Metal purchase via agent' : 'Direct purchase') : 'Direct purchase',
  ];
  if (ctx.agentName) details.push(`Agent: ${ctx.agentName}`);

  const summary = isMetal
    ? [
        { label: 'Pure weight - g', value: weightLabel(weight) },
        { label: `Reference value - ${currency}`, value: formatInvoiceMoney(gross, currency) },
        { label: `Adjustment - ${currency}`, value: formatInvoiceMoney(lab, currency === 'INR' ? 'INR' : currency) },
      ]
    : [
        { label: 'Units', value: formatPcs(purchase.units) },
        { label: `Reference value - ${currency}`, value: formatInvoiceMoney(gross, currency) },
        { label: `Adjustment - ${currency}`, value: formatInvoiceMoney(0, currency) },
      ];

  return {
    kind: 'purchase',
    book: isMetal ? 'metal' : 'ic',
    number,
    filename: slugFile(`purchase-receipt-${number}.pdf`),
    dateLabel: formatDateLabel(purchase.createdAt),
    currency,
    titleEn: 'Purchase Receipt',
    titleAr: 'إيصال استلام مشتريات',
    issuer: DEAL_INVOICE_ISSUER,
    branchName: ctx.branchName,
    partyLabel: 'Supplier',
    partyLabelAr: 'المورد',
    partyName: ctx.partyName,
    partyHint: ctx.warehouseName ? `Received into ${ctx.warehouseName}` : undefined,
    detailsTitle: 'Receipt details',
    detailsTitleAr: 'تفاصيل الإيصال',
    details,
    item: {
      name: isMetal ? 'FINE GOLD' : 'IC UNITS',
      serial: number,
      status: 'Posted',
      purity: isMetal ? '999' : '—',
      pcs: isMetal ? '1' : formatPcs(purchase.units),
      grossG: isMetal ? weightLabel(weight) : '—',
      pureG: isMetal ? weightLabel(weight) : '—',
      value: formatInvoiceMoney(gross, currency),
    },
    valueHeader: `Receipt value - ${currency}`,
    pricing: {
      kind: isMetal ? 'Unfixed' : 'Fixed',
      originalRate: formatRate(rate, currency, isMetal ? 'g' : 'unit'),
      adjustmentLabel: lab > 0 ? 'Lab' : 'None',
      adjustmentRate: formatRate(isMetal && weight > 0 && lab > 0 ? lab / weight : 0, currency, isMetal ? 'g' : 'unit'),
      fxRate: '1',
      rateSource: settlement,
    },
    summary,
    totalBarLabel: `Receipt value - ${currency}`,
    totalBarValue: formatInvoiceMoney(net, currency),
    notes: [
      'Unfixed lines show their original provisional receipt valuation. Final agreed prices are recorded separately when fixed. This goods receipt is not a supplier tax invoice or proof of payment.',
      'Every figure is the stored, once-rounded document fact.',
      'Tax treatment pending professional sign-off; this document carries no VAT.',
    ],
    footerLeft: `${TRADE_NAME} - ${TRADE_ADDRESS}`,
    footerRight: number,
  };
}

export function buildSaleInvoice(sale: ICSale, ctx: DealInvoiceBuildContext): DealInvoiceDoc {
  const isMetal = sale.settlementMode === 'metal';
  const agentAed = isMetal && isMetalAedPayment(sale.metalPaymentMethod);
  const currency: DealInvoiceCurrency = isMetal && !agentAed ? 'INR' : 'AED';
  const number = getFormattedTxnId(sale.id, 'sale', sale);
  const gross = isMetal
    ? agentAed
      ? round2(dealSaleAed(sale))
      : metalGrossInr(sale)
    : round2((Number(sale.aedAmount) || Number(sale.units) * Number(sale.unitRate) || 0) + (Number(sale.serviceCharge) || 0));
  const lab = isMetal && !agentAed && hasLab(sale) ? round2(Number(sale.labTotalInr) || 0) : 0;
  const net = isMetal && !agentAed ? metalNetInr(sale) : gross;
  const weight = Number(sale.metalWeightG) || 0;
  const rate = isMetal
    ? agentAed
      ? Number(sale.metalRateAedPerG) || (weight > 0 ? gross / weight : 0)
      : Number(sale.metalRateInrPerG) || (weight > 0 ? metalGrossInr(sale) / weight : 0)
    : Number(sale.unitRate) || 0;
  const settlement = formatSettlementModeLabel(sale.settlementMode, sale.metalPaymentMethod);

  const details = [
    'Posted',
    isMetal ? 'Original pricing: Unfixed' : 'Original pricing: Fixed',
    `Journal: ${number}`,
    isMetal ? (agentAed ? 'Metal sale via agent' : 'Direct sale') : 'Direct sale',
  ];
  if (ctx.agentName) details.push(`Agent: ${ctx.agentName}`);

  const summary = isMetal
    ? [
        { label: 'Pure weight - g', value: weightLabel(weight) },
        { label: `Reference value - ${currency}`, value: formatInvoiceMoney(gross, currency) },
        { label: `Adjustment - ${currency}`, value: formatInvoiceMoney(lab, currency === 'INR' ? 'INR' : currency) },
      ]
    : [
        { label: 'Units', value: formatPcs(sale.units) },
        { label: `Reference value - ${currency}`, value: formatInvoiceMoney(gross, currency) },
        { label: `Adjustment - ${currency}`, value: formatInvoiceMoney(0, currency) },
      ];

  return {
    kind: 'sale',
    book: isMetal ? 'metal' : 'ic',
    number,
    filename: slugFile(`sale-receipt-${number}.pdf`),
    dateLabel: formatDateLabel(sale.createdAt),
    currency,
    titleEn: 'Sale Receipt',
    titleAr: 'إيصال استلام مبيعات',
    issuer: DEAL_INVOICE_ISSUER,
    branchName: ctx.branchName,
    partyLabel: 'Customer',
    partyLabelAr: 'العميل',
    partyName: ctx.partyName,
    partyHint: ctx.warehouseName ? `Issued from ${ctx.warehouseName}` : undefined,
    detailsTitle: 'Receipt details',
    detailsTitleAr: 'تفاصيل الإيصال',
    details,
    item: {
      name: isMetal ? 'FINE GOLD' : 'IC UNITS',
      serial: number,
      status: 'Posted',
      purity: isMetal ? '999' : '—',
      pcs: isMetal ? '1' : formatPcs(sale.units),
      grossG: isMetal ? weightLabel(weight) : '—',
      pureG: isMetal ? weightLabel(weight) : '—',
      value: formatInvoiceMoney(gross, currency),
    },
    valueHeader: `Receipt value - ${currency}`,
    pricing: {
      kind: isMetal ? 'Unfixed' : 'Fixed',
      originalRate: formatRate(rate, currency, isMetal ? 'g' : 'unit'),
      adjustmentLabel: lab > 0 ? 'Lab' : 'None',
      adjustmentRate: formatRate(isMetal && weight > 0 && lab > 0 ? lab / weight : 0, currency, isMetal ? 'g' : 'unit'),
      fxRate: '1',
      rateSource: settlement,
    },
    summary,
    totalBarLabel: `Receipt value - ${currency}`,
    totalBarValue: formatInvoiceMoney(net, currency),
    notes: [
      'Unfixed lines show their original provisional receipt valuation. Final agreed prices are recorded separately when fixed. This goods receipt is not a tax invoice or proof of payment.',
      'Every figure is the stored, once-rounded document fact.',
      'Tax treatment pending professional sign-off; this document carries no VAT.',
    ],
    footerLeft: `${TRADE_NAME} - ${TRADE_ADDRESS}`,
    footerRight: number,
  };
}
