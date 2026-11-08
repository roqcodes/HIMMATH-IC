import { z } from 'zod';
import { finiteFormAmountSchema, nonNegativeFormAmountSchema } from '@/lib/parseFormAmount';

export type AedInrOpenings = {
  openingAed: number;
  openingInr: number;
};

export type WarehouseOpenings = AedInrOpenings & {
  openingStock: number;
  openingMetalG: number;
};

export const aedInrOpeningSchema = z.object({
  openingAed: finiteFormAmountSchema.optional().default(0),
  openingInr: finiteFormAmountSchema.optional().default(0),
});

export const warehouseOpeningSchema = aedInrOpeningSchema.extend({
  openingStock: nonNegativeFormAmountSchema.optional().default(0),
  openingMetalG: nonNegativeFormAmountSchema.optional().default(0),
});

export function parseAedInrOpenings(raw?: Partial<AedInrOpenings> | null): AedInrOpenings {
  return aedInrOpeningSchema.parse(raw ?? {});
}

export function parseWarehouseOpenings(raw?: Partial<WarehouseOpenings> | null): WarehouseOpenings {
  return warehouseOpeningSchema.parse(raw ?? {});
}
