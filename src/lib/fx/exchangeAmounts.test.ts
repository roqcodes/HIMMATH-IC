import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeCurrencyExchangeAmounts } from '@/lib/fx/amounts';

describe('computeCurrencyExchangeAmounts', () => {
  it('AED to INR multiplies by INR per AED', () => {
    assert.deepEqual(computeCurrencyExchangeAmounts('aed_to_inr', 1_201.6, 25), {
      aed: 1_201.6,
      inr: 30_040,
    });
  });

  it('INR to AED divides by INR per AED', () => {
    const out = computeCurrencyExchangeAmounts('inr_to_aed', 10_000, 25);
    assert.equal(out.inr, 10_000);
    assert.equal(out.aed, 400);
  });
});
