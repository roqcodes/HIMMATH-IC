import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { ledgerAedNode, ledgerInrNode } from '@/lib/icFunds/formatDisplay';
import type { AsicKpiMetric } from '@/components/asic/AsicKpiStrip';
import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';
import { formatMetalGrams } from '@/lib/icTransfer/warehouseMatrixMetrics';

function plTone(value: number): AsicKpiMetric['tone'] {
  if (value > 0) return 'emerald';
  if (value < 0) return 'red';
  return 'slate';
}

/** Metal P&L is INR (sale INR − purchase INR). */
export function formatMetalPlKpi(opts: {
  metalProfitAed: number;
  metalProfitInr: number;
  rangeLabel: string;
}): Pick<AsicKpiMetric, 'value' | 'hint' | 'tone' | 'valueTitle'> {
  const inr = Number(opts.metalProfitInr) || 0;
  return {
    value: ledgerInrNode(inr),
    valueTitle: fmtLedgerInr(inr),
    ...(opts.rangeLabel.trim() ? { hint: opts.rangeLabel } : {}),
    tone: plTone(inr),
  };
}

const fmtUnits = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });

/** IC warehouse on-hand units → INR (1 unit = 1 lakh). */
export function icStockInrFromUnits(units: number): number {
  const u = Number(units) || 0;
  return u * INR_PER_UNIT;
}

/** Stock + metal on hand, then IC & metal P&L for the active date range. */
export function buildICTransferInventoryKpiMetrics(opts: {
  currentStock: number;
  currentMetalG: number;
  cashGrossProfitAed: number;
  metalProfitAed: number;
  metalProfitInr: number;
  rangeLabel: string;
  metalHint?: string;
}): AsicKpiMetric[] {
  const units = Number(opts.currentStock) || 0;
  const stockInr = icStockInrFromUnits(units);
  return [
    {
      label: 'IC stock (INR)',
      value: ledgerInrNode(stockInr),
      valueTitle: fmtLedgerInr(stockInr),
      hint:
        Math.abs(units) >= 0.0001
          ? `${fmtUnits(units)} units · 1 unit = ₹1 lakh`
          : 'On hand',
    },
    {
      label: 'Metal on hand',
      value: formatMetalGrams(opts.currentMetalG),
      hint: opts.metalHint ?? 'Available gold',
      tone: 'amber',
    },
    {
      label: 'IC P&L',
      value: ledgerAedNode(opts.cashGrossProfitAed),
      valueTitle: fmtLedgerAed(opts.cashGrossProfitAed),
      hint: opts.rangeLabel,
      tone: plTone(opts.cashGrossProfitAed),
    },
    {
      label: 'Metal P&L',
      ...formatMetalPlKpi({
        metalProfitAed: opts.metalProfitAed,
        metalProfitInr: opts.metalProfitInr,
        rangeLabel: opts.rangeLabel,
      }),
    },
  ];
}

/** Dashboard / compact strip: metal on hand then P&L (no unit stock tile). */
export function buildICTransferMetalOnHandPlMetrics(opts: {
  currentMetalG: number;
  cashGrossProfitAed: number;
  metalProfitAed: number;
  metalProfitInr: number;
  rangeLabel: string;
  metalHint?: string;
}): AsicKpiMetric[] {
  return [
    {
      label: 'Metal on hand',
      value: formatMetalGrams(opts.currentMetalG),
      hint: opts.metalHint ?? 'Across scoped warehouses',
      tone: 'amber',
    },
    {
      label: 'IC P&L',
      value: ledgerAedNode(opts.cashGrossProfitAed),
      valueTitle: fmtLedgerAed(opts.cashGrossProfitAed),
      hint: opts.rangeLabel,
      tone: plTone(opts.cashGrossProfitAed),
    },
    {
      label: 'Metal P&L',
      ...formatMetalPlKpi({
        metalProfitAed: opts.metalProfitAed,
        metalProfitInr: opts.metalProfitInr,
        rangeLabel: opts.rangeLabel,
      }),
    },
  ];
}
