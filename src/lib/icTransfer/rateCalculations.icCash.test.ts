import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeIcCashAedTotal, computeIcCashRateFromTotals } from './rateCalculations';

describe('IC cash AED (AED = units × RATE × 100)', () => {
  it('matches sheet R ~36 → AED per unit ×100 (50 × 36.2 × 100 = 181,000 AED)', () => {
    assert.equal(computeIcCashAedTotal(50, 36.2), 181_000);
    assert.equal(computeIcCashAedTotal(8, 36.4), 29_120);
  });

  it('recovers RATE from units and AED', () => {
    assert.equal(computeIcCashRateFromTotals(50, 181_000), 36.2);
    assert.equal(computeIcCashRateFromTotals(8, 29_120), 36.4);
  });
});
