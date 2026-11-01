import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isVoidIcSaleOrderStatus } from '@/lib/icFunds/icTransferReportFilters';
import { resolveTradeUnitRateAed } from '@/lib/icFunds/settlementTradeReport';

describe('resolveTradeUnitRateAed', () => {
  it('uses stored unit rate when present', () => {
    assert.equal(resolveTradeUnitRateAed(50, 36, 1800), 36);
  });

  it('imputes from AED total for metal rows', () => {
    assert.equal(resolveTradeUnitRateAed(50, 0, 1800), 36);
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
