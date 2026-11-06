import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDealProfit, remainingIcStockWac } from './dealProfit';
import type { ICPurchase, ICSale } from '@/types';

describe('dealProfit', () => {
  it('books cash WAC gross profit separately from metal lot P&L', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-cash',
        warehouseId: 'w1',
        units: 10,
        unitRate: 30,
        aedTotal: 300,
        settlementMode: 'cash',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'p-metal',
        warehouseId: 'w1',
        units: 0,
        unitRate: 0,
        aedTotal: 253100,
        inrTotal: 6_985_945.8,
        metalWeightG: 499.71,
        metalPaymentMethod: 'AED',
        settlementMode: 'metal',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-cash',
        customerName: 'A',
        warehouseId: 'w1',
        units: 10,
        unitRate: 36,
        aedAmount: 360,
        settlementMode: 'cash',
        orderStatus: 'completed',
        createdAt: '2026-01-15T00:00:00.000Z',
      },
      {
        id: 's-metal',
        customerName: 'A',
        warehouseId: 'w1',
        units: 0,
        unitRate: 0,
        aedAmount: 254302.42,
        inrTotal: 6_995_940,
        metalWeightG: 499.71,
        metalPurchaseId: 'p-metal',
        metalPaymentMethod: 'AED',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-01-20T00:00:00.000Z',
      },
    ];

    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });

    assert.equal(slice.cashGrossProfitAed, 60);
    assert.equal(slice.cashSaleUnits, 10);
    assert.equal(slice.metalProfitAed, 0);
    assert.ok(Math.abs(slice.metalProfitInr - 9_994.2) < 1);
    assert.equal(slice.metalSaleCount, 1);
  });

  it('puts metal INR proceeds into IC WAC so a later IC sale is not free profit', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-metal-inr',
        warehouseId: 'w1',
        units: 0,
        inrTotal: 10_000_000,
        metalWeightG: 500,
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-metal-inr',
        customerName: 'A',
        warehouseId: 'w1',
        units: 110,
        unitRate: 3500,
        aedAmount: 385_000,
        inrTotal: 11_000_000,
        metalWeightG: 500,
        metalPurchaseId: 'p-metal-inr',
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-01-10T00:00:00.000Z',
      },
      {
        id: 's-ic',
        customerName: 'B',
        warehouseId: 'w1',
        units: 50,
        unitRate: 3500,
        aedAmount: 175_000,
        settlementMode: 'cash',
        orderStatus: 'completed',
        createdAt: '2026-01-20T00:00:00.000Z',
      },
    ];
    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    assert.equal(slice.cashGrossProfitAed, 0);
    assert.equal(slice.metalProfitInr, 1_000_000);
  });

  it('books INR margin on cash-metal sale matched to INR lot', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-inr-500',
        warehouseId: 'w1',
        units: 65,
        inrTotal: 6_500_000,
        metalWeightG: 500,
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-inr',
        customerName: 'A',
        warehouseId: 'w1',
        units: 0,
        inrTotal: 7_000_000,
        metalWeightG: 500,
        metalPurchaseId: 'p-inr-500',
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-01-20T00:00:00.000Z',
      },
    ];

    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });

    assert.equal(slice.metalProfitAed, 0);
    assert.equal(slice.metalProfitInr, 500_000);
  });

  it('books INR spread when lot bought in INR and sold via AED agent', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-inr',
        warehouseId: 'w1',
        units: 69.9594,
        inrTotal: 6_985_945.8,
        metalWeightG: 499.71,
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-aed',
        customerName: 'A',
        warehouseId: 'w1',
        units: 0,
        aedAmount: 254_302.42,
        inrTotal: 6_995_940,
        metalWeightG: 499.71,
        metalPurchaseId: 'p-inr',
        metalPaymentMethod: 'AED',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-01-20T00:00:00.000Z',
      },
    ];

    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });

    assert.equal(slice.metalProfitAed, 0);
    assert.ok(Math.abs(slice.metalProfitInr - 9_994.2) < 1);
  });

  it('counts IC stock only from cash IC buys and metal INR sales, not metal AED sales', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-inr',
        warehouseId: 'ksd',
        units: 0,
        inrTotal: 6_500_000,
        metalWeightG: 500,
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
      {
        id: 'p-aed',
        warehouseId: 'ksd',
        units: 0,
        inrTotal: 13_000_000,
        metalWeightG: 1000,
        metalPaymentMethod: 'AED',
        settlementMode: 'metal',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-inr',
        customerName: 'A',
        warehouseId: 'ksd',
        units: 70,
        unitRate: 3500,
        aedAmount: 245_000,
        inrTotal: 7_000_000,
        metalWeightG: 500,
        metalPurchaseId: 'p-inr',
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
      {
        id: 's-aed',
        customerName: 'B',
        warehouseId: 'ksd',
        units: 0,
        unitRate: 3600,
        aedAmount: 504_000,
        inrTotal: 14_000_000,
        metalWeightG: 1000,
        metalPurchaseId: 'p-aed',
        metalPaymentMethod: 'AED',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ];

    const { units } = remainingIcStockWac(purchases, sales, 'ksd');
    assert.equal(units, 70);
  });

  it('nets lab test out of metal INR P&L', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-lab',
        warehouseId: 'w1',
        units: 0,
        inrTotal: 27_000_000,
        labTotalInr: 4_000,
        metalWeightG: 2000,
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        createdAt: '2026-11-05T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-lab',
        customerName: 'A',
        warehouseId: 'w1',
        units: 0,
        inrTotal: 27_000_000,
        labTotalInr: 4_000,
        metalWeightG: 2000,
        metalPurchaseId: 'p-lab',
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-11-05T00:00:00.000Z',
      },
    ];
    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-11-05', endDate: '2026-11-05' },
    });
    assert.equal(slice.metalProfitInr, 0);
  });
});
