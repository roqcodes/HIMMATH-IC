import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { computeMetalAedFromInr } from '@/lib/icTransfer/metalSettlement';

export type BreakdownCommonRow = {
  id: string;
  label: string;
  display: string;
};

export type BreakdownMoneyRow = {
  id: string;
  label: string;
  inr: number | null;
  aed: number | null;
  deduct?: boolean;
};

export type ICTransferBreakdownModel = {
  common: BreakdownCommonRow[];
  money: BreakdownMoneyRow[];
  showAedColumn: boolean;
  metalG: number;
  totalInr: number;
  totalAed: number;
  paidInr: number | null;
  paidAed: number | null;
};

export function buildCashBreakdownModel(input: {
  unitNum: number;
  rateNum: number;
  inrTotal: number;
  aedTotal: number;
  transactionTypeLabel?: string;
}): ICTransferBreakdownModel {
  const common: BreakdownCommonRow[] = [
    { id: 'units', label: 'Units', display: formatAmount(input.unitNum, 4) },
    { id: 'rate', label: 'Unit rate (AED)', display: formatAmount(input.rateNum) },
  ];
  if (input.transactionTypeLabel) {
    common.push({
      id: 'txn',
      label: 'Transaction',
      display: input.transactionTypeLabel.replace(/_/g, ' '),
    });
  }
  return {
    common,
    money: [],
    showAedColumn: true,
    metalG: 0,
    totalInr: input.inrTotal,
    totalAed: input.aedTotal,
    paidInr: null,
    paidAed: null,
  };
}

export function buildMetalBreakdownModel(input: {
  metalWeightG: number;
  metalRateInrPerG: number;
  metalInrTotal: number;
  labTotalInr: number;
  metalNetInr: number;
  metalAedTotal: number;
  sheetRateAed: number;
  showAedColumn: boolean;
  splitInrPaid: number | null;
  splitAedPaid: number | null;
}): ICTransferBreakdownModel {
  const common: BreakdownCommonRow[] = [
    {
      id: 'w',
      label: 'Weight',
      display: `${formatAmount(input.metalWeightG, 4)} g`,
    },
    {
      id: 'gr',
      label: 'G rate (INR/g)',
      display: formatAmount(input.metalRateInrPerG),
    },
  ];

  if (input.showAedColumn && input.sheetRateAed > 0) {
    common.push({
      id: 'sheet',
      label: 'Sheet rate (AED)',
      display: formatAmount(input.sheetRateAed),
    });
  }

  const aedMetal =
    input.showAedColumn && input.sheetRateAed > 0
      ? computeMetalAedFromInr(input.metalInrTotal, input.sheetRateAed)
      : null;
  const aedLab =
    input.labTotalInr > 0 && input.showAedColumn && input.sheetRateAed > 0
      ? computeMetalAedFromInr(input.labTotalInr, input.sheetRateAed)
      : null;

  const money: BreakdownMoneyRow[] = [
    {
      id: 'metal',
      label: 'Metal',
      inr: input.metalInrTotal,
      aed: aedMetal,
    },
  ];

  if (input.labTotalInr > 0) {
    money.push({
      id: 'lab',
      label: 'Lab test',
      inr: input.labTotalInr,
      aed: aedLab,
      deduct: true,
    });
  }

  return {
    common,
    money,
    showAedColumn: input.showAedColumn,
    metalG: input.metalWeightG,
    totalInr: input.metalNetInr,
    totalAed: input.showAedColumn ? input.metalAedTotal : 0,
    paidInr: input.splitInrPaid,
    paidAed: input.splitAedPaid,
  };
}
