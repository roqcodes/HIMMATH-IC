import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateLotAmount,
  computeMetalLotProfit,
  isFullRemainingSell,
  normalizeMetalLotSale,
  remainingMetalGramsOnLot,
} from './metalInventory';

describe('metalInventory', () => {
  it('remaining grams ignore void sales', () => {
    assert.equal(
      remainingMetalGramsOnLot(1000, [
        { metalWeightG: 1000, orderStatus: 'cancelled' },
        { metalWeightG: 250, orderStatus: 'completed' },
      ]),
      750,
    );
  });

  it('INR payment books INR profit and restores IC units', () => {
    const sale = normalizeMetalLotSale({
      metalPurchaseId: 'lot-1',
      paymentMethod: 'INR',
      input: {
        metalWeightG: 499.71,
        metalRateInrPerG: 14000,
        metalRateAedPerG: 508.9,
        totalInr: 6_995_940,
        totalAed: 254_302.42,
      },
    });
    assert.ok(Math.abs(sale.units - 69.9594) < 0.0001);
    assert.equal(sale.aedAmount, 254302.42);

    const pl = computeMetalLotProfit({
      paymentMethod: 'INR',
      weightG: 499.71,
      purchaseInr: 6_985_945,
      purchaseAed: 253_100,
      saleInr: 6_995_940,
      saleAed: 254_302.42,
    });
    assert.equal(pl.bookedCurrency, 'INR');
    assert.ok(Math.abs(pl.bookedProfit - 9_995) < 0.5);
    assert.ok(Math.abs(pl.profitInr - 9_995) < 0.5);
  });

  it('AED payment bills the customer in AED and books AED profit', () => {
    const sale = normalizeMetalLotSale({
      metalPurchaseId: 'lot-1',
      paymentMethod: 'AED',
      input: {
        metalWeightG: 499.71,
        metalRateInrPerG: 14000,
        metalRateAedPerG: 508.9,
        totalInr: 6_995_940,
        totalAed: 254_302.42,
      },
    });
    assert.equal(sale.units, 0);
    assert.equal(sale.aedAmount, 254302.42);

    const pl = computeMetalLotProfit({
      paymentMethod: 'AED',
      weightG: 499.71,
      purchaseInr: 6_985_945,
      purchaseAed: 253_100,
      saleInr: 6_995_940,
      saleAed: 254_302.42,
    });
    assert.equal(pl.bookedCurrency, 'AED');
    assert.ok(Math.abs(pl.bookedProfit - 1_202.42) < 0.01);
  });

  it('allocates lot cost by grams for later partial sells', () => {
    assert.equal(allocateLotAmount(1000, 250, 1000), 250);
    assert.equal(isFullRemainingSell(499.71, 499.71), true);
    assert.equal(isFullRemainingSell(100, 499.71), false);
  });
});
