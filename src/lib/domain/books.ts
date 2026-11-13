import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';

export { INR_PER_UNIT };

/** IC fund deals (`settlement_mode = cash`). Metal uses `metal`. */
export type ICSettlementMode = 'cash' | 'metal';

export const METAL_PAYMENT_METHODS = ['CASH', 'AED', 'SPLIT'] as const;
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
  if (value === 'SPLIT') return 'SPLIT';
  if (value === 'CASH' || value === 'INR') return 'CASH';
  return 'CASH';
}

/** Full-AED metal (no INR receivable on the counterparty). Split is not this. */
export function isMetalAedPayment(method: string | null | undefined): boolean {
  return normalizeMetalPaymentMethod(method) === 'AED';
}

export function isMetalSplitPayment(method: string | null | undefined): boolean {
  return normalizeMetalPaymentMethod(method) === 'SPLIT';
}

/** AED agent is required for full AED and for split. */
export function needsMetalAedAgent(method: string | null | undefined): boolean {
  const pay = normalizeMetalPaymentMethod(method);
  return pay === 'AED' || pay === 'SPLIT';
}

export function hasMetalAedAgentSelected(aedAgentId: string | null | undefined): boolean {
  return Boolean(String(aedAgentId ?? '').trim());
}

/** True when payment does not need an agent, or an agent is selected. */
export function metalAedAgentSatisfied(
  method: string | null | undefined,
  aedAgentId: string | null | undefined,
): boolean {
  return !needsMetalAedAgent(method) || hasMetalAedAgentSelected(aedAgentId);
}

export const METAL_AED_AGENT_REQUIRED_MSG =
  'Select a collection agent (UAE) for AED or split payment.';

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
  if (!Number.isFinite(value)) return '₹0.00';
  const min = fractionDigits <= 2 ? 2 : 0;
  return `₹${value.toLocaleString(undefined, {
    minimumFractionDigits: min,
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
