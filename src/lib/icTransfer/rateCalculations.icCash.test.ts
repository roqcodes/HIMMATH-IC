import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeIcCashAedTotal, computeIcCashRateFromTotals } from './rateCalculations';

describe('IC cash AED (AED = units × RATE)', () => {
  it('matches the Chemni order sheet (50 × 36.2 = 1,810 AED)', () => {
    assert.equal(computeIcCashAedTotal(50, 36.2), 1810);
    assert.equal(computeIcCashAedTotal(8, 36.4), 291.2);
  });

  it('recovers RATE from units and AED', () => {
    assert.equal(computeIcCashRateFromTotals(50, 1810), 36.2);
    assert.equal(computeIcCashRateFromTotals(8, 291.2), 36.4);
  });
});
