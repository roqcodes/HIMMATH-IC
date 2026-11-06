import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';

export { INR_PER_UNIT };

/** IC fund deals (`settlement_mode = cash`). Metal uses `metal`. */
export type ICSettlementMode = 'cash' | 'metal';

export const METAL_PAYMENT_METHODS = ['CASH', 'AED'] as const;
export type MetalPaymentMethod = (typeof METAL_PAYMENT_METHODS)[number];

export function isMetalSettlement(mode: string | null | undefined): boolean {
  return String(mode || '') === 'metal';
}

export function isIcSettlement(mode: string | null | undefined): boolean {
  return !isMetalSettlement(mode);
}

export function normalizeMetalPaymentMethod(
  value: string | null | undefined,
): MetalPaymentMethod {
  if (value === 'AED') return 'AED';
  if (value === 'CASH' || value === 'INR') return 'CASH';
  return 'CASH';
}

export function isMetalAedPayment(method: string | null | undefined): boolean {
  return normalizeMetalPaymentMethod(method) === 'AED';
}

export function unitsToInrAmount(units: number): number {
  const u = Number(units);
  if (!Number.isFinite(u)) return 0;
  return u * INR_PER_UNIT;
}

export function inrAmountToUnits(inr: number): number {
  const n = Number(inr);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Number((n / INR_PER_UNIT).toFixed(4));
}

export function formatInrAmount(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return '₹0';
  return `₹${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function formatInrFromUnits(units: number, fractionDigits = 2): string {
  return formatInrAmount(unitsToInrAmount(units), fractionDigits);
}

/** Detail modals / IC forms may still say "units". */
export function formatIcUnits(units: number): string {
  const u = Number(units);
  if (!Number.isFinite(u)) return '0';
  return u.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
