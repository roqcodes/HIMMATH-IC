'use client';

import React from 'react';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';

export function ModalDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-0.5 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

/** Uppercase micro-label for amount calculation tiles inside bordered panels. */
export function ModalCalcLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{children}</p>
  );
}

export const modalCalcPanelClass =
  'rounded-lg border border-slate-100 bg-slate-50/55 p-4';

export const modalCounterpartyPanelClass =
  'rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-4';

export function formatModalDateTime(iso?: string) {
  if (!iso) return { date: '—', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '' };
  return {
    date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function ModalRecordedOnValue({ iso }: { iso?: string }) {
  const { date, time } = formatModalDateTime(iso);
  if (!time) return <>{date}</>;
  return (
    <span>
      {date}
      <span className="mt-0.5 block text-xs font-medium text-slate-500">{time}</span>
    </span>
  );
}

export function formatModalAedTotal(value: number) {
  return `${formatAmount(value)} AED`;
}

export function formatModalInrTotal(value: number) {
  return `${formatAmount(value)} INR`;
}
