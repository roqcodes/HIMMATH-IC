import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetalLotProfit, splitMetalBookedPl } from './profit';

describe('metal profit', () => {
  it('books only INR metal margin when both legs use an agent', () => {
    const pl = computeMetalLotProfit({
      salePaymentMethod: 'AED',
      purchasePaymentMethod: 'AED',
      weightG: 100,
      purchaseInr: 1_000_000,
      purchaseAed: 50_000,
      saleInr: 1_010_000,
      saleAed: 51_000,
    });
    const split = splitMetalBookedPl(pl);
    assert.equal(split.inr, 10_000);
    assert.equal(split.aed, 0);
  });

  it('splits INR profit when purchase was cash metal and sale is AED', () => {
    const pl = computeMetalLotProfit({
      salePaymentMethod: 'AED',
      purchasePaymentMethod: 'CASH',
      weightG: 499.71,
      purchaseInr: 6_985_945.8,
      purchaseAed: 0,
      saleInr: 6_995_940,
      saleAed: 254_302.42,
    });
    const split = splitMetalBookedPl(pl);
    assert.equal(split.aed, 0);
    assert.ok(Math.abs(split.inr - 9_994.2) < 1);
  });
});
