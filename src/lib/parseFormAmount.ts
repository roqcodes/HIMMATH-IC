import { z } from 'zod';

/** Parse user-entered amount strings without producing NaN for Zod. */
export function parseFormAmount(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseFormAmountOrZero(value: unknown): number {
  return parseFormAmount(value) ?? 0;
}

const amountInputSchema = z.union([z.number(), z.string()]);

export const finiteFormAmountSchema = amountInputSchema
  .superRefine((val, ctx) => {
    if (parseFormAmount(val) === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount' });
    }
  })
  .transform(val => parseFormAmount(val)!);

export const positiveFormAmountSchema = amountInputSchema
  .superRefine((val, ctx) => {
    const n = parseFormAmount(val);
    if (n === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount' });
      return;
    }
    if (n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Amount must be greater than zero' });
    }
  })
  .transform(val => parseFormAmount(val)!);

export const nonNegativeFormAmountSchema = amountInputSchema
  .superRefine((val, ctx) => {
    const n = parseFormAmount(val);
    if (n === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter a valid amount' });
      return;
    }
    if (n < 0) {
      ctx.addIssue({ code: 'custom', message: 'Amount cannot be negative' });
    }
  })
  .transform(val => parseFormAmount(val)!);
