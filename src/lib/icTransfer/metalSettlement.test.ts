import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMetalRateInrFromTotal,
  computeMetalTotalsFromWeight,
  deriveImputedUnitRateAed,
  deriveUnitsFromInrTotal,
  normalizeCashPurchase,
  normalizeMetalPurchase,
} from './metalSettlement';

describe('metalSettlement', () => {
  it('derives units from INR total at 1 lakh per unit', () => {
    assert.equal(deriveUnitsFromInrTotal(100_000), 1);
    assert.equal(deriveUnitsFromInrTotal(250_000), 2.5);
  });

  it('computes weight-based totals', () => {
    const { totalInr, totalAed } = computeMetalTotalsFromWeight(10.5, 5000, 220);
    assert.equal(totalInr, 52500);
    assert.equal(totalAed, 2310);
  });

  it('back-solves INR rate per gram from total', () => {
    assert.equal(computeMetalRateInrFromTotal(10, 50000), 5000);
  });

  it('normalizes metal purchase as grams (no IC units on the warehouse)', () => {
    const n = normalizeMetalPurchase({
      metalWeightG: 10,
      metalRateInrPerG: 5000,
      metalRateAedPerG: 220,
      totalInr: 50000,
      totalAed: 2200,
    });
    assert.equal(n.units, 0);
    assert.equal(n.unitRate, 0);
    assert.equal(n.metalWeightG, 10);
    assert.equal(n.aedTotal, 2200);
    assert.equal(n.settlementMode, 'metal');
  });

  it('normalizes cash purchase unchanged', () => {
    const n = normalizeCashPurchase({ units: 2, unitRate: 3.5 });
    assert.equal(n.aedTotal, 7);
    assert.equal(n.settlementMode, 'cash');
  });

  it('imputed unit rate', () => {
    assert.equal(deriveImputedUnitRateAed(2200, 0.5), 4400);
  });
});
