import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMetalFieldChange,
  computeMetalRateInrFromTotal,
  computeMetalAedFromInr,
  computeMetalSheetRateAed,
  grossMetalAedFromNetBooked,
  netMetalAedFromGrossBooked,
  metalSheetRateFromIcUnitRate,
  computeMetalTotalsFromWeight,
  deriveImputedUnitRateAed,
  deriveUnitsFromInrTotal,
  metalFieldsFromRecord,
  normalizeCashPurchase,
  normalizeMetalPurchase,
  normalizeMetalSale,
  resolveNormalizedPurchase,
} from './metalSettlement';

describe('metalSettlement', () => {
  it('derives units from INR total at 1 lakh per unit', () => {
    assert.equal(deriveUnitsFromInrTotal(100_000), 1);
    assert.equal(deriveUnitsFromInrTotal(250_000), 2.5);
  });

  it('prefills metal sheet RATE from cash IC WAC 1:1 (same ~36 field)', () => {
    assert.equal(metalSheetRateFromIcUnitRate(36.2), 36.2);
    assert.equal(metalSheetRateFromIcUnitRate(36.35), 36.35);
  });

  it('computes weight-based totals with sheet RATE (AED = INR × rate ÷ 1000)', () => {
    const { totalInr, totalAed } = computeMetalTotalsFromWeight(10.5, 5000, 220);
    assert.equal(totalInr, 52500);
    assert.equal(totalAed, 11550);
  });

  it('matches the client metal P&L sheet (AED = INR × RATE ÷ 1000)', () => {
    const { totalInr, totalAed } = computeMetalTotalsFromWeight(499.71, 13980, 36.23);
    assert.equal(totalInr, 6_985_945.8);
    assert.equal(totalAed, 253_100.82);
    assert.equal(computeMetalSheetRateAed(totalInr, totalAed), 36.23);

    const sale = computeMetalTotalsFromWeight(499.71, 14000, 36.35);
    assert.equal(sale.totalInr, 6_995_940);
    assert.equal(sale.totalAed, 254_302.42);
  });

  it('keeps RATE and recomputes AED when G rate changes', () => {
    const started = {
      ...metalFieldsFromRecord({
        metalWeightG: 499.71,
        metalRateInrPerG: 13980,
        inrTotal: 6_985_945.8,
        aedTotal: 253_100.82,
      }),
      metalSheetRateAed: 36.23,
    };
    const next = applyMetalFieldChange(started, 'rateInr', 14000);
    assert.equal(next.inrTotal, 6_995_940);
    assert.equal(next.metalSheetRateAed, 36.23);
    assert.equal(next.aedTotal, 253_462.91);
  });

  it('back-solves INR rate per gram from total', () => {
    assert.equal(computeMetalRateInrFromTotal(10, 50000), 5000);
  });

  it('normalizes metal purchase as grams (no IC units on the warehouse)', () => {
    const n = normalizeMetalPurchase({
      metalWeightG: 10,
      metalRateInrPerG: 5000,
      metalRateAedPerG: 220,
      totalInr: 50000,
      totalAed: 2200,
    }, { paymentMethod: 'AED' });
    assert.equal(n.units, 0);
    assert.equal(n.unitRate, 44);
    assert.equal(n.metalWeightG, 10);
    assert.equal(n.aedTotal, 2200);
    assert.equal(n.settlementMode, 'metal');
  });

  it('allows INR metal purchase with no AED total', () => {
    const n = normalizeMetalPurchase(
      {
        metalWeightG: 2000,
        metalRateInrPerG: 13500,
        metalRateAedPerG: 0,
        totalInr: 27_000_000,
        totalAed: 0,
      },
      { paymentMethod: 'CASH' },
    );
    assert.equal(n.metalPaymentMethod, 'CASH');
    assert.equal(n.aedTotal, null);
    assert.equal(n.inrTotal, 27_000_000);
  });

  it('resolves an INR metal purchase update without AED', () => {
    const n = resolveNormalizedPurchase({
      settlementMode: 'metal',
      metalPaymentMethod: 'CASH',
      metalWeightG: 2000,
      metalRateInrPerG: 13500,
      inrTotal: 27_000_000,
      aedTotal: 0,
    });
    assert.equal(n.settlementMode, 'metal');
    if (n.settlementMode !== 'metal') throw new Error('expected metal');
    assert.equal(n.metalPaymentMethod, 'CASH');
    assert.equal(n.aedTotal, null);
  });

  it('normalizes cash purchase (AED = units × RATE × 100)', () => {
    const n = normalizeCashPurchase({ units: 50, unitRate: 36.2 });
    assert.equal(n.aedTotal, 181_000);
    assert.equal(n.settlementMode, 'cash');
  });

  it('imputed sheet rate (AED ÷ units ÷ 100)', () => {
    assert.equal(deriveImputedUnitRateAed(2200, 0.5), 44);
  });

  it('metal cash sale stores IC units and sheet RATE (AED × 1000 ÷ INR)', () => {
    const n = normalizeMetalSale(
      {
        metalWeightG: 500,
        metalRateInrPerG: 14000,
        metalRateAedPerG: 0,
        totalInr: 7_000_000,
        totalAed: 245_000,
      },
      0,
      { paymentMethod: 'CASH' },
    );
    assert.equal(n.units, 70);
    assert.equal(n.unitRate, 35);
    assert.equal(n.aedAmount, 245_000);
    assert.equal(n.metalPaymentMethod, 'CASH');
  });

  it('metal AED sale keeps sheet RATE but does not add IC units', () => {
    const n = normalizeMetalSale(
      {
        metalWeightG: 1000,
        metalRateInrPerG: 14000,
        metalRateAedPerG: 0,
        totalInr: 14_000_000,
        totalAed: 504_000,
      },
      0,
      { paymentMethod: 'AED', aedAgentId: 'agent-1' },
    );
    assert.equal(n.units, 0);
    assert.equal(n.unitRate, 36);
    assert.equal(n.aedAmount, 504_000);
  });

  it('recomputes AED from sheet RATE when INR changes (AED = INR × rate ÷ 1000)', () => {
    const next = applyMetalFieldChange(
      {
        metalWeightG: 500,
        metalRateInrPerG: 14000,
        metalSheetRateAed: 35,
        metalRateAedPerG: 0,
        inrTotal: 7_000_000,
        aedTotal: 245_000,
      },
      'totalInr',
      11_000_000,
    );
    assert.equal(next.aedTotal, 385_000);
    assert.equal(next.metalSheetRateAed, 35);
  });

  it('stores gross AED and sheet RATE for metal purchase with lab', () => {
    const grossInr = 14_000_000;
    const lab = 1_000;
    const netInr = grossInr - lab;
    const rate = 36.5;
    const netAed = computeMetalAedFromInr(netInr, rate);
    const grossAed = grossMetalAedFromNetBooked(netAed, grossInr, lab);
    assert.equal(grossAed, computeMetalAedFromInr(grossInr, rate));
    const n = resolveNormalizedPurchase({
      settlementMode: 'metal',
      metalPaymentMethod: 'AED',
      metalWeightG: 1000,
      metalRateInrPerG: 14000,
      metalRateAedPerG: netAed / 1000,
      inrTotal: grossInr,
      aedTotal: grossAed,
      labTotalInr: lab,
      unitRate: rate,
    });
    if (n.settlementMode !== 'metal') throw new Error('expected metal');
    assert.equal(n.unitRate, rate);
    assert.equal(n.aedTotal, grossAed);
    assert.equal(netMetalAedFromGrossBooked(n.aedTotal ?? 0, grossInr, lab), netAed);
    const fields = metalFieldsFromRecord({
      inrTotal: grossInr,
      aedTotal: grossAed,
      unitRate: rate,
      labTotalInr: lab,
      metalWeightG: 1000,
    });
    assert.equal(fields.metalSheetRateAed, rate);
    assert.equal(fields.aedTotal, netAed);
  });
});
