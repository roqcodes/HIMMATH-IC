import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';

/** INR display — 1 unit = 1 lakh (100,000 INR). */
export function getSaleInrAmount(units: number): number {
  return Number(units) * INR_PER_UNIT;
}

export function formatInr(units: number): string {
  return `${getSaleInrAmount(units).toLocaleString('en-IN')} INR`;
}

export function formatUnits(units: number): string {
  return Number(units).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Scale financial fields when splitting or partial-delivering a sale. */
export function scaleSaleFinancials(
  originalUnits: number,
  newUnits: number,
  unitRate: number,
  serviceCharge: number = 0,
) {
  const ratio = originalUnits > 0 ? newUnits / originalUnits : 1;
  const aedBase = newUnits * unitRate;
  const scaledService = serviceCharge * ratio;
  const aedAmount = Math.max(0, aedBase - scaledService);
  return {
    units: newUnits,
    aedAmount,
    serviceCharge: scaledService,
  };
}

export function getDeliveredUnits(
  units: number,
  collectedUnits?: number | null,
  orderStatus?: string | null,
): number {
  if (orderStatus === 'completed' || orderStatus === 'delivery_pending_admin') {
    return Number(units);
  }
  return Number(collectedUnits ?? 0);
}

export function getRemainingUnits(
  units: number,
  collectedUnits?: number | null,
  orderStatus?: string | null,
): number {
  const total = Number(units);
  const delivered = getDeliveredUnits(units, collectedUnits, orderStatus);
  return Math.max(0, total - delivered);
}

export function isSaleCompleted(orderStatus?: string | null): boolean {
  return orderStatus === 'completed';
}

export function isDeliveryAgentFinished(orderStatus?: string | null): boolean {
  return (
    orderStatus === 'completed' ||
    orderStatus === 'delivery_pending_admin' ||
    orderStatus === 'da_rejected'
  );
}
