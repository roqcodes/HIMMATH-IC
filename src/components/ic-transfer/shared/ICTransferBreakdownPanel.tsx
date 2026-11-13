'use client';

import React from 'react';
import { SmoothModeSwap } from '@/components/ui/SmoothHeight';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icFormSectionEyebrow } from './icTransferFormModalLayout';
import type { ICTransferBreakdownModel } from '@/lib/icTransfer/breakdownViewModel';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import { complementSplitAed, complementSplitInr } from '@/lib/icTransfer/metalSplit';
import { METAL_AMOUNT_DECIMALS } from '@/lib/icTransfer/metalSettlement';
import { AED_INDICATOR } from '@/components/currency/CurrencyAmount';

const splitPaidFieldShell =
  'flex h-8 w-full min-w-0 items-center gap-1 rounded-lg border border-[var(--theme-border-field)] bg-white px-2 shadow-[inset_0_1px_2px_rgb(15_23_42/0.04)] focus-within:border-[var(--theme-accent)] focus-within:ring-2 focus-within:ring-[var(--theme-focus-ring)] disabled:opacity-50';

const splitPaidInputClass = `h-7 min-h-0 w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-right font-mono text-xs font-semibold tabular-nums text-slate-900 shadow-none outline-none ring-0 placeholder:text-slate-400 focus-visible:border-0 focus-visible:ring-0 sm:text-sm`;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className={icFormSectionEyebrow}>{children}</h3>;
}

function MoneyCell({
  amount,
  deduct,
  currency,
}: {
  amount: number | null;
  deduct?: boolean;
  currency: 'inr' | 'aed';
}) {
  if (amount == null) {
    return <span className="text-slate-300">—</span>;
  }
  const tone = deduct ? 'font-semibold text-red-600' : 'font-semibold text-slate-800';
  return (
    <span className={tone}>
      {deduct ? '− ' : null}
      {currency === 'inr' ? <FmtLedgerInr amount={amount} /> : <FmtLedgerAed amount={amount} />}
    </span>
  );
}

function DualCurrencyAmounts({
  inr,
  aed,
  showAed,
  size = 'sm',
}: {
  inr: number;
  aed: number;
  showAed: boolean;
  size?: 'sm' | 'xs';
}) {
  const amountClass =
    size === 'sm'
      ? 'font-mono text-[11px] font-bold leading-tight tabular-nums sm:text-sm'
      : 'font-mono text-[10px] font-semibold leading-tight tabular-nums sm:text-xs';
  return (
    <div
      className={`grid min-w-0 ${showAed ? 'grid-cols-2 divide-x divide-slate-200' : 'grid-cols-1'}`}
    >
      <div className={`min-w-0 px-1.5 text-right text-slate-900 ${showAed ? 'pr-2' : ''}`}>
        <span className={`${amountClass} inline-flex max-w-full justify-end`}>
          <FmtLedgerInr amount={inr} />
        </span>
      </div>
      {showAed ? (
        <div className="min-w-0 pl-2 pr-0.5 text-right text-slate-900">
          <span className={`${amountClass} inline-flex max-w-full justify-end`}>
            <FmtLedgerAed amount={aed} />
          </span>
        </div>
      ) : null}
    </div>
  );
}

function FooterMoneyCard({
  label,
  labelClassName,
  boxClassName,
  inr,
  aed,
  showAed,
}: {
  label: string;
  labelClassName: string;
  boxClassName: string;
  inr: number;
  aed: number;
  showAed: boolean;
}) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${boxClassName}`}>
      <div className={`text-[9px] font-semibold uppercase tracking-wider ${labelClassName}`}>{label}</div>
      <div className="mt-1">
        <DualCurrencyAmounts inr={inr} aed={aed} showAed={showAed} size="sm" />
      </div>
    </div>
  );
}

export type SplitPaidEditProps = {
  paidInr: number;
  paidAed: number;
  totalInr: number;
  totalAed: number;
  onChange: (next: { paidInr: number; paidAed: number }) => void;
  disabled?: boolean;
};

function FooterSplitPaidCard({
  showAed,
  edit,
}: {
  showAed: boolean;
  edit: SplitPaidEditProps;
}) {
  const { paidInr, paidAed, totalInr, totalAed, onChange, disabled } = edit;
  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50/60 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-amber-900/80">Paid</div>
      <div
        className={`mt-1.5 grid min-w-0 gap-2 ${showAed ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        <div className={`${splitPaidFieldShell} ${disabled ? 'opacity-50' : ''}`}>
          <label className="sr-only" htmlFor="breakdown-paid-inr">
            INR paid
          </label>
          <span
            className="shrink-0 text-[0.72em] font-medium leading-none text-slate-600 opacity-90"
            aria-hidden
          >
            ₹
          </span>
          <FormattedNumberInput
            id="breakdown-paid-inr"
            className={splitPaidInputClass}
            book="inr"
            maxFractionDigits={METAL_AMOUNT_DECIMALS}
            disabled={disabled}
            value={paidInr}
            onNumericChange={n =>
              onChange({
                paidInr: n,
                paidAed: complementSplitAed(n, totalInr, totalAed),
              })
            }
            placeholder="0"
          />
        </div>
        {showAed ? (
          <div className={`${splitPaidFieldShell} ${disabled ? 'opacity-50' : ''}`}>
            <label className="sr-only" htmlFor="breakdown-paid-aed">
              AED paid
            </label>
            <span
              className="shrink-0 text-[0.72em] font-medium leading-none text-slate-600 opacity-90"
              aria-hidden
            >
              {AED_INDICATOR}
            </span>
            <FormattedNumberInput
              id="breakdown-paid-aed"
              className={splitPaidInputClass}
              book="aed"
              maxFractionDigits={METAL_AMOUNT_DECIMALS}
              disabled={disabled}
              value={paidAed}
              onNumericChange={n =>
                onChange({
                  paidAed: n,
                  paidInr: complementSplitInr(n, totalInr, totalAed),
                })
              }
              placeholder="0"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

type Props = {
  heading: string;
  ledger?: React.ReactNode;
  breakdown: ICTransferBreakdownModel;
  swapKey: string;
  context?: React.ReactNode;
  footer?: React.ReactNode;
  /** Split payment: Paid row is the INR/AED inputs (no separate form fields). */
  splitPaidEdit?: SplitPaidEditProps;
};

export default function ICTransferBreakdownPanel({
  heading,
  ledger,
  breakdown,
  swapKey,
  context,
  footer,
  splitPaidEdit,
}: Props) {
  const { common, money, showAedColumn, metalG, totalInr, totalAed, paidInr, paidAed } = breakdown;
  const showPaidReadOnly =
    !splitPaidEdit &&
    paidInr != null &&
    paidAed != null &&
    (paidInr > 0 || paidAed > 0);

  return (
    <aside className="flex min-h-0 flex-col gap-2 lg:col-span-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-slate-200 lg:pl-4 lg:pr-0.5">
      {ledger}
      <SectionEyebrow>{heading}</SectionEyebrow>
      <SmoothModeSwap mode={swapKey} className="min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
          {common.length > 0 ? (
            <ul className="divide-y divide-slate-200/80 px-3 py-0.5">
              {common.map(row => (
                <li
                  key={row.id}
                  className="flex items-baseline justify-between gap-3 py-2 text-xs"
                >
                  <span className="text-slate-500">{row.label}</span>
                  <span className="text-right font-mono text-xs font-semibold tabular-nums text-slate-800">
                    {row.display}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {money.length > 0 ? (
            <div className="border-t border-slate-200/80">
              <div
                className={`grid gap-0 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 ${
                  showAedColumn
                    ? 'grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]'
                    : 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'
                }`}
              >
                <span />
                <span className="border-r border-slate-200/80 pr-2 text-right">INR</span>
                {showAedColumn ? <span className="pl-2 text-right">AED</span> : null}
              </div>
              <ul className="divide-y divide-slate-200/60 border-t border-slate-200/60">
                {money.map(row => (
                  <li
                    key={row.id}
                    className={`grid items-baseline gap-1 px-3 py-2 text-xs ${
                      showAedColumn
                        ? 'grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]'
                        : 'grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]'
                    }`}
                  >
                    <span className="min-w-0 text-slate-500">{row.label}</span>
                    <span className="min-w-0 border-r border-slate-200/80 pr-2 text-right font-mono tabular-nums">
                      <MoneyCell amount={row.inr} deduct={row.deduct} currency="inr" />
                    </span>
                    {showAedColumn ? (
                      <span className="min-w-0 pl-2 text-right font-mono tabular-nums">
                        <MoneyCell amount={row.aed} deduct={row.deduct} currency="aed" />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {context ? (
            <div className="border-t border-slate-200/80 px-3 py-2 text-[11px] leading-snug text-slate-500">
              {context}
            </div>
          ) : null}

          <div className="mt-auto space-y-2 border-t border-slate-200 bg-white px-3 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Net metal
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                {formatAmount(metalG, 4)} g
              </span>
            </div>

            <FooterMoneyCard
              label="Total"
              labelClassName="text-slate-600"
              boxClassName="border-slate-200 bg-slate-50"
              inr={totalInr}
              aed={totalAed}
              showAed={showAedColumn}
            />

            {splitPaidEdit ? (
              <FooterSplitPaidCard showAed={showAedColumn} edit={splitPaidEdit} />
            ) : showPaidReadOnly ? (
              <FooterMoneyCard
                label="Paid"
                labelClassName="text-amber-900/80"
                boxClassName="border-amber-200/80 bg-amber-50/60"
                inr={paidInr!}
                aed={paidAed!}
                showAed={showAedColumn}
              />
            ) : null}
          </div>
        </div>
      </SmoothModeSwap>
      {footer}
    </aside>
  );
}

/** @deprecated Use ICTransferBreakdownModel via breakdown prop */
export type ICTransferBreakdownItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  deduct?: boolean;
  strong?: boolean;
};
