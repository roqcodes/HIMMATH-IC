'use client';

import React from 'react';
import { asicBtnPrimary, asicCard, asicTable, asicTableWrap, asicTd, asicTh, asicTheadRow, asicTr } from '@/components/asic/ui';
import CustomerProfileLink from '@/components/customers/CustomerProfileLink';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { HQ_IC_FUNDS_BRANCH_SLUG } from '@/lib/icFunds/hqBranch';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { formatFxAmount, roundFxCalc } from '@/lib/icTransfer/saleFxProfit';
import type { Branch } from '@/types';
import type { AgentGroupSale } from './BatchFxSettlementModal';

export type FxAgentGroup = {
  collectionAccountId: string;
  collectionAccountName: string;
  currency: string;
  agentBalance: number;
  sales: AgentGroupSale[];
  closing: {
    totalSarOwed: number;
    totalSarRemaining: number;
    avgSaleRateAed: number;
    avgSaleConversionRate: number;
    totalAed: number;
  } | null;
};

type Props = {
  groups: FxAgentGroup[];
  loading?: boolean;
  branches: Branch[];
  accountsSlug?: string;
  onSettle: (group: FxAgentGroup) => void;
};

function getAgentHeldSummary(group: FxAgentGroup) {
  if (group.closing) {
    return {
      totalHeld: group.closing.totalSarRemaining,
      avgFxRate: group.closing.avgSaleConversionRate,
    };
  }
  const totalHeld = group.sales.reduce((sum, sale) => sum + sale.foreignRemaining, 0);
  const totalAed = group.sales.reduce(
    (sum, sale) =>
      sum + (sale.conversionRate > 0 ? sale.foreignRemaining / sale.conversionRate : 0),
    0,
  );
  return {
    totalHeld: roundFxCalc(totalHeld),
    avgFxRate: totalAed > 0 ? roundFxCalc(totalHeld / totalAed) : 0,
  };
}

export default function FxAgentBalancesPanel({
  groups,
  loading,
  branches,
  accountsSlug = HQ_IC_FUNDS_BRANCH_SLUG,
  onSettle,
}: Props) {
  if (loading) {
    return (
      <div className={`${asicCard} px-4 py-10 text-center text-sm text-slate-500`}>
        Loading agent balances…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={`${asicCard} px-4 py-10 text-center`}>
        <p className="text-sm font-medium text-slate-800">No unsettled agent balances</p>
        <p className="mt-1 text-xs text-slate-500">
          Customer wallet payments appear here after admin approval. Assign agents and record payments from
          the customer profile first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(group => {
        const currency = group.currency || group.sales[0]?.currency || '';
        const { totalHeld, avgFxRate } = getAgentHeldSummary(group);
        return (
          <section key={group.collectionAccountId} className={asicCard}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  <ICFundAccountLink
                    slug={accountsSlug}
                    accountId={group.collectionAccountId}
                    name={group.collectionAccountName}
                  />
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {currency} collection agent · {group.sales.length} open line
                  {group.sales.length === 1 ? '' : 's'}
                </p>
              </div>
              {group.sales.length > 0 ? (
                <button type="button" className={asicBtnPrimary} onClick={() => onSettle(group)}>
                  Settle to AED
                </button>
              ) : null}
            </div>
            <div className={asicTableWrap}>
              <table className={asicTable}>
                <thead>
                  <tr className={asicTheadRow}>
                    <th className={asicTh}>Sale</th>
                    <th className={asicTh}>Customer</th>
                    <th className={`${asicTh} text-right`}>Held</th>
                    <th className={`${asicTh} text-right`}>Sale FX</th>
                  </tr>
                </thead>
                <tbody>
                  {group.sales.map(sale => (
                    <tr key={sale.id} className={asicTr}>
                      <td className={`${asicTd} font-mono text-xs`}>
                        {getFormattedTxnId(sale.id, 'sale', null, branches)}
                      </td>
                      <td className={asicTd}>
                        <CustomerProfileLink
                          branchSlug={sale.customerBranchSlug}
                          customerId={sale.orderCustomerId}
                          name={sale.customerName}
                        />
                      </td>
                      <td className={`${asicTd} text-right tabular-nums font-medium text-amber-700`}>
                        {formatFxAmount(sale.foreignRemaining)} {currency}
                      </td>
                      <td className={`${asicTd} text-right tabular-nums`}>
                        {formatFxAmount(sale.conversionRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {group.sales.length > 0 ? (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-100/90">
                      <td colSpan={2} className="px-2.5 py-3 text-xs font-bold uppercase tracking-wide text-slate-700">
                        Totals
                      </td>
                      <td className="px-2.5 py-3 text-right text-sm font-bold tabular-nums text-amber-800">
                        {formatFxAmount(totalHeld)} {currency}
                      </td>
                      <td className="px-2.5 py-3 text-right text-sm font-bold tabular-nums text-slate-900">
                        {avgFxRate > 0 ? formatFxAmount(avgFxRate) : '—'}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
