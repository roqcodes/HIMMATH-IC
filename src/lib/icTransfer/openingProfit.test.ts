import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDealProfit, indexSaleLineProfits } from './dealProfit';
import type { ICPurchase, ICSale } from '@/types';

describe('IC sales profit with warehouse opening stock', () => {
  it('weights opening INR/AED with purchases and reconciles the reference sale', () => {
    const purchases: ICPurchase[] = [{
      id: 'p-reference',
      warehouseId: 'reference',
      units: 36_487_080 / 100_000,
      unitRate: 36.0793,
      aedTotal: 1_316_428.33,
      settlementMode: 'cash',
      createdAt: '2026-11-01T00:00:00.000Z',
    }];
    const sales: ICSale[] = [{
      id: 's-reference',
      customerName: 'Reference customer',
      warehouseId: 'reference',
      units: 22_899_400 / 100_000,
      unitRate: 36.275,
      aedAmount: 830_647.22,
      settlementMode: 'cash',
      orderStatus: 'completed',
      createdAt: '2026-11-02T00:00:00.000Z',
    }];
    const opening = {
      id: 'reference',
      openingStock: 95_472_954.73 / 100_000,
      openingAed: 3_438_317.75,
    };
    const range = { startDate: null, endDate: null };
    const result = computeDealProfit({ purchases, sales, range, warehouses: [opening] });
    const withoutOpening = computeDealProfit({ purchases, sales, range });
    const effectiveBuyingRate =
      (opening.openingAed + 1_316_428.33) /
      ((95_472_954.73 + 36_487_080) / 1_000);

    assert.ok(Math.abs(effectiveBuyingRate - 36.0317128571) < 0.00000001);
    assert.equal(withoutOpening.cashGrossProfitAed, 4_452.88);
    assert.equal(result.cashGrossProfitAed, 5_542.61);
    assert.ok(Math.abs(result.cashGrossProfitAed - 5_542.59) <= 0.03);
    assert.equal(
      indexSaleLineProfits({ purchases, sales, range, warehouses: [opening] }).get('s-reference')?.amount,
      5_542.61,
    );
  });
});
