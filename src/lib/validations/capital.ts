import { z } from 'zod';
import { positiveFormAmountSchema, finiteFormAmountSchema } from '@/lib/parseFormAmount';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const createCapitalInvestorSchema = z.object({
  name: z.string().trim().min(1).max(255),
  notes: z.string().max(2000).optional().default(''),
});

export const setCapitalOpeningSchema = z.object({
  openingAed: finiteFormAmountSchema,
  openingInr: finiteFormAmountSchema,
  openingInrPerAed: positiveFormAmountSchema,
  aedBankAccountId: z.string().trim().min(1).optional(),
  inrBankAccountId: z.string().trim().min(1).optional(),
  voucherDate: isoDate,
});

export const setManagementShareSchema = z.object({
  managementSharePct: z.number().min(0).max(100),
  managementInvestorId: z.string().trim().optional().nullable(),
});

export const capitalMovementSchema = z.object({
  investorId: z.string().trim().min(1),
  movementType: z.enum(['deposit', 'withdraw', 'payout']),
  book: z.enum(['AED', 'INR']),
  amount: positiveFormAmountSchema,
  inrPerAed: positiveFormAmountSchema.optional(),
  bankAccountId: z.string().trim().min(1),
  lotDate: isoDate,
  notes: z.string().max(2000).optional().default(''),
});
