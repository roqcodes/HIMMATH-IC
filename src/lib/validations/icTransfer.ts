import { z } from 'zod';
import { IC_SALE_TRANSACTION_TYPES, LEGACY_IC_SALE_TRANSACTION_TYPES } from '@/lib/icTransfer/transactionTypes';
import { PASSWORD_INVALID_MESSAGE, validatePassword } from '@/lib/passwordValidation';

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
  phone: z.string().optional().nullable(),
  commission: z.number().optional().nullable(),
  regionId: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  branchId: z.string().optional().nullable(),
});

export const updateSupplierSchema = addSupplierSchema.extend({
  id: z.string().min(1),
});

export const addWarehouseSchema = z.object({
  name: nameSchema,
  phone: z.string().optional().nullable(),
  commission: z.number().optional().nullable(),
  regionId: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  sendDeliveryProofToCustomer: z.boolean().optional().default(true),
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

export const addPurchaseSchema = z.object({
  supplierId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  unitRate: z.number().positive(),
  units: z.number().positive(),
  paymentMethod: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  aedTotal: z.number().optional().nullable(),
});

export const updatePurchaseSchema = addPurchaseSchema.partial();

export const addSaleSchema = z.object({
  customerName: nameSchema,
  orderCustomerName: z.string().optional().nullable(),
  orderCustomerId: z.string().optional().nullable(),
  subCustomerId: z.string().optional().nullable(),
  subCustomerName: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  transactionType: icSaleTransactionTypeSchema.optional().nullable(),
  units: z.number().positive(),
  unitRate: z.number().positive(),
  aedAmount: z.number().optional().nullable(),
  bank: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  serviceCharge: z.number().default(0.0),
  priority: z.enum(['High', 'Normal', 'Low']).default('Normal'),
  fulfillmentHandler: z.enum(['hq_admin', 'branch']).optional().default('hq_admin'),
  deliveryAgentId: z.string().optional().nullable(),
  deliveryImageUrl: z.string().optional().nullable(),
  orderStatus: z.string().optional(),
  paymentStatus: z.string().optional(),
  rejectionRemarks: z.string().optional().nullable(),
});

export const updateSaleSchema = addSaleSchema.partial();

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
