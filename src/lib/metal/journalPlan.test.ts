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
        ['metal_purchase_aed', 'metal_aed', 'customer_aed', 50_000, 'AED'],
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
        ['metal_sale_aed', 'customer_aed', 'metal_aed_proceeds', 'AED'],
        ['metal_sale_receipt', 'aed_settlement', 'metal_sales', 'INR'],
        ['lab_test_sale', 'metal_sales', 'aed_settlement', 'INR'],
        ['metal_sale_cogs', 'metal_cost', 'metal_stock', 'INR'],
        ['metal_sale_profit', 'metal_sales', 'metal_profit', 'INR'],
      ],
    );
    assert.equal(lines.find(l => l.referenceType === 'metal_sale_profit')?.amount, 19_88_000);
    assert.ok(!lines.some(l => l.referenceType === 'metal_fx_profit'));
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
      lotPurchaseAedAllocated: 30,
      hasAgent: true,
    });
    assert.deepEqual(lines.map(l => l.referenceType), [
      'metal_sale_aed',
      'metal_fx_profit',
      'metal_sale_receipt',
      'lab_test_sale',
      'metal_sale_cogs',
      'metal_sale_profit',
    ]);
    assert.equal(lines.find(l => l.referenceType === 'metal_sale_profit')?.amount, 50);
    assert.equal(lines.find(l => l.referenceType === 'metal_fx_profit')?.amount, 10);
    assert.equal(lines.find(l => l.referenceType === 'metal_fx_profit')?.debit, 'metal_aed');
    assert.equal(lines.find(l => l.referenceType === 'metal_fx_profit')?.credit, 'metal_fx');
  });

  it('SPLIT sale without agent still posts party INR leg', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'SPLIT',
      hasLot: false,
      saleGrossInr: 14_000_000,
      saleLabInr: 1_000,
      saleAed: 350_000,
      lotCostInrAllocated: 0,
      hasAgent: false,
      splitInrPaid: 3_999_000,
      splitAedPaid: 175_000,
    });
    assert.ok(
      lines.some(
        l =>
          l.book === 'INR' &&
          l.referenceType === 'metal_sale_receipt' &&
          l.debit === 'customer' &&
          l.amount === 3_999_000,
      ),
    );
    assert.ok(!lines.some(l => l.book === 'AED'));
    assert.ok(
      lines.some(
        l => l.referenceType === 'lab_test_sale' && l.debit === 'metal_sales' && l.credit === 'aed_settlement',
      ),
    );
    assert.ok(!lines.some(l => l.credit === 'customer' && l.referenceType === 'lab_test_sale'));
  });

  it('SPLIT sale with lab keeps full split_inr_paid on customer', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'SPLIT',
      hasLot: true,
      saleGrossInr: 14_000_000,
      saleLabInr: 1_000,
      saleAed: 365_036.5,
      lotCostInrAllocated: 13_999_000,
      hasAgent: true,
      splitInrPaid: 3_999_000,
      splitAedPaid: 365_036.5,
    });
    const customerReceipt = lines.find(
      l => l.referenceType === 'metal_sale_receipt' && l.debit === 'customer',
    );
    assert.equal(customerReceipt?.amount, 3_999_000);
    assert.equal(lines.find(l => l.referenceType === 'lab_test_sale')?.amount, 1_000);
    assert.ok(!lines.some(l => l.credit === 'customer' && l.referenceType === 'lab_test_sale'));
    assert.ok(!lines.some(l => l.referenceType === 'metal_sale_profit'));
  });

  it('SPLIT sale: customer INR + agent AED + full INR P&L', () => {
    const lines = planMetalSaleJournals({
      completed: true,
      paymentMethod: 'SPLIT',
      lotPaymentMethod: 'CASH',
      hasLot: true,
      saleGrossInr: 10_000_000,
      saleLabInr: 0,
      saleAed: 350_000,
      lotCostInrAllocated: 9_000_000,
      hasAgent: true,
      splitInrPaid: 5_000_000,
      splitAedPaid: 175_000,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.amount, l.book]),
      [
        ['metal_sale_aed', 'customer_aed', 'metal_aed_proceeds', 175_000, 'AED'],
        ['metal_sale_receipt', 'customer', 'metal_sales', 5_000_000, 'INR'],
        ['metal_sale_receipt', 'aed_settlement', 'metal_sales', 5_000_000, 'INR'],
        ['metal_sale_cogs', 'metal_cost', 'metal_stock', 9_000_000, 'INR'],
        ['metal_sale_profit', 'metal_sales', 'metal_profit', 1_000_000, 'INR'],
      ],
    );
  });
});

describe('planMetalPurchaseJournals split', () => {
  it('SPLIT buy with lab: full lab on settlement', () => {
    const lines = planMetalPurchaseJournals({
      paymentMethod: 'SPLIT',
      grossInr: 10_000_000,
      labInr: 12_000,
      aedTotal: 350_000,
      hasAgent: true,
      splitInrPaid: 5_000_000,
      splitAedPaid: 175_000,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.amount, l.book]),
      [
        ['metal_purchase', 'metal_stock', 'supplier', 5_000_000, 'INR'],
        ['metal_purchase', 'metal_stock', 'aed_settlement', 5_000_000, 'INR'],
        ['lab_test_purchase', 'aed_settlement', 'metal_stock', 12_000, 'INR'],
        ['metal_purchase_aed', 'metal_aed', 'customer_aed', 175_000, 'AED'],
      ],
    );
  });

  it('SPLIT buy: supplier INR + agent AED', () => {
    const lines = planMetalPurchaseJournals({
      paymentMethod: 'SPLIT',
      grossInr: 10_000_000,
      labInr: 0,
      aedTotal: 350_000,
      hasAgent: true,
      splitInrPaid: 5_000_000,
      splitAedPaid: 175_000,
    });
    assert.deepEqual(
      lines.map(l => [l.referenceType, l.debit, l.credit, l.amount, l.book]),
      [
        ['metal_purchase', 'metal_stock', 'supplier', 5_000_000, 'INR'],
        ['metal_purchase', 'metal_stock', 'aed_settlement', 5_000_000, 'INR'],
        ['metal_purchase_aed', 'metal_aed', 'customer_aed', 175_000, 'AED'],
      ],
    );
  });
});
