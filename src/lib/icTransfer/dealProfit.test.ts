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
        unitRate: 1_000_000 / 300,
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
        unitRate: 1_000_000 / 360,
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
    assert.ok(Math.abs(slice.cashGrossProfitInr - 60 * (1_000_000 / 360)) < 0.05);
    assert.equal(slice.cashSaleUnits, 10);
    assert.equal(slice.metalProfitAed, 0);
    assert.ok(Math.abs(slice.metalProfitInr - 9_994.2) < 1);
    assert.equal(slice.metalSaleCount, 1);
  });

  it('puts metal INR sale units into IC stock', () => {
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
        unitRate: 11_000_000 / 385_000,
        aedAmount: 385_000,
        inrTotal: 11_000_000,
        metalWeightG: 500,
        metalPurchaseId: 'p-metal-inr',
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-01-10T00:00:00.000Z',
      },
    ];
    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    assert.equal(slice.cashGrossProfitAed, 0);
    assert.equal(slice.cashCogsAed, 0);
    assert.equal(slice.metalProfitInr, 1_000_000);
    const { units, rate } = remainingIcStockWac(purchases, sales, 'w1');
    assert.equal(units, 110);
    const expectedRate = 11_000_000 / 385_000;
    assert.ok(Math.abs(rate - expectedRate) < 0.02);
  });

  it('keeps DEL cash IC 360k/370k separate from metal 10L INR', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-ic',
        warehouseId: 'del',
        units: 100,
        unitRate: (100 * 100_000) / 360_000,
        aedTotal: 360_000,
        settlementMode: 'cash',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
      {
        id: 'p-metal',
        warehouseId: 'del',
        units: 0,
        inrTotal: 13_986_000,
        labTotalInr: 14_000,
        metalWeightG: 1000,
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        createdAt: '2026-11-02T00:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-ic',
        customerName: 'BAVA',
        warehouseId: 'del',
        units: 100,
        unitRate: (100 * 100_000) / 370_000,
        aedAmount: 370_000,
        settlementMode: 'cash',
        orderStatus: 'completed',
        createdAt: '2026-11-03T00:00:00.000Z',
      },
      {
        id: 's-metal',
        customerName: 'RONAK',
        warehouseId: 'del',
        units: 149.86,
        unitRate: 0,
        aedAmount: 0,
        inrTotal: 14_986_000,
        labTotalInr: 14_000,
        metalWeightG: 1000,
        metalPurchaseId: 'p-metal',
        metalPaymentMethod: 'CASH',
        settlementMode: 'metal',
        orderStatus: 'completed',
        createdAt: '2026-11-04T00:00:00.000Z',
      },
    ];
    const slice = computeDealProfit({
      purchases,
      sales,
      range: { startDate: '2026-11-01', endDate: '2026-11-30' },
      warehouseId: 'del',
    });
    assert.equal(slice.cashGrossProfitAed, 10_000);
    assert.ok(
      Math.abs(slice.cashGrossProfitInr - 10_000 * ((100 * 100_000) / 370_000)) < 0.05,
    );
    assert.equal(slice.cashCogsAed, 360_000);
    assert.equal(slice.cashRevenueAed, 370_000);
    assert.equal(slice.metalProfitInr, 1_000_000);
    const { units } = remainingIcStockWac(purchases, sales, 'del');
    assert.equal(units, 149.86);
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
        aedAmount: 254302.42,
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

  it('counts IC stock only from cash IC buys, never metal INR or AED sales', () => {
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
        unitRate: 7_000_000 / 245_000,
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
        unitRate: 14_000_000 / 504_000,
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
