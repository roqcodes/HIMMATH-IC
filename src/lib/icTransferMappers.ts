import {
  ICBranch,
  ICRegion,
  ICSupplier,
  ICWarehouse,
  ICRateGroup,
  ICPurchase,
  ICSale,
  ICSubCustomer,
  ICWarehouseTransaction,
} from '@/types';
import { resolvePurchaseInrDisplay } from '@/lib/icTransfer/metalSettlement';
import { normalizeMetalPaymentMethod } from '@/lib/domain/books';
import { labFieldsFromRecord } from '@/lib/icTransfer/labTest';
import { mapICCounterpartyRow } from '@/lib/counterparties/mapper';
import { parseManagerIdsFromRow } from '@/lib/icTransfer/warehouseQueries';

export function mapICBranchRow(row: Record<string, unknown>): ICBranch {
  return {
    id: String(row.id),
    name: String(row.name),
    code: row.code ? String(row.code) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    email: row.email ? String(row.email) : undefined,
    address: row.address ? String(row.address) : undefined,
    timezone: row.timezone ? String(row.timezone) : undefined,
    cashBalance: row.cash_balance != null ? Number(row.cash_balance) : 0,
    status: row.status === 'inactive' ? 'inactive' : 'active',
    managerIds: parseManagerIdsFromRow(row),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
  };
}

export function mapICRegionRow(row: any): ICRegion {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}

export function mapICSupplierRow(row: any): ICSupplier {
  return mapICCounterpartyRow(row);
}

export function mapICWarehouseRow(row: any): ICWarehouse {
  return {
    id: row.id,
    name: row.name,
    code: row.code ? String(row.code) : undefined,
    phone: row.phone,
    commission: row.commission ? parseFloat(row.commission) : undefined,
    regionId: row.region_id,
    email: row.email,
    address: row.address,
    indiaState: row.india_state ? String(row.india_state) : undefined,
    indiaCity: row.india_city ? String(row.india_city) : undefined,
    branchId: row.branch_id ?? undefined,
    currentStock: row.current_stock != null ? parseFloat(row.current_stock) : 0,
    currentMetalG: row.current_metal_g != null ? parseFloat(row.current_metal_g) : 0,
    openingStock: row.opening_stock != null ? parseFloat(row.opening_stock) : 0,
    openingMetalG: row.opening_metal_g != null ? parseFloat(row.opening_metal_g) : 0,
    openingAed: row.opening_aed != null ? parseFloat(row.opening_aed) : 0,
    openingInr: row.opening_inr != null ? parseFloat(row.opening_inr) : 0,
    sendDeliveryProofToCustomer: row.send_delivery_proof_to_customer !== false,
    deskKind: row.desk_kind === 'branch' ? 'branch' : 'warehouse',
    managerIds: parseManagerIdsFromRow(row),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}

function parsePricingConfig(raw: unknown): ICRateGroup['pricingConfig'] {
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as ICRateGroup['pricingConfig'];
}

export function mergeICRateGroupRowPreservingMembers(
  previous: ICRateGroup,
  next: ICRateGroup,
): ICRateGroup {
  return {
    ...next,
    customerIds:
      next.customerIds && next.customerIds.length > 0 ? next.customerIds : previous.customerIds,
    branchIds: next.branchIds && next.branchIds.length > 0 ? next.branchIds : previous.branchIds,
  };
}

export function mapICRateGroupRow(row: any): ICRateGroup {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    saleRate: parseFloat(row.sale_rate),
    customerIds: row.customer_ids || [],
    branchIds: row.branch_ids || [],
    pricingConfig: parsePricingConfig(row.pricing_config),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

export function mapICPurchaseRow(row: any): ICPurchase {
  const units = parseFloat(row.units);
  const settlementMode = row.settlement_mode === 'metal' ? 'metal' : 'cash';
  const inrTotal = row.inr_total != null ? parseFloat(row.inr_total) : null;
  const lab = labFieldsFromRecord({
    labWeightG: row.lab_weight_g,
    labChargeInrPerG: row.lab_charge_inr_per_g,
    labTotalInr: row.lab_total_inr,
  });
  return {
    id: row.id,
    counterpartyId: row.counterparty_id ? String(row.counterparty_id) : undefined,
    managerId: row.manager_id ? String(row.manager_id) : undefined,
    supplierId: row.supplier_id ? String(row.supplier_id) : undefined,
    locationId: row.location_id,
    warehouseId: row.warehouse_id,
    settlementMode,
    unitRate: parseFloat(row.unit_rate),
    units,
    metalWeightG: row.metal_weight_g != null ? parseFloat(row.metal_weight_g) : null,
    metalRateInrPerG: row.metal_rate_inr_per_g != null ? parseFloat(row.metal_rate_inr_per_g) : null,
    metalRateAedPerG: row.metal_rate_aed_per_g != null ? parseFloat(row.metal_rate_aed_per_g) : null,
    inrTotal,
    metalPaymentMethod: row.metal_payment_method
      ? normalizeMetalPaymentMethod(String(row.metal_payment_method))
      : null,
    splitInrPaid: row.split_inr_paid != null ? parseFloat(row.split_inr_paid) : null,
    splitAedPaid: row.split_aed_paid != null ? parseFloat(row.split_aed_paid) : null,
    aedAgentId: row.aed_agent_id ? String(row.aed_agent_id) : null,
    aedAgentCounterpartyId: row.aed_agent_counterparty_id
      ? String(row.aed_agent_counterparty_id)
      : null,
    aedAgentName: row.aed_agent_name ? String(row.aed_agent_name) : null,
    paymentMethod: row.payment_method,
    notes: row.notes,
    convertedTotal: resolvePurchaseInrDisplay({
      settlementMode,
      inrTotal,
      units,
      labTotalInr: lab.labTotalInr,
    }),
    aedTotal: row.aed_total ? parseFloat(row.aed_total) : undefined,
    paymentStatus: row.payment_status === 'pending' ? 'paid' : row.payment_status || 'paid',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    labWeightG: lab.labWeightG || null,
    labChargeInrPerG: lab.labChargeInrPerG || null,
    labTotalInr: lab.labTotalInr || null,
  };
}

export function mapICSaleRow(row: any): ICSale {
  const units = parseFloat(row.units);
  const settlementMode = row.settlement_mode === 'metal' ? 'metal' : 'cash';
  const inrTotal = row.inr_total != null ? parseFloat(row.inr_total) : null;
  const lab = labFieldsFromRecord({
    labWeightG: row.lab_weight_g,
    labChargeInrPerG: row.lab_charge_inr_per_g,
    labTotalInr: row.lab_total_inr,
  });
  return {
    id: row.id,
    customerName: row.customer_name,
    orderCustomerName: row.order_customer_name || undefined,
    orderCustomerId: row.order_customer_id || undefined,
    counterpartyId: row.counterparty_id ? String(row.counterparty_id) : undefined,
    managerId: row.manager_id ? String(row.manager_id) : undefined,
    subCustomerId: row.sub_customer_id || undefined,
    subCustomerName: row.sub_customer_name || undefined,
    warehouseId: row.warehouse_id,
    settlementMode,
    transactionType: row.transaction_type,
    units,
    unitRate: parseFloat(row.unit_rate),
    metalWeightG: row.metal_weight_g != null ? parseFloat(row.metal_weight_g) : null,
    metalRateInrPerG: row.metal_rate_inr_per_g != null ? parseFloat(row.metal_rate_inr_per_g) : null,
    metalRateAedPerG: row.metal_rate_aed_per_g != null ? parseFloat(row.metal_rate_aed_per_g) : null,
    inrTotal,
    metalPurchaseId: row.metal_purchase_id ? String(row.metal_purchase_id) : null,
    metalPaymentMethod: row.metal_payment_method
      ? normalizeMetalPaymentMethod(String(row.metal_payment_method))
      : null,
    splitInrPaid: row.split_inr_paid != null ? parseFloat(row.split_inr_paid) : null,
    splitAedPaid: row.split_aed_paid != null ? parseFloat(row.split_aed_paid) : null,
    aedAgentId: row.aed_agent_id ? String(row.aed_agent_id) : null,
    aedAgentCounterpartyId: row.aed_agent_counterparty_id
      ? String(row.aed_agent_counterparty_id)
      : null,
    aedAgentName: row.aed_agent_name ? String(row.aed_agent_name) : null,
    aedAmount: row.aed_amount ? parseFloat(row.aed_amount) : undefined,
    enteredBy: row.entered_by,
    enteredByName: row.entered_by_name,
    enteredByUserId: row.entered_by_user_id,
    paymentStatus: row.payment_status || 'pending',
    orderStatus: row.order_status || 'pending',
    rejectionRemarks: row.rejection_remarks || undefined,
    statusUpdatedAt: row.status_updated_at ? new Date(row.status_updated_at).toISOString() : undefined,
    statusUpdatedBy: row.status_updated_by || undefined,
    address: row.address || undefined,
    imageUrl: row.image_url || undefined,
    serviceCharge: row.service_charge ? parseFloat(row.service_charge) : undefined,
    bank: row.bank || undefined,
    deliveryAgentId: row.delivery_agent_id || undefined,
    deliveryAgentName: row.delivery_agent_name || undefined,
    collectedUnits: row.collected_units != null ? parseFloat(row.collected_units) : undefined,
    derivedFromSaleId: row.derived_from_sale_id || undefined,
    priority: row.priority || undefined,
    fulfillmentHandler: 'hq_admin',
    deliveryImageUrl: row.delivery_image_url || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    labWeightG: lab.labWeightG || null,
    labChargeInrPerG: lab.labChargeInrPerG || null,
    labTotalInr: lab.labTotalInr || null,
  };
}

export function mapICSubCustomerRow(row: Record<string, unknown>): ICSubCustomer {
  return {
    id: String(row.id),
    parentCustomerId: String(row.parent_customer_id),
    name: String(row.name),
    contact: row.contact ? String(row.contact) : undefined,
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : undefined,
    hasOrders: Boolean(row.has_orders),
  };
}

export function mapICWarehouseTransactionRow(row: any): ICWarehouseTransaction {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    transactionType: row.transaction_type,
    units: parseFloat(row.units),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
}

type TxnIdRecord = {
  derivedFromSaleId?: string | null;
  derived_from_sale_id?: string | null;
  customerName?: string | null;
  customer_name?: string | null;
};

export function getFormattedTxnId(
  id: string,
  type: 'sale' | 'purchase',
  record?: unknown,
  branchesList?: { name: string }[],
  branchName?: string,
): string {
  if (!id) return '';
  const shortId = id.includes('-') ? id.split('-')[0] : id.substring(0, 8);
  
  if (type === 'purchase') {
    return `IC-PU-${shortId}`;
  }

  const r = (record ?? null) as TxnIdRecord | null;

  // It is a sale
  const derivedId = r?.derivedFromSaleId || r?.derived_from_sale_id;
  if (derivedId) {
    return `IC-SA-DV-${shortId}`;
  }

  const custName = r?.customerName || r?.customer_name;
  const orderCustName = (r as { orderCustomerName?: string; order_customer_name?: string } | null)
    ?.orderCustomerName
    || (r as { order_customer_name?: string } | null)?.order_customer_name;
  const orderCustId = (r as { orderCustomerId?: string; order_customer_id?: string } | null)
    ?.orderCustomerId
    || (r as { order_customer_id?: string } | null)?.order_customer_id;

  if (branchName && custName) {
    const isBranchSubmitted = custName.toLowerCase() === branchName.toLowerCase();
    return isBranchSubmitted ? `IC-SA-BR-${shortId}` : `IC-SA-CU-${shortId}`;
  }

  const isBranch = branchesList?.some(b => b.name === custName) || false;
  if (isBranch) {
    return `IC-SA-BR-${shortId}`;
  }

  // Customer-portal orders store the end customer in customer_name (not branch name).
  if (orderCustId && !orderCustName) {
    return `IC-SA-CU-${shortId}`;
  }

  return `IC-SA-AD-${shortId}`;
}
