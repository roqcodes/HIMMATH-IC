import type { ICBranchDeposit } from '@/types';

export type BranchDepositKpis = {
  depositCount: number;
  totalAed: number;
  cashCount: number;
  cashAed: number;
  metalCount: number;
  metalAed: number;
  metalWeightG: number;
};

export const EMPTY_BRANCH_DEPOSIT_KPIS: BranchDepositKpis = {
  depositCount: 0,
  totalAed: 0,
  cashCount: 0,
  cashAed: 0,
  metalCount: 0,
  metalAed: 0,
  metalWeightG: 0,
};

export type PortfolioBranchKpis = BranchDepositKpis & {
  branchCount: number;
  activeBranchCount: number;
  totalTillAed: number;
};

export function sumBranchDepositKpis(rows: BranchDepositKpis[]): BranchDepositKpis {
  const out = { ...EMPTY_BRANCH_DEPOSIT_KPIS };
  for (const r of rows) {
    out.depositCount += r.depositCount;
    out.totalAed += r.totalAed;
    out.cashCount += r.cashCount;
    out.cashAed += r.cashAed;
    out.metalCount += r.metalCount;
    out.metalAed += r.metalAed;
    out.metalWeightG += r.metalWeightG;
  }
  return out;
}

export function computePortfolioBranchKpis(
  branches: { cashBalance?: number; status?: 'active' | 'inactive' }[],
  periodByBranch: BranchDepositKpis[],
): PortfolioBranchKpis {
  const deposits = sumBranchDepositKpis(periodByBranch);
  let totalTillAed = 0;
  let activeBranchCount = 0;
  for (const b of branches) {
    totalTillAed += Number(b.cashBalance) || 0;
    if (b.status !== 'inactive') activeBranchCount += 1;
  }
  return {
    ...deposits,
    branchCount: branches.length,
    activeBranchCount,
    totalTillAed,
  };
}

export function computeBranchDepositKpis(deposits: ICBranchDeposit[]): BranchDepositKpis {
  let totalAed = 0;
  let cashCount = 0;
  let cashAed = 0;
  let metalCount = 0;
  let metalAed = 0;
  let metalWeightG = 0;

  for (const d of deposits) {
    const aed = Number(d.amountAed) || 0;
    totalAed += aed;
    if (d.settlementMode === 'metal') {
      metalCount += 1;
      metalAed += aed;
      metalWeightG += Number(d.metalWeightG) || 0;
    } else {
      cashCount += 1;
      cashAed += aed;
    }
  }

  return {
    depositCount: deposits.length,
    totalAed,
    cashCount,
    cashAed,
    metalCount,
    metalAed,
    metalWeightG,
  };
}
