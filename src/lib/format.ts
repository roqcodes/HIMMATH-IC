import React from 'react';
import CurrencyAmount from '@/components/currency/CurrencyAmount';
import type { CurrencyCode } from '@/lib/currency';

export type Currency = CurrencyCode;
let globalCurrency: Currency = 'AED';

export function getGlobalCurrency(): Currency {
  return globalCurrency;
}

export function setGlobalCurrency(c: Currency) {
  globalCurrency = c === 'AED' ? 'AED' : 'AED';
}

function formatNumber(amount: number, fractionDigits: Intl.NumberFormatOptions, showPlus: boolean): string {
  const absAmount = Math.abs(amount);
  const numStr = absAmount.toLocaleString('en-US', fractionDigits);
  const sign = amount < 0 ? '-' : showPlus && amount > 0 ? '+' : '';
  return `${sign}${numStr}`;
}

export function formatAED(amount: number, showPlus = false): React.ReactNode {
  return React.createElement(CurrencyAmount, { currency: 'AED', amount, showPlus });
}

export function formatAEDStr(amount: number, showPlus = false): string {
  return formatNumber(amount, { maximumFractionDigits: 2, minimumFractionDigits: 0 }, showPlus);
}

export function formatMoneyValue(amount: number, _currency?: Currency, showPlus = false): string {
  return formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, showPlus);
}

export function formatMoneyLabel(amount: number, currency?: Currency, showPlus = false): string {
  const curr = currency ?? getGlobalCurrency();
  return `${formatMoneyValue(amount, curr, showPlus)} ${curr}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateId(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase()}`;
}
