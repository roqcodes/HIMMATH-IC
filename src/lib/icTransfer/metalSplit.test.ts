import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookedMetalAed,
  bookedMetalInr,
  complementSplitAed,
  complementSplitInr,
  finalizeSplitAmounts,
  metalInrSaleIcUnitsFromFields,
  resolveDealSplitLegs,
} from './metalSplit';

describe('metal split', () => {
  it('5M of 10M INR → leftover 175k AED on a 350k deal', () => {
    assert.equal(complementSplitAed(5_000_000, 10_000_000, 350_000), 175_000);
    assert.equal(complementSplitInr(175_000, 10_000_000, 350_000), 5_000_000);
  });

  it('finalize prefers INR paid and fills AED', () => {
    const split = finalizeSplitAmounts(10_000_000, 350_000, 5_000_000, 1);
    assert.equal(split.paidInr, 5_000_000);
    assert.equal(split.paidAed, 175_000);
  });

  it('CASH/AED legs ignore stored split columns', () => {
    assert.deepEqual(resolveDealSplitLegs({
      paymentMethod: 'CASH',
      grossInr: 100,
      aedTotal: 4,
      splitInrPaid: 40,
    }), { paidInr: 100, paidAed: 0, remainingInr: 0 });
    assert.deepEqual(resolveDealSplitLegs({
      paymentMethod: 'AED',
      grossInr: 100,
      aedTotal: 4,
    }), { paidInr: 0, paidAed: 4, remainingInr: 100 });
  });

  it('booked INR/AED for split is the two legs, not the full totals', () => {
    assert.equal(
      bookedMetalInr({
        paymentMethod: 'SPLIT',
        inrTotal: 10_000_000,
        labTotalInr: 0,
        splitInrPaid: 5_000_000,
      }),
      5_000_000,
    );
    assert.equal(
      bookedMetalInr({
        paymentMethod: 'SPLIT',
        inrTotal: 14_000_000,
        labTotalInr: 1_000,
        splitInrPaid: 3_999_000,
      }),
      3_999_000,
    );
    assert.equal(
      bookedMetalAed({
        paymentMethod: 'SPLIT',
        aedTotal: 350_000,
        splitAedPaid: 175_000,
      }),
      175_000,
    );
    assert.equal(bookedMetalInr({ paymentMethod: 'AED', inrTotal: 10_000_000 }), 0);
    assert.equal(bookedMetalAed({ paymentMethod: 'CASH', aedTotal: 350_000 }), 0);
  });

  it('rejects SPLIT legs when stored amounts are missing', () => {
    assert.throws(
      () =>
        resolveDealSplitLegs({
          paymentMethod: 'SPLIT',
          grossInr: 100,
          aedTotal: 10,
          splitInrPaid: 0,
          splitAedPaid: 0,
        }),
      /missing/i,
    );
  });

  it('split adds IC units from INR-paid share only', () => {
    assert.equal(
      metalInrSaleIcUnitsFromFields({
        settlementMode: 'metal',
        metalPaymentMethod: 'SPLIT',
        units: 1000,
        inrTotal: 10_000_000,
        labTotalInr: 0,
        splitInrPaid: 5_000_000,
      }),
      50,
    );
    assert.equal(
      metalInrSaleIcUnitsFromFields({
        settlementMode: 'metal',
        metalPaymentMethod: 'AED',
        units: 1000,
      }),
      0,
    );
  });
});
