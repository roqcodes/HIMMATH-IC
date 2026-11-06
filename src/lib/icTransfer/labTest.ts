import { METAL_AMOUNT_DECIMALS, METAL_WEIGHT_DECIMALS } from '@/lib/icTransfer/metalSettlement';
import type { ICPurchase, ICSale } from '@/types';

export type LabTestFields = {
  labWeightG: number;
  labChargeInrPerG: number;
  labTotalInr: number;
};

export type LabTestFieldKey = 'weight' | 'charge' | 'total';

function roundWeight(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(METAL_WEIGHT_DECIMALS));
}

function roundInr(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(METAL_AMOUNT_DECIMALS));
}

export const emptyLabFields = (): LabTestFields => ({
  labWeightG: 0,
  labChargeInrPerG: 0,
  labTotalInr: 0,
});

export function computeLabTotalInr(weightG: number, chargeInrPerG: number): number {
  const w = roundWeight(weightG);
  const c = roundInr(chargeInrPerG);
  if (w <= 0 || c <= 0) return 0;
  return roundInr(w * c);
}

export function netMetalInr(grossInr: number, labTotalInr: number): number {
  const gross = roundInr(Number(grossInr) || 0);
  const lab = roundInr(Number(labTotalInr) || 0);
  if (gross <= 0) return 0;
  return roundInr(Math.max(0, gross - lab));
}

export function hasLab(fields: Pick<LabTestFields, 'labTotalInr'>): boolean {
  return roundInr(Number(fields.labTotalInr) || 0) > 0;
}

export function applyLabFieldChange(
  value: LabTestFields,
  field: LabTestFieldKey,
  num: number,
): LabTestFields {
  switch (field) {
    case 'weight': {
      const labWeightG = roundWeight(num);
      return {
        ...value,
        labWeightG,
        labTotalInr: computeLabTotalInr(labWeightG, value.labChargeInrPerG),
      };
    }
    case 'charge': {
      const labChargeInrPerG = roundInr(num);
      return {
        ...value,
        labChargeInrPerG,
        labTotalInr: computeLabTotalInr(value.labWeightG, labChargeInrPerG),
      };
    }
    case 'total': {
      const labTotalInr = roundInr(num);
      const labWeightG = value.labWeightG;
      const labChargeInrPerG =
        labWeightG > 0 && labTotalInr > 0 ? roundInr(labTotalInr / labWeightG) : value.labChargeInrPerG;
      return { ...value, labTotalInr, labChargeInrPerG };
    }
    default:
      return value;
  }
}

export function labFieldsFromRecord(input: {
  labWeightG?: number | null;
  labChargeInrPerG?: number | null;
  labTotalInr?: number | null;
}): LabTestFields {
  const labWeightG = roundWeight(Number(input.labWeightG) || 0);
  const labChargeInrPerG = roundInr(Number(input.labChargeInrPerG) || 0);
  const storedTotal = roundInr(Number(input.labTotalInr) || 0);
  const labTotalInr =
    storedTotal > 0 ? storedTotal : computeLabTotalInr(labWeightG, labChargeInrPerG);
  return { labWeightG, labChargeInrPerG, labTotalInr };
}

export function validateLabAgainstGross(labTotalInr: number, grossInr: number): void {
  const lab = roundInr(labTotalInr);
  const gross = roundInr(grossInr);
  if (lab <= 0) return;
  if (gross <= 0) {
    throw new Error('Metal INR total is required before adding a lab test fee.');
  }
  if (lab - gross > 0.0001) {
    throw new Error('Lab test total cannot exceed metal INR total.');
  }
}

export type LabTestActivityRow = {
  id: string;
  dealKind: 'purchase' | 'sale';
  createdAt?: string;
  partyLabel: string;
  labWeightG: number;
  labChargeInrPerG: number;
  labTotalInr: number;
  grossInr: number;
  netInr: number;
  dealRef: string;
};

export function buildWarehouseLabTestRows(
  purchases: ICPurchase[],
  sales: ICSale[],
  getPurchaseParty: (p: ICPurchase) => string,
  getSaleParty: (s: ICSale) => string,
  formatDealRef: (kind: 'purchase' | 'sale', id: string) => string,
): LabTestActivityRow[] {
  const rows: LabTestActivityRow[] = [];
  for (const p of purchases) {
    if (p.settlementMode !== 'metal' || !hasLab(p)) continue;
    const gross = Number(p.inrTotal) || 0;
    rows.push({
      id: p.id,
      dealKind: 'purchase',
      createdAt: p.createdAt,
      partyLabel: getPurchaseParty(p),
      labWeightG: Number(p.labWeightG) || 0,
      labChargeInrPerG: Number(p.labChargeInrPerG) || 0,
      labTotalInr: Number(p.labTotalInr) || 0,
      grossInr: gross,
      netInr: netMetalInr(gross, Number(p.labTotalInr) || 0),
      dealRef: formatDealRef('purchase', p.id),
    });
  }
  for (const s of sales) {
    if (s.settlementMode !== 'metal' || !hasLab(s)) continue;
    const gross = Number(s.inrTotal) || 0;
    rows.push({
      id: s.id,
      dealKind: 'sale',
      createdAt: s.createdAt,
      partyLabel: getSaleParty(s),
      labWeightG: Number(s.labWeightG) || 0,
      labChargeInrPerG: Number(s.labChargeInrPerG) || 0,
      labTotalInr: Number(s.labTotalInr) || 0,
      grossInr: gross,
      netInr: netMetalInr(gross, Number(s.labTotalInr) || 0),
      dealRef: formatDealRef('sale', s.id),
    });
  }
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
