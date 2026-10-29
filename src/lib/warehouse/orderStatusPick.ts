import type { ICSale } from '@/types';
import type { WarehouseOrder } from '@/types/warehouse';

export type WarehouseOrderStatusPick = Pick<
  ICSale,
  'orderStatus' | 'deliveryAgentId' | 'aedAmount' | 'paymentStatus' | 'derivedFromSaleId' | 'transactionType'
>;

export function warehouseOrderToStatusPick(order: WarehouseOrder): WarehouseOrderStatusPick {
  return {
    orderStatus: order.order_status ?? undefined,
    deliveryAgentId: order.delivery_agent_id ?? undefined,
    aedAmount: order.aed_amount,
    paymentStatus: undefined,
    derivedFromSaleId: order.derived_from_sale_id ?? undefined,
  };
}

export function warehouseOrderToPortalPick(order: WarehouseOrder): Pick<ICSale, 'orderStatus' | 'deliveryAgentId'> {
  return {
    orderStatus: order.order_status ?? undefined,
    deliveryAgentId: order.delivery_agent_id ?? undefined,
  };
}
