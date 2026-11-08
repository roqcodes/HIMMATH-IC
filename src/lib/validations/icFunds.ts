import { z } from 'zod';
import { IC_FUND_ACCOUNT_TYPES, IC_FUND_VOUCHER_TYPES } from '@/lib/icFunds/constants';
import { validatePassword } from '@/lib/passwordValidation';
import { finiteFormAmountSchema, positiveFormAmountSchema } from '@/lib/parseFormAmount';

const nonEmpty = z.string().trim().min(1, 'This field is required');

export const createICFundAccountSchema = z
  .object({
    branchId: nonEmpty,
    name: nonEmpty.max(255),
    accountType: z.enum(IC_FUND_ACCOUNT_TYPES),
    openingBalance: finiteFormAmountSchema,
    notes: z.string().max(2000).optional().default(''),
    requireSignIn: z.boolean().optional().default(false),
    email: z.string().trim().optional(),
    password: z.string().optional(),
    phone: z.string().max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.requireSignIn) return;
    if (!data.email) {
      ctx.addIssue({ code: 'custom', message: 'Email is required when sign-in is enabled', path: ['email'] });
    }
    if (!data.password || !validatePassword(data.password).isValid) {
      ctx.addIssue({ code: 'custom', message: 'A valid password is required when sign-in is enabled', path: ['password'] });
    }
  });

export const updateICFundAccountSchema = z
  .object({
    branchId: nonEmpty,
    id: nonEmpty,
    name: nonEmpty.max(255).optional(),
    accountType: z.enum(IC_FUND_ACCOUNT_TYPES).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    openingBalance: finiteFormAmountSchema.optional(),
    notes: z.string().max(2000).optional(),
    phone: z.string().max(50).optional(),
    requireSignIn: z.boolean().optional(),
    email: z.string().trim().optional(),
    password: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.requireSignIn) return;
    if (!data.email) {
      ctx.addIssue({ code: 'custom', message: 'Email is required when sign-in is enabled', path: ['email'] });
    }
    if (!data.password || !validatePassword(data.password).isValid) {
      ctx.addIssue({
        code: 'custom',
        message: 'A valid password is required when sign-in is enabled',
        path: ['password'],
      });
    }
  });

export const postICFundVoucherSchema = z.object({
  branchId: nonEmpty,
  voucherType: z.enum(IC_FUND_VOUCHER_TYPES),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  debitAccountId: nonEmpty,
  creditAccountId: nonEmpty,
  amount: positiveFormAmountSchema,
  notes: z.string().max(2000).optional().default(''),
  book: z.enum(['AED', 'INR']).optional().default('AED'),
});

export const icFundsDateRangeSchema = z.object({
  branchId: nonEmpty,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const icSettlementTradeReportSchema = icFundsDateRangeSchema.extend({
  settlementMode: z.enum(['cash', 'metal']),
  includeVoidOrders: z.boolean().optional().default(false),
});
