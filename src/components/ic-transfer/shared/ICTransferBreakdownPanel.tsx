'use client';

import React from 'react';
import { SmoothModeSwap } from '@/components/ui/SmoothHeight';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icFormSectionEyebrow, icPurchaseDenseLabel, icPurchaseDenseInput } from './icTransferFormModalLayout';
import { asicInput } from '@/components/asic/ui';

export type ICTransferBreakdownItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  deduct?: boolean;
  strong?: boolean;
};

const remarksInput = `${asicInput} ${icPurchaseDenseInput} !min-h-9 max-h-9 resize-none py-1 text-sm leading-snug`;
const fieldLabel = `${icPurchaseDenseLabel} mb-1`;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionEyebrow}>{children}</h3>;
}

type Props = {
  heading: string;
  ledger?: React.ReactNode;
  items: ICTransferBreakdownItem[];
  metalG: number;
  inrAmount: number;
  aedAmount: number;
  swapKey: string;
  context?: React.ReactNode;
  remarksLabel?: string;
  remarks?: string;
  onRemarksChange?: (value: string) => void;
  remarksDisabled?: boolean;
  remarksPlaceholder?: string;
  remarksId?: string;
  footer?: React.ReactNode;
};

export default function ICTransferBreakdownPanel({
  heading,
  ledger,
  items,
  metalG,
  inrAmount,
  aedAmount,
  swapKey,
  context,
  remarksLabel,
  remarks,
  onRemarksChange,
  remarksDisabled,
  remarksPlaceholder,
  remarksId,
  footer,
}: Props) {
  return (
    <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:border-l lg:border-slate-200 lg:pl-4">
      {ledger}
      <SectionEyebrow>{heading}</SectionEyebrow>
      <SmoothModeSwap mode={swapKey} className="min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-200 bg-slate-50/50">
          <ul className="flex-1 space-y-0 divide-y divide-slate-200/80 px-3 py-1">
            {items.map(item => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-3 py-2 text-xs first:pt-2 last:pb-2"
              >
                <span className="text-slate-500">{item.label}</span>
                <span
                  className={`text-right font-mono text-xs tabular-nums ${
                    item.deduct
                      ? 'font-semibold text-red-600'
                      : item.strong
                        ? 'font-bold text-slate-900'
                        : 'font-semibold text-slate-800'
                  }`}
                >
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
          {context ? (
            <div className="border-t border-slate-200/80 px-3 py-2 text-[11px] leading-snug text-slate-500">
              {context}
            </div>
          ) : null}
          <div className="space-y-2 border-t border-slate-200 bg-white px-3 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Metal</span>
              <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                {formatAmount(metalG, 4)} g
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amount (INR)
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                <FmtLedgerInr amount={inrAmount} />
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Amount (AED)
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                <FmtLedgerAed amount={aedAmount} />
              </span>
            </div>
          </div>
        </div>
      </SmoothModeSwap>
      {onRemarksChange && remarksId ? (
        <div className="shrink-0">
          <label className={fieldLabel} htmlFor={remarksId}>
            {remarksLabel ?? 'Notes'}
          </label>
          <textarea
            id={remarksId}
            className={`${remarksInput} mt-1 w-full`}
            rows={1}
            value={remarks ?? ''}
            onChange={e => onRemarksChange(e.target.value)}
            placeholder={remarksPlaceholder}
            disabled={remarksDisabled}
          />
        </div>
      ) : null}
      {footer}
    </aside>
  );
}
