'use client';

import React from 'react';
import {
  asicTable,
  asicTableWrap,
  asicTd,
  asicTh,
  asicTheadRow,
  asicTr,
} from '@/components/asic/ui';
import type { CustomerWalletAgentRow } from '@/app/actions/icWalletActions';
import { formatFxAmount } from '@/lib/icTransfer/saleFxProfit';

type Props = {
  agents: CustomerWalletAgentRow[];
  currency: string;
  loading?: boolean;
};

export default function WalletAgentsPanel({ agents, currency, loading }: Props) {
  return (
    <div className="flex min-h-[200px] flex-col">
      <div className="border-b border-slate-200 px-3 py-2">
        <p className="text-[11px] text-slate-500">
          Agents assigned to receive your wallet payments. Balance on agent is approved funds not yet
          FX-settled by admin.
        </p>
      </div>
      <div className={asicTableWrap}>
        <table className={asicTable}>
          <thead>
            <tr className={asicTheadRow}>
              <th className={asicTh}>Agent</th>
              <th className={asicTh}>Currency</th>
              <th className={asicTh}>Role</th>
              <th className={`${asicTh} text-right`}>Balance on agent</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                  Loading agents…
                </td>
              </tr>
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                  No collection agents assigned yet. Contact admin to assign agents before paying.
                </td>
              </tr>
            ) : (
              agents.map(agent => (
                <tr key={agent.collectionAccountId} className={asicTr}>
                  <td className={`${asicTd} font-medium`}>{agent.name}</td>
                  <td className={asicTd}>{agent.currency}</td>
                  <td className={asicTd}>
                    {agent.isPrimary ? (
                      <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                        Primary
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Secondary</span>
                    )}
                  </td>
                  <td className={`${asicTd} text-right tabular-nums`}>
                    {formatFxAmount(agent.balanceOnAgent)} {agent.currency || currency}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
