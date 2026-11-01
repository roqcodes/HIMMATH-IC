import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDealProfit } from './dealProfit';
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
    assert.ok(Math.abs(slice.metalProfitAed - 1202.42) < 0.02);
    assert.equal(slice.metalSaleCount, 1);
  });
});
