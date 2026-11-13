import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRADE_NAME } from '@/lib/brand';
import {
  buildPurchaseInvoice,
  buildSaleInvoice,
  type DealInvoiceBuildContext,
} from '@/lib/icTransfer/dealInvoice';
import { buildDealInvoicePdf } from '@/lib/icTransfer/dealInvoicePdf';
import type { ICPurchase, ICSale } from '@/types';

const ctx: DealInvoiceBuildContext = {
  issuer: { name: TRADE_NAME, addressLines: ['Al Sahara Street'], phone: '+971 50 000 0000', logoUrl: '/logo.png' },
  branchName: 'Main Branch',
  warehouseName: 'Store Vault',
  partyName: 'Zak Gold',
};

describe('deal invoices', () => {
  it('cash-metal purchase invoices booked INR net of lab, not memo AED', () => {
    const purchase: ICPurchase = {
      id: 'aaaa1111-bbbb-cccc-dddd-eeeeffff0001',
      settlementMode: 'metal',
      metalPaymentMethod: 'CASH',
      unitRate: 0,
      units: 0,
      metalWeightG: 1000,
      metalRateInrPerG: 30000,
      inrTotal: 3_00_00_000,
      labTotalInr: 24_000,
      aedTotal: 1_184_000,
    };
    const doc = buildPurchaseInvoice(purchase, ctx);
    assert.equal(doc.kind, 'purchase');
    assert.equal(doc.book, 'metal');
    assert.equal(doc.currency, 'INR');
    assert.equal(doc.titleEn, 'Purchase Receipt');
    assert.match(doc.totalBarValue, /2,99,76,000/);
    assert.doesNotMatch(JSON.stringify(doc), /1,184,000/);
    const pdf = buildDealInvoicePdf(doc);
    assert.ok(pdf.byteLength > 500);
    assert.equal(String.fromCharCode(...pdf.slice(0, 5)), '%PDF-');
  });

  it('IC cash sale invoices booked AED', () => {
    const sale: ICSale = {
      id: 'bbbb2222-cccc-dddd-eeee-ffff00001111',
      customerName: 'Ronak',
      settlementMode: 'cash',
      units: 1,
      unitRate: 10,
      aedAmount: 1000,
    };
    const doc = buildSaleInvoice(sale, { ...ctx, partyName: 'Ronak' });
    assert.equal(doc.book, 'ic');
    assert.equal(doc.currency, 'AED');
    assert.match(doc.totalBarValue, /AED 1,000/);
    assert.equal(doc.titleEn, 'Sale Receipt');
  });
});
