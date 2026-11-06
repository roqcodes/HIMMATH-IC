import { allocateLotAmount } from '@/lib/icTransfer/metalInventory';
import { netMetalInr } from '@/lib/icTransfer/labTest';

/** Pro-rata lot INR cost (net of lab test) — never treat missing lot weight as a full-lot sell. */
export function allocateMetalLotCostInr(
  lot: { inrTotal?: number | null; metalWeightG?: number | null; labTotalInr?: number | null } | undefined,
  saleG: number,
): number {
  if (!lot || saleG <= 0) return 0;
  const purchasedG = Number(lot.metalWeightG);
  const inr = netMetalInr(Number(lot.inrTotal) || 0, Number(lot.labTotalInr) || 0);
  if (!Number.isFinite(purchasedG) || purchasedG <= 0 || inr <= 0) return 0;
  return allocateLotAmount(inr, saleG, purchasedG);
}

/** Pro-rata lot AED cost (agent metal). */
export function allocateMetalLotCostAed(
  lot: { aedTotal?: number | null; metalWeightG?: number | null } | undefined,
  saleG: number,
): number {
  if (!lot || saleG <= 0) return 0;
  const purchasedG = Number(lot.metalWeightG);
  const aed = Number(lot.aedTotal) || 0;
  if (!Number.isFinite(purchasedG) || purchasedG <= 0 || aed <= 0) return 0;
  return allocateLotAmount(aed, saleG, purchasedG);
}
