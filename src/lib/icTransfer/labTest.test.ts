import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLabTotalInr,
  netMetalInr,
  validateLabAgainstGross,
  applyLabFieldChange,
  emptyLabFields,
  labFieldsFromMetalLotSelection,
} from './labTest';
import { dealPurchaseInr, dealSaleInr } from './dealBookKpis';
import type { ICPurchase, ICSale } from '@/types';

describe('labTest', () => {
  it('computes lab total from weight and charge', () => {
    assert.equal(computeLabTotalInr(500, 100), 50_000);
  });

  it('nets metal INR after lab', () => {
    assert.equal(netMetalInr(7_000_000, 50_000), 6_950_000);
  });

  it('rejects lab above gross', () => {
    assert.throws(() => validateLabAgainstGross(100, 50));
  });

  it('pro-rates purchase lab when picking a metal lot for sale', () => {
    const lot = {
      metalWeightG: 1000,
      labWeightG: 1000,
      labChargeInrPerG: 10,
      labTotalInr: 10_000,
    };
    const half = labFieldsFromMetalLotSelection(lot, 500);
    assert.equal(half.labWeightG, 500);
    assert.equal(half.labChargeInrPerG, 10);
    assert.equal(half.labTotalInr, 5000);
    assert.deepEqual(labFieldsFromMetalLotSelection(lot, 0), emptyLabFields());
  });

  it('derives total when weight or charge changes', () => {
    const next = applyLabFieldChange(emptyLabFields(), 'weight', 10);
    const withCharge = applyLabFieldChange(next, 'charge', 500);
    assert.equal(withCharge.labTotalInr, 5000);
  });

  it('nets INR payable/receivable on metal cash deals', () => {
    const purchase = {
      settlementMode: 'metal',
      metalPaymentMethod: 'CASH',
      inrTotal: 27_000_000,
      labTotalInr: 4_000,
    } as ICPurchase;
    const sale = {
      settlementMode: 'metal',
      metalPaymentMethod: 'CASH',
      inrTotal: 27_000_000,
      labTotalInr: 4_000,
    } as ICSale;
    assert.equal(dealPurchaseInr(purchase), 26_996_000);
    assert.equal(dealSaleInr(sale), 26_996_000);
    assert.equal(dealPurchaseInr({ ...purchase, metalPaymentMethod: 'AED' }), 0);
  });
});
