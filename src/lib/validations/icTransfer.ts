import { z } from 'zod';
import { IC_SALE_TRANSACTION_TYPES, LEGACY_IC_SALE_TRANSACTION_TYPES } from '@/lib/icTransfer/transactionTypes';
import { PASSWORD_INVALID_MESSAGE, validatePassword } from '@/lib/passwordValidation';
import { entityCodeSchema } from '@/lib/validations/entityCode';

const passwordSchema = z.string().refine((val) => validatePassword(val).isValid, {
  message: PASSWORD_INVALID_MESSAGE,
});

const icSaleTransactionTypeSchema = z.enum([
  ...IC_SALE_TRANSACTION_TYPES,
  ...LEGACY_IC_SALE_TRANSACTION_TYPES,
]);

const idSchema = z.string().uuid('Invalid UUID format');
const nameSchema = z.string().min(1, 'Name is required');
const countrySchema = z.string().min(1, 'Country is required');
const currencySchema = z.string().min(1, 'Currency is required');

export const addRegionSchema = z.object({
  name: nameSchema,
  country: countrySchema,
});

export const updateRegionSchema = z.object({
  id: z.string().min(1),
  name: nameSchema,
  country: countrySchema,
});

export const addSupplierSchema = z.object({
  name: nameSchema,
  code: entityCodeSchema,
  phone: z.string().optional().nullable(),
  commission: z.number().optional().nullable(),
  regionId: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  country: z.string().optional().nullable().or(z.literal('')),
  subdivision: z.string().optional().nullable().or(z.literal('')),
  locality: z.string().optional().nullable().or(z.literal('')),
  branchId: z.string().optional().nullable(),
  kind: z.enum(['manager', 'customer', 'agent']).optional().default('customer'),
  homeManagerId: z.string().uuid().optional().nullable(),
  roles: z.array(z.enum(['supplier', 'party', 'agent'])).optional(),
}).superRefine((data, ctx) => {
  const kind = data.kind ?? 'customer';
  if (kind === 'manager' || kind === 'agent') return;
  const roles = data.roles ?? [];
  if (roles.length < 1) {
    ctx.addIssue({ code: 'custom', message: 'Pick at least one customer role', path: ['roles'] });
  }
});

export const updateSupplierSchema = addSupplierSchema.extend({
  id: z.string().min(1),
});

export const addWarehouseSchema = z.object({
  name: nameSchema,
  code: entityCodeSchema,
  phone: z.string().optional().nullable(),
  commission: z.number().optional().nullable(),
  regionId: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  indiaState: z.string().optional().nullable().or(z.literal('')),
  indiaCity: z.string().optional().nullable().or(z.literal('')),
  sendDeliveryProofToCustomer: z.boolean().optional().default(true),
  deskKind: z.enum(['warehouse', 'branch']).optional().default('warehouse'),
  branchId: z.string().optional().nullable(),
});

export const updateWarehouseSchema = addWarehouseSchema.extend({
  id: z.string().min(1),
});

export const addRateGroupSchema = z.object({
  name: nameSchema,
  country: countrySchema,
  saleRate: z.number().nonnegative().optional().default(0),
  /** Legacy callers — ignored after HQ AED-only refactor. */
  currency: z.string().optional(),
  conversionRate: z.number().optional(),
  createdByBranchId: z.string().min(1).optional(),
});

export const updateRateGroupSchema = addRateGroupSchema.extend({
  id: z.string().min(1),
});

export const bulkUpdateRateGroupRatesSchema = z.object({
  groupIds: z.array(z.string().min(1)),
  saleRate: z.number().nonnegative(),
  conversionRate: z.number().positive(),
});

const rateSlabTierSchema = z.object({
  minUnits: z.number().nonnegative(),
  maxUnits: z
    .number()
    .nonnegative()
    .nullish()
    .transform((value): number | null => value ?? null),
  saleRate: z.number().positive(),
  conversionRate: z.number().positive(),
});

const rateTransactionPricingSchema = z.object({
  mode: z.enum(['flat', 'slab']),
  saleRate: z.number().positive().optional(),
  conversionRate: z.number().positive().optional(),
  slabs: z.array(rateSlabTierSchema).optional(),
});

const rateByTransactionTypeSchema = z
  .object({
    sdm: rateTransactionPricingSchema.optional(),
    by_hand: rateTransactionPricingSchema.optional(),
    transfer: rateTransactionPricingSchema.optional(),
    cdm: rateTransactionPricingSchema.optional(),
    nre: rateTransactionPricingSchema.optional(),
  })
  .optional();

export const rateGroupPricingConfigSchema = z.object({
  scope: z.enum(['all_types', 'per_type']),
  kind: z.enum(['flat', 'slab']),
  common: rateTransactionPricingSchema.optional(),
  byTransactionType: rateByTransactionTypeSchema,
});

export const updateRateGroupPricingSchema = z.object({
  groupId: z.string().min(1),
  saleRate: z.number().nonnegative(),
  conversionRate: z.number().positive(),
  pricingConfig: rateGroupPricingConfigSchema.nullable(),
});

export const bulkUpdateRateGroupPricingSchema = z.object({
  groupIds: z.array(z.string().min(1)),
  saleRate: z.number().nonnegative(),
  conversionRate: z.number().positive(),
  pricingConfig: rateGroupPricingConfigSchema.nullable(),
});

export const setRateGroupCustomersSchema = z.object({
  groupId: z.string().min(1),
  customerIds: z.array(z.string().min(1)),
});

export const setRateGroupBranchesSchema = z.object({
  groupId: z.string().min(1),
  branchIds: z.array(z.string().min(1)),
});

export const icSettlementModeSchema = z.enum(['cash', 'metal']);

const purchaseFieldsBaseSchema = z.object({
  counterpartyId: z.string().min(1).optional(),
  managerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().min(1).optional(),
  locationId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  settlementMode: icSettlementModeSchema.optional().default('cash'),
  unitRate: z.number().nonnegative().optional(),
  units: z.number().nonnegative().optional(),
  metalWeightG: z.number().positive().optional(),
  metalRateInrPerG: z.number().positive().optional(),
  metalRateAedPerG: z.number().nonnegative().optional(),
  inrTotal: z.number().positive().optional(),
  metalPaymentMethod: z.enum(['CASH', 'AED', 'INR', 'SPLIT']).optional(),
  aedAgentId: z.string().uuid().optional().nullable(),
  splitInrPaid: z.number().nonnegative().optional().nullable(),
  splitAedPaid: z.number().nonnegative().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  aedTotal: z.number().nonnegative().optional().nullable(),
  labWeightG: z.number().nonnegative().optional().nullable(),
  labChargeInrPerG: z.number().nonnegative().optional().nullable(),
  labTotalInr: z.number().nonnegative().optional().nullable(),
});

const purchaseFieldsSchema = purchaseFieldsBaseSchema.transform(data => ({
  ...data,
  counterpartyId: data.counterpartyId ?? data.supplierId,
}));

export const addPurchaseSchema = purchaseFieldsSchema.superRefine((data, ctx) => {
    if (!data.counterpartyId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Counterparty is required', path: ['counterpartyId'] });
    }
    const mode = data.settlementMode ?? 'cash';
    if (mode === 'cash') {
      if (data.units == null || data.units <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Units required for cash purchase', path: ['units'] });
      }
      if (data.unitRate == null || data.unitRate <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Unit rate required for cash purchase', path: ['unitRate'] });
      }
      return;
    }
    if (data.metalWeightG == null || data.metalWeightG <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Weight required for metal purchase', path: ['metalWeightG'] });
    }
    if (data.metalRateInrPerG == null || data.metalRateInrPerG <= 0) {
      ctx.addIssue({ code: 'custom', message: 'INR rate per gram required', path: ['metalRateInrPerG'] });
    }
    if (data.inrTotal == null || data.inrTotal <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Total INR required', path: ['inrTotal'] });
    }
    const pay = data.metalPaymentMethod === 'AED' || data.metalPaymentMethod === 'SPLIT'
      ? data.metalPaymentMethod
      : 'CASH';
    if (pay === 'AED' || pay === 'SPLIT') {
      if (data.metalRateAedPerG == null || data.metalRateAedPerG <= 0) {
        ctx.addIssue({ code: 'custom', message: 'AED rate required for AED payment', path: ['metalRateAedPerG'] });
      }
      if (data.aedTotal == null || data.aedTotal <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Total AED required', path: ['aedTotal'] });
      }
      if (!data.aedAgentId?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'AED agent required', path: ['aedAgentId'] });
      }
    }
    if (pay === 'SPLIT') {
      if (data.splitInrPaid == null || data.splitInrPaid <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter INR paid with the counterparty for split',
          path: ['splitInrPaid'],
        });
      }
    }
    const labTotal = Number(data.labTotalInr) || 0;
    if (labTotal > 0 && data.inrTotal != null && labTotal - data.inrTotal > 0.01) {
      ctx.addIssue({
        code: 'custom',
        message: 'Lab test total cannot exceed metal INR total',
        path: ['labTotalInr'],
      });
    }
  });

function refineMetalSplitUpdatePurchase(
  data: Partial<z.infer<typeof purchaseFieldsBaseSchema>>,
  ctx: z.RefinementCtx,
) {
  if (data.settlementMode === 'cash') return;
  if (data.metalPaymentMethod !== 'SPLIT') return;
  if (!data.aedAgentId?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'AED agent required', path: ['aedAgentId'] });
  }
  if (data.aedTotal == null || data.aedTotal <= 0) {
    ctx.addIssue({ code: 'custom', message: 'Total AED required', path: ['aedTotal'] });
  }
  if (data.splitInrPaid == null || data.splitInrPaid <= 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter INR paid with the counterparty for split',
      path: ['splitInrPaid'],
    });
  }
}

export const updatePurchaseSchema = purchaseFieldsBaseSchema
  .partial()
  .superRefine((data, ctx) => refineMetalSplitUpdatePurchase(data, ctx));

const saleFieldsSchema = z.object({
  customerName: nameSchema,
  orderCustomerName: z.string().optional().nullable(),
  orderCustomerId: z.string().optional().nullable(),
  counterpartyId: z.string().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  subCustomerId: z.string().optional().nullable(),
  subCustomerName: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  settlementMode: icSettlementModeSchema.optional().default('cash'),
  transactionType: icSaleTransactionTypeSchema.optional().nullable(),
  units: z.number().nonnegative().optional(),
  unitRate: z.number().nonnegative().optional(),
  metalWeightG: z.number().positive().optional(),
  metalRateInrPerG: z.number().positive().optional(),
  metalRateAedPerG: z.number().nonnegative().optional(),
  inrTotal: z.number().positive().optional(),
  metalPurchaseId: z.string().uuid().optional().nullable(),
  metalPaymentMethod: z.enum(['CASH', 'AED', 'INR', 'SPLIT']).optional().nullable(),
  aedAgentId: z.string().uuid().optional().nullable(),
  splitInrPaid: z.number().nonnegative().optional().nullable(),
  splitAedPaid: z.number().nonnegative().optional().nullable(),
  aedAmount: z.number().nonnegative().optional().nullable(),
  bank: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  serviceCharge: z.number().default(0.0),
  priority: z.enum(['High', 'Normal', 'Low']).default('Normal'),
  fulfillmentHandler: z.enum(['hq_admin', 'branch']).optional().default('hq_admin'),
  deliveryAgentId: z.string().optional().nullable(),
  deliveryImageUrl: z.string().optional().nullable(),
  orderStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  rejectionRemarks: z.string().optional().nullable(),
  labWeightG: z.number().nonnegative().optional().nullable(),
  labChargeInrPerG: z.number().nonnegative().optional().nullable(),
  labTotalInr: z.number().nonnegative().optional().nullable(),
});

export const addSaleSchema = saleFieldsSchema.superRefine((data, ctx) => {
    const mode = data.settlementMode ?? 'cash';
    if (mode === 'cash') {
      if (data.units == null || data.units <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Units required for cash sale', path: ['units'] });
      }
      if (data.unitRate == null || data.unitRate <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Unit rate required for cash sale', path: ['unitRate'] });
      }
      return;
    }
    if (!data.metalPurchaseId) {
      ctx.addIssue({ code: 'custom', message: 'Select the metal purchase to sell', path: ['metalPurchaseId'] });
    }
    if (data.metalWeightG == null || data.metalWeightG <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Weight required for metal sale', path: ['metalWeightG'] });
    }
    if (data.metalRateInrPerG == null || data.metalRateInrPerG <= 0) {
      ctx.addIssue({ code: 'custom', message: 'INR rate per gram required', path: ['metalRateInrPerG'] });
    }
    if (data.inrTotal == null || data.inrTotal <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Total INR required', path: ['inrTotal'] });
    }
    if (data.aedAmount == null || data.aedAmount <= 0) {
      ctx.addIssue({ code: 'custom', message: 'AED total required (unit rate × units)', path: ['aedAmount'] });
    }
    if (data.unitRate == null || data.unitRate <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'AED unit rate required (same as IC purchase)',
        path: ['unitRate'],
      });
    }
    const pay =
      data.metalPaymentMethod === 'AED' || data.metalPaymentMethod === 'SPLIT'
        ? data.metalPaymentMethod
        : 'CASH';
    if ((pay === 'AED' || pay === 'SPLIT') && !data.aedAgentId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'AED agent required', path: ['aedAgentId'] });
    }
    if (pay === 'SPLIT') {
      if (data.splitInrPaid == null || data.splitInrPaid <= 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'Enter INR paid with the counterparty for split',
          path: ['splitInrPaid'],
        });
      }
    }
    const labTotal = Number(data.labTotalInr) || 0;
    if (labTotal > 0 && data.inrTotal != null && labTotal - data.inrTotal > 0.01) {
      ctx.addIssue({
        code: 'custom',
        message: 'Lab test total cannot exceed metal INR total',
        path: ['labTotalInr'],
      });
    }
  });

function refineMetalSplitUpdateSale(
  data: Partial<z.infer<typeof saleFieldsSchema>>,
  ctx: z.RefinementCtx,
) {
  if (data.settlementMode === 'cash') return;
  if (data.metalPaymentMethod !== 'SPLIT') return;
  if (!data.aedAgentId?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'AED agent required', path: ['aedAgentId'] });
  }
  if (data.aedAmount == null || data.aedAmount <= 0) {
    ctx.addIssue({ code: 'custom', message: 'AED total required (unit rate × units)', path: ['aedAmount'] });
  }
  if (data.splitInrPaid == null || data.splitInrPaid <= 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter INR paid with the counterparty for split',
      path: ['splitInrPaid'],
    });
  }
}

export const updateSaleSchema = saleFieldsSchema
  .partial()
  .superRefine((data, ctx) => refineMetalSplitUpdateSale(data, ctx));

export const saveSubCustomerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  contact: z.string().trim().optional().nullable(),
});

// Warehouse Schemas
export const createDeliveryAgentSchema = z.object({
  warehouse_id: z.string().min(1),
  name: nameSchema,
  email: z.string().email(),
  password: passwordSchema.optional(),
  phone: z.string().optional().nullable(),
  group_id: z.string().optional().nullable(),
  region_id: z.string().optional().nullable(),
  branchSlug: z.string().optional(),
});

export const updateDeliveryAgentSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: nameSchema,
  phone: z.string().optional().nullable(),
  region_id: z.string().optional().nullable(),
  group_id: z.string().optional().nullable(),
  password: passwordSchema.optional(),
  branchSlug: z.string().min(1),
});

export const deleteDeliveryAgentSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
});

export const createWarehouseGroupSchema = z.object({
  warehouse_id: z.string().min(1),
  name: nameSchema,
  description: z.string().optional().nullable(),
});

export const deleteWarehouseGroupSchema = z.object({
  id: z.string().min(1),
});

export const assignOrderToAgentSchema = z.object({
  orderId: z.string().min(1),
  agentId: z.string().min(1).nullable(),
});

export const completeDeliverySchema = z.object({
  orderId: z.string().min(1),
  collectedUnits: z.number().nonnegative(),
  agentId: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  paymentStatus: z.string().optional(),
  updatedBy: z.string().optional().nullable(),
});

export const fetchWarehouseOrdersSchema = z.object({
  warehouseId: z.string().min(1),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const warehouseActionSchema = z.object({
  orderId: z.string().min(1),
  remarks: z.string().optional(),
  updatedBy: z.string().min(1),
  agentId: z.string().optional(),
});

export const fetchDeliveryAgentOrdersSchema = z.object({
  email: z.string().email(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
