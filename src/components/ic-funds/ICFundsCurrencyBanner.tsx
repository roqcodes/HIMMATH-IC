'use client';

import React from 'react';
import { IC_FUNDS_BASE_CURRENCY } from '@/lib/icFunds/currencyPolicy';

type Variant = 'ledger' | 'fx' | 'pl';

const COPY: Record<Variant, { title: string; body: string }> = {
  ledger: {
    title: `Ledger currency: ${IC_FUNDS_BASE_CURRENCY}`,
    body: `All payments, receipts, journal entries, and account balances in IC Funds are in ${IC_FUNDS_BASE_CURRENCY} (company base). Foreign currency (e.g. SAR) lives in the wallet & FX layer until settled.`,
  },
  pl: {
    title: `Reporting currency: ${IC_FUNDS_BASE_CURRENCY}`,
    body: `Profit & loss, balance sheet, and trial balance totals are in ${IC_FUNDS_BASE_CURRENCY}. FX Type 2 profit is converted to ${IC_FUNDS_BASE_CURRENCY} at settlement.`,
  },
  fx: {
    title: 'Two layers: foreign wallet + AED ledger',
    body: `Customers owe foreign currency (SAR, etc.) on open sales. Agents hold that foreign balance in the wallet. When admin approves remittance, amounts convert to ${IC_FUNDS_BASE_CURRENCY} and post to IC Funds. Never add different foreign currencies together.`,
  },
};

export default function ICFundsCurrencyBanner({
  variant = 'ledger',
  className = '',
}: {
  variant?: Variant;
  className?: string;
}) {
  const { title, body } = COPY[variant];
  return (
    <div
      className={`rounded-lg border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-xs text-sky-950 ${className}`}
      role="note"
    >
      <p className="font-semibold text-sky-900">{title}</p>
      <p className="mt-0.5 leading-relaxed text-sky-800/90">{body}</p>
    </div>
  );
}
