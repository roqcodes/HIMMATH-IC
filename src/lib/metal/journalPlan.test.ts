import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planMetalPurchaseJournals, planMetalSaleJournals } from './journalPlan';

describe('planMetalPurchaseJournals', () => {
  it('CASH buy: stock vs supplier then lab discount', () => {
    const lines = planMetalPurchaseJournals({
      paymentMethod: 'CASH',
      grossInr: 3_00_00_000,
      labInr: 12_000,
      aedTotal: 0,
      hasAgent: false,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.amount, l.book]),
      [
        ['metal_purchase', 'metal_stock', 'supplier', 3_00_00_000, 'INR'],
        ['lab_test_purchase', 'supplier', 'metal_stock', 12_000, 'INR'],
      ],
    );
  });

  it('CASH buy without lab is a single stock line', () => {
    const lines = planMetalPurchaseJournals({
      paymentMethod: 'CASH',
      grossInr: 100,
      labInr: 0,
      aedTotal: 9_999,
      hasAgent: true,
    });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].referenceType, 'metal_purchase');
  });

  it('AED buy: INR stock + lab, then AED pay agent', () => {
    const lines = planMetalPurchaseJournals({
      paymentMethod: 'AED',
      grossInr: 3_00_00_000,
      labInr: 12_000,
      aedTotal: 50_000,
      hasAgent: true,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.amount, l.book]),
      [
        ['metal_purchase', 'metal_stock', 'aed_settlement', 3_00_00_000, 'INR'],
        ['lab_test_purchase', 'aed_settlement', 'metal_stock', 12_000, 'INR'],
        ['metal_purchase_aed', 'metal_aed', 'agent', 50_000, 'AED'],
      ],
    );
  });

  it('AED buy without agent posts nothing', () => {
    const lines = planMetalPurchaseJournals({
      paymentMethod: 'AED',
      grossInr: 1,
      labInr: 1,
      aedTotal: 50_000,
      hasAgent: false,
    });
    assert.equal(lines.length, 0);
  });
});

describe('planMetalSaleJournals', () => {
  it('skips journals until completed', () => {
    const lines = planMetalSaleJournals({
      completed: false,
      paymentMethod: 'CASH',
      lotPaymentMethod: 'CASH',
      hasLot: true,
      saleGrossInr: 3_20_00_000,
      saleLabInr: 24_000,
      saleAed: 0,
      lotCostInrAllocated: 2_99_88_000,
      hasAgent: false,
    });
    assert.equal(lines.length, 0);
  });

  it('CASH sale of CASH lot: bill, lab, cost, profit', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'CASH',
      lotPaymentMethod: 'CASH',
      hasLot: true,
      saleGrossInr: 3_20_00_000,
      saleLabInr: 24_000,
      saleAed: 0,
      lotCostInrAllocated: 2_99_88_000,
      hasAgent: false,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.amount]),
      [
        ['metal_sale_receipt', 'customer', 'metal_sales', 3_20_00_000],
        ['lab_test_sale', 'metal_sales', 'customer', 24_000],
        ['metal_sale_cogs', 'metal_cost', 'metal_stock', 2_99_88_000],
        ['metal_sale_profit', 'metal_sales', 'metal_profit', 19_88_000],
      ],
    );
  });

  it('CASH sale loss credits cost of metal sold', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'CASH',
      lotPaymentMethod: 'CASH',
      hasLot: true,
      saleGrossInr: 90,
      saleLabInr: 10,
      saleAed: 0,
      lotCostInrAllocated: 100,
      hasAgent: false,
    });
    const profit = lines.find(l => l.referenceType === 'metal_sale_profit');
    assert.ok(profit);
    assert.equal(profit.debit, 'metal_profit');
    assert.equal(profit.credit, 'metal_cost');
    assert.equal(profit.amount, 20);
    assert.equal(profit.label, 'Metal loss');
  });

  it('CASH sale of AED lot: COGS from allocated INR cost, profit is margin', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'CASH',
      lotPaymentMethod: 'AED',
      hasLot: true,
      saleGrossInr: 1_000,
      saleLabInr: 0,
      saleAed: 40,
      lotCostInrAllocated: 900,
      hasAgent: true,
    });
    assert.deepEqual(
      lines.map(l => l.referenceType),
      ['metal_sale_receipt', 'metal_sale_cogs', 'metal_sale_profit'],
    );
    assert.equal(lines.find(l => l.referenceType === 'metal_sale_profit')?.amount, 100);
    assert.ok(!lines.some(l => l.book === 'AED'));
  });

  it('CASH sale with no lot posts bill and treats all as profit', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'CASH',
      lotPaymentMethod: null,
      hasLot: false,
      saleGrossInr: 500,
      saleLabInr: 0,
      saleAed: 0,
      lotCostInrAllocated: 400,
      hasAgent: false,
    });
    assert.ok(!lines.some(l => l.referenceType === 'metal_sale_cogs'));
    assert.equal(lines.find(l => l.referenceType === 'metal_sale_profit')?.amount, 500);
  });

  it('AED sale of CASH lot: agent AED + full INR P&L', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'AED',
      lotPaymentMethod: 'CASH',
      hasLot: true,
      saleGrossInr: 3_20_00_000,
      saleLabInr: 24_000,
      saleAed: 12_000,
      lotCostInrAllocated: 2_99_88_000,
      hasAgent: true,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.book]),
      [
        ['metal_sale_aed', 'agent', 'metal_aed', 'AED'],
        ['metal_sale_receipt', 'aed_settlement', 'metal_sales', 'INR'],
        ['lab_test_sale', 'metal_sales', 'aed_settlement', 'INR'],
        ['metal_sale_cogs', 'metal_cost', 'metal_stock', 'INR'],
        ['metal_sale_profit', 'metal_sales', 'metal_profit', 'INR'],
      ],
    );
    assert.equal(lines.find(l => l.referenceType === 'metal_sale_profit')?.amount, 19_88_000);
  });

  it('AED sale of AED lot: agent collection + INR revenue, COGS, margin profit', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'AED',
      lotPaymentMethod: 'AED',
      hasLot: true,
      saleGrossInr: 1_000,
      saleLabInr: 50,
      saleAed: 40,
      lotCostInrAllocated: 900,
      hasAgent: true,
    });
    assert.deepEqual(lines.map(l => l.referenceType), [
      'metal_sale_aed',
      'metal_sale_receipt',
      'lab_test_sale',
      'metal_sale_cogs',
      'metal_sale_profit',
    ]);
    assert.equal(lines.find(l => l.referenceType === 'metal_sale_profit')?.amount, 50);
  });
});
