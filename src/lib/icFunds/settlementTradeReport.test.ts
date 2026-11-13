import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isVoidIcSaleOrderStatus } from '@/lib/icFunds/icTransferReportFilters';
import {
  resolveTradeUnitRateAed,
  sliceSettlementTradeReport,
  summarizeSettlementTrades,
  tradeLineBookInr,
  type ICSettlementTradeLine,
  type ICSettlementTradeReport,
} from '@/lib/icFunds/settlementTradeReport';

function line(partial: Partial<ICSettlementTradeLine> & Pick<ICSettlementTradeLine, 'id' | 'txnKind'>): ICSettlementTradeLine {
  return {
    date: '2026-01-01',
    reference: 'R1',
    counterparty: 'Party',
    units: 1,
    unitRateAed: 0,
    aedTotal: 0,
    settlementLabel: 'metal',
    ...partial,
  };
}

describe('resolveTradeUnitRateAed', () => {
  it('uses stored unit rate when present', () => {
    assert.equal(resolveTradeUnitRateAed(50, 36, 1800), 36);
  });

  it('imputes cash RATE as AED ÷ units ÷ 100 when unit_rate is missing', () => {
    assert.equal(resolveTradeUnitRateAed(50, 0, 181_000), 36.2);
  });
});

describe('isVoidIcSaleOrderStatus', () => {
  it('treats cancelled and draft as void', () => {
    assert.equal(isVoidIcSaleOrderStatus('cancelled'), true);
    assert.equal(isVoidIcSaleOrderStatus('pending'), true);
  });

  it('keeps in-flight and completed sales', () => {
    assert.equal(isVoidIcSaleOrderStatus('completed'), false);
    assert.equal(isVoidIcSaleOrderStatus('wh_processing'), false);
  });
});

describe('sliceSettlementTradeReport', () => {
  const inrBuy = line({
    id: 'p-inr',
    txnKind: 'purchase',
    metalPaymentMethod: 'INR',
    inrTotal: 1000,
    aedTotal: 50,
    metalWeightG: 10,
  });
  const aedBuy = line({
    id: 'p-aed',
    txnKind: 'purchase',
    metalPaymentMethod: 'AED',
    inrTotal: 2000,
    aedTotal: 80,
    metalWeightG: 8,
  });
  const inrSell = line({
    id: 's-inr',
    txnKind: 'sale',
    metalPaymentMethod: 'INR',
    inrTotal: 1300,
    aedTotal: 40,
    metalWeightG: 10,
    bookedCurrency: 'INR',
    bookedProfitInr: 300,
    bookedProfit: 300,
  });
  const aedSell = line({
    id: 's-aed',
    txnKind: 'sale',
    metalPaymentMethod: 'AED',
    inrTotal: 500,
    aedTotal: 90,
    metalWeightG: 8,
    bookedCurrency: 'AED',
    bookedProfitAed: 10,
  });

  const report: ICSettlementTradeReport = {
    settlementMode: 'metal',
    purchases: [inrBuy, aedBuy],
    sales: [inrSell, aedSell],
    summary: summarizeSettlementTrades([inrBuy, aedBuy], [inrSell, aedSell]),
  };

  it('keeps cash metal INR apart from agent AED and does not mix totals', () => {
    const inr = sliceSettlementTradeReport(report, 'inr');
    assert.equal(inr.purchases.length, 1);
    assert.equal(inr.sales.length, 1);
    assert.equal(inr.summary.purchaseInr, 1000);
    assert.equal(inr.summary.saleInr, 1300);
    assert.equal(inr.summary.bookedInrProfit, 300);
    assert.equal(inr.summary.purchaseAed, 0);
    assert.equal(inr.summary.saleAed, 0);

    const aed = sliceSettlementTradeReport(report, 'aed');
    assert.equal(aed.purchases.length, 1);
    assert.equal(aed.sales.length, 1);
    assert.equal(aed.summary.purchaseAed, 80);
    assert.equal(aed.summary.saleAed, 90);
    assert.equal(aed.summary.purchaseInr, 0);
    assert.equal(aed.summary.saleInr, 0);
  });

  const splitBuy = line({
    id: 'p-split',
    txnKind: 'purchase',
    metalPaymentMethod: 'SPLIT',
    inrTotal: 10_000_000,
    aedTotal: 350_000,
    splitInrPaid: 4_000_000,
    splitAedPaid: 140_000,
    metalWeightG: 100,
  });
  const splitSell = line({
    id: 's-split',
    txnKind: 'sale',
    metalPaymentMethod: 'SPLIT',
    inrTotal: 12_000_000,
    aedTotal: 400_000,
    splitInrPaid: 5_000_000,
    splitAedPaid: 175_000,
    metalWeightG: 100,
  });

  it('tradeLineBookInr uses split leg not deal net for SPLIT rows', () => {
    const row = line({
      id: 's-split',
      txnKind: 'sale',
      metalPaymentMethod: 'SPLIT',
      inrTotal: 9_900_000,
      splitInrPaid: 5_000_000,
      splitAedPaid: 175_000,
    });
    assert.equal(tradeLineBookInr(row), 5_000_000);
    assert.notEqual(tradeLineBookInr(row), row.inrTotal);
  });

  it('split rows use INR paid and AED paid legs per book', () => {
    const report: ICSettlementTradeReport = {
      settlementMode: 'metal',
      purchases: [splitBuy],
      sales: [splitSell],
      summary: summarizeSettlementTrades([splitBuy], [splitSell]),
    };
    const inr = sliceSettlementTradeReport(report, 'inr');
    assert.equal(inr.summary.purchaseInr, 4_000_000);
    assert.equal(inr.summary.saleInr, 5_000_000);
    assert.equal(inr.summary.purchaseAed, 0);
    const aed = sliceSettlementTradeReport(report, 'aed');
    assert.equal(aed.summary.purchaseAed, 140_000);
    assert.equal(aed.summary.saleAed, 175_000);
    assert.equal(aed.summary.purchaseInr, 0);
  });

  it('leaves cash IC fund reports unchanged', () => {
    const fund: ICSettlementTradeReport = {
      settlementMode: 'cash',
      purchases: [line({ id: 'p', txnKind: 'purchase', aedTotal: 100 })],
      sales: [line({ id: 's', txnKind: 'sale', aedTotal: 150 })],
      summary: summarizeSettlementTrades(
        [line({ id: 'p', txnKind: 'purchase', aedTotal: 100 })],
        [line({ id: 's', txnKind: 'sale', aedTotal: 150 })],
      ),
    };
    const sliced = sliceSettlementTradeReport(fund, 'inr');
    assert.equal(sliced.purchases.length, 1);
    assert.equal(sliced.summary.purchaseAed, 100);
  });
});
