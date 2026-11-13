import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { metalSaleFieldsFromMetalLotSelection } from './metalLotCost';

describe('metalSaleFieldsFromMetalLotSelection', () => {
  it('copies G rate and sheet rate from the purchase lot', () => {
    const fields = metalSaleFieldsFromMetalLotSelection(
      {
        metalWeightG: 500,
        metalRateInrPerG: 13980,
        inrTotal: 6_990_000,
        aedTotal: 253_000,
        unitRate: 36.23,
      },
      500,
    );
    assert.equal(fields.metalWeightG, 500);
    assert.equal(fields.metalRateInrPerG, 13980);
    assert.equal(fields.inrTotal, 6_990_000);
    assert.equal(fields.metalSheetRateAed, 36.23);
    assert.ok(fields.aedTotal > 0);
  });

  it('derives INR/G when the lot row omitted stored rate', () => {
    const fields = metalSaleFieldsFromMetalLotSelection(
      {
        metalWeightG: 10,
        inrTotal: 50_000,
      },
      10,
    );
    assert.equal(fields.metalRateInrPerG, 5000);
    assert.equal(fields.inrTotal, 50_000);
  });
});
