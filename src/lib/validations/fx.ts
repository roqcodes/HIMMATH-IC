import { z } from 'zod';
import { positiveFormAmountSchema } from '@/lib/parseFormAmount';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date');

export const currencyExchangeSchema = z.object({
  direction: z.enum(['aed_to_inr', 'inr_to_aed']),
  sourceAmount: positiveFormAmountSchema,
  inrPerAed: positiveFormAmountSchema,
  aedBankAccountId: z.string().trim().min(1, 'Select an AED bank'),
  inrBankAccountId: z.string().trim().min(1, 'Select an INR bank'),
  voucherDate: isoDate,
  notes: z.string().max(2000).optional().default(''),
});
