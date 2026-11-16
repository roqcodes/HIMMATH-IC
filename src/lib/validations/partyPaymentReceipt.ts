import { z } from 'zod';
import { positiveFormAmountSchema } from '@/lib/parseFormAmount';

export const postPartyPaymentReceiptSchema = z
  .object({
    voucherType: z.enum(['payment', 'receipt']),
    voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    amount: positiveFormAmountSchema,
    notes: z.string().max(2000).optional().default(''),
    managerId: z.string().uuid('Manager is required'),
    aedAgentId: z.string().uuid().optional().nullable(),
    customerId: z.string().uuid('Customer is required'),
    book: z.enum(['AED', 'INR']),
    icBranchId: z.string().uuid().optional(),
    warehouseId: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.book === 'AED' && !data.icBranchId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Branch is required for AED payments', path: ['icBranchId'] });
    }
    if (data.book === 'INR' && !data.warehouseId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Warehouse is required for INR payments', path: ['warehouseId'] });
    }
  });
