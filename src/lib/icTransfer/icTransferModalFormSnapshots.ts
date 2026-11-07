import type { ICSettlementMode } from '@/lib/icTransfer/metalSettlement';
import type { LabTestFields } from '@/lib/icTransfer/labTest';
import type { MetalSettlementFields } from '@/lib/icTransfer/metalSettlement';
import type { OrderPriority } from '@/types/warehouse';
import type { ICSaleTransactionType } from '@/lib/icTransfer/transactionTypes';
import type { MetalPaymentMethod } from '@/lib/domain/books';

export type ICPurchaseFormSnapshot = {
  kind: 'purchase';
  settlementMode: ICSettlementMode;
  units: number;
  rate: number;
  supplierId: string;
  warehouseId: string;
  notes: string;
  metalPayment: MetalPaymentMethod;
  aedAgentId: string;
  metal: MetalSettlementFields;
  lab: LabTestFields;
};

export type ICSaleFormSnapshot = {
  kind: 'sale';
  settlementMode: ICSettlementMode;
  units: number;
  rate: number;
  customerName: string;
  counterpartyId: string;
  warehouseId: string;
  metalPurchaseId: string;
  metalPayment: MetalPaymentMethod;
  aedAgentId: string;
  transactionType: ICSaleTransactionType;
  priority: OrderPriority;
  address: string;
  imageUrl: string;
  deleteToken: string;
  metal: MetalSettlementFields;
  lab: LabTestFields;
};

export function stringifyIcPurchaseFormSnapshot(s: ICPurchaseFormSnapshot): string {
  return JSON.stringify(s);
}

export function stringifyIcSaleFormSnapshot(s: ICSaleFormSnapshot): string {
  return JSON.stringify(s);
}
