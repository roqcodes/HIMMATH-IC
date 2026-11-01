import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMetalFieldChange,
  computeMetalRateInrFromTotal,
  computeMetalSheetRateAed,
  computeMetalTotalsFromWeight,
  deriveImputedUnitRateAed,
  deriveUnitsFromInrTotal,
  metalFieldsFromRecord,
  normalizeCashPurchase,
  normalizeMetalPurchase,
} from './metalSettlement';

describe('metalSettlement', () => {
  it('derives units from INR total at 1 lakh per unit', () => {
    assert.equal(deriveUnitsFromInrTotal(100_000), 1);
    assert.equal(deriveUnitsFromInrTotal(250_000), 2.5);
  });

  it('computes weight-based totals with sheet RATE (AED = INR × rate ÷ 1000)', () => {
    const { totalInr, totalAed } = computeMetalTotalsFromWeight(10.5, 5000, 220);
    assert.equal(totalInr, 52500);
    assert.equal(totalAed, 11550);
  });

  it('matches the metal P&L sheet purchase row', () => {
    const { totalInr, totalAed } = computeMetalTotalsFromWeight(499.71, 13980, 36.23);
    assert.equal(totalInr, 6_985_945.8);
    assert.equal(totalAed, 253_100.8163);
    assert.equal(computeMetalSheetRateAed(totalInr, totalAed), 36.23);

    const sale = computeMetalTotalsFromWeight(499.71, 14000, 36.35);
    assert.equal(sale.totalInr, 6_995_940);
    assert.equal(sale.totalAed, 254_302.419);
  });

  it('keeps RATE and recomputes AED when G rate changes', () => {
    const started = {
      ...metalFieldsFromRecord({
        metalWeightG: 499.71,
        metalRateInrPerG: 13980,
        inrTotal: 6_985_945.8,
        aedTotal: 253_100.8163,
      }),
      metalSheetRateAed: 36.23,
    };
    const next = applyMetalFieldChange(started, 'rateInr', 14000);
    assert.equal(next.inrTotal, 6_995_940);
    assert.equal(next.metalSheetRateAed, 36.23);
    assert.equal(next.aedTotal, 253_462.9062);
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
