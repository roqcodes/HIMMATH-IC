import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCombinedTradeBookKpis,
  dealPurchaseAed,
  dealSaleAed,
  remainingCashMetalInrCost,
} from './dealBookKpis';
import { computeDealProfit } from './dealProfit';
import { computeWarehouseMetalGramsOnHand } from './warehouseMatrixMetrics';
import { netMetalInr } from '@/lib/icTransfer/labTest';
import { computeMetalAedFromInr } from '@/lib/icTransfer/metalSettlement';
import { saleDealAed, saleTableDisplayAed } from './dealTableDisplay';
import type { ICPurchase, ICSale } from '@/types';

const range = { startDate: '2026-11-01', endDate: '2026-11-05' };

const zakBuy: ICPurchase = {
  id: 'p-zak',
  warehouseId: 'del',
  units: 319.76,
  settlementMode: 'metal',
  metalPaymentMethod: 'CASH',
  inrTotal: 3_00_00_000,
  labTotalInr: 12_000,
  metalWeightG: 2000,
  aedTotal: 0,
  createdAt: '2026-11-05T07:56:00.000Z',
};

const ronakSell: ICSale = {
  id: 's-ronak',
  customerName: 'Muhammed Ronak B S',
  warehouseId: 'del',
  units: 319.76,
  unitRate: 3703,
  aedAmount: 1_184_000,
  settlementMode: 'metal',
  metalPaymentMethod: 'CASH',
  metalPurchaseId: 'p-zak',
  inrTotal: 3_20_00_000,
  labTotalInr: 24_000,
  metalWeightG: 2000,
  orderStatus: 'completed',
  createdAt: '2026-11-05T08:04:00.000Z',
};

describe('warehouse KPI fixture Zak buy + Ronak sell', () => {
  it('hides cash-metal memo AED', () => {
    assert.equal(dealPurchaseAed(zakBuy), 0);
    assert.equal(dealSaleAed(ronakSell), 0);
    assert.equal(saleDealAed(ronakSell), 0);
  });

  it('table shows implied AED from net INR × RATE ÷ 1000 for metal INR', () => {
    const expected = computeMetalAedFromInr(
      netMetalInr(Number(ronakSell.inrTotal) || 0, Number(ronakSell.labTotalInr) || 0),
      Number(ronakSell.unitRate) || 0,
    );
    assert.ok(Math.abs(saleTableDisplayAed(ronakSell) - expected) < 0.01);
  });

  it('metal AED agent totals scale by net INR after lab', () => {
    const purchase: ICPurchase = {
      ...zakBuy,
      metalPaymentMethod: 'AED',
      inrTotal: 3_00_00_000,
      labTotalInr: 12_000,
      aedTotal: 1000,
    };
    const sale: ICSale = {
      ...ronakSell,
      metalPaymentMethod: 'AED',
      inrTotal: 3_20_00_000,
      labTotalInr: 24_000,
      aedAmount: 2000,
      serviceCharge: 0,
    };
    assert.equal(dealPurchaseAed(purchase), 999.6);
    assert.equal(dealSaleAed(sale), 1998.5);
  });

  it('books Metal P&L 19.88L after lab', () => {
    const slice = computeDealProfit({
      purchases: [zakBuy],
      sales: [ronakSell],
      range,
      warehouseId: 'del',
    });
    assert.equal(slice.metalProfitInr, 19_88_000);
    assert.equal(slice.metalProfitAed, 0);
  });

  it('INR strip: period net buy/sell, closing unsold metal is 0', () => {
    const books = computeCombinedTradeBookKpis([zakBuy], [ronakSell], range);
    assert.equal(books.inr.periodDebit, 2_99_88_000);
    assert.equal(books.inr.periodCredit, 3_19_76_000);
    assert.equal(books.inr.opening, 0);
    assert.equal(books.inr.closing, 0);
    assert.equal(books.aed.periodDebit, 0);
    assert.equal(books.aed.periodCredit, 0);
  });

  it('metal grams on hand are 0 after the full lot is sold', () => {
    assert.equal(computeWarehouseMetalGramsOnHand([zakBuy], [ronakSell], 'del'), 0);
    assert.equal(remainingCashMetalInrCost([zakBuy], [ronakSell], { through: '2026-11-05' }), 0);
  });

  it('unsold lot still sits at net cost until it is sold', () => {
    const earlierBuy = { ...zakBuy, createdAt: '2026-10-20T00:00:00.000Z' };
    assert.equal(remainingCashMetalInrCost([zakBuy], [], { through: '2026-11-05' }), 2_99_88_000);
    assert.equal(
      remainingCashMetalInrCost([earlierBuy], [], { before: '2026-11-01' }),
      2_99_88_000,
    );
  });
});
