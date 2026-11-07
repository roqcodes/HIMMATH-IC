import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { simulateWarehouseInventory, type WarehouseInventoryEvent } from './warehouseProfit';
import { buildIcStockInventoryEvents } from '@/lib/icTransfer/dealProfit';
import type { ICPurchase, ICSale } from '@/types';

describe('simulateWarehouseInventory', () => {
  it('same-day purchase after sale timestamp still applies WAC to sale', () => {
    const day = new Date('2026-11-07T08:00:00.000Z').getTime();
    const events: WarehouseInventoryEvent[] = [
      {
        kind: 'sale',
        at: day + 1_000,
        sortKey: 'sale-1',
        saleId: 'sale-1',
        units: 100,
        collectedUnits: null,
        unitRate: 3650,
        aedAmount: 365_000,
        serviceCharge: 0,
      },
      {
        kind: 'purchase',
        at: day + 60_000,
        sortKey: 'pur-1',
        units: 100,
        cost: 364_000,
      },
    ];

    const { saleMargins } = simulateWarehouseInventory(events);
    const margin = saleMargins.get('sale-1');
    assert.ok(margin);
    assert.equal(margin!.cogs, 364_000);
    assert.equal(margin!.grossProfit, 1_000);
  });

  it('report IC pool matches warehouse computeDealProfit (metal INR inflow + cash sale)', () => {
    const purchases: ICPurchase[] = [
      {
        id: 'p-cash',
        warehouseId: 'ksd',
        units: 100,
        unitRate: 36.4,
        aedTotal: 364_000,
        settlementMode: 'cash',
        createdAt: '2026-11-07T10:00:00.000Z',
      },
    ];
    const sales: ICSale[] = [
      {
        id: 's-cash',
        customerName: 'BAVA',
        warehouseId: 'ksd',
        units: 100,
        unitRate: 36.5,
        aedAmount: 365_000,
        settlementMode: 'cash',
        orderStatus: 'completed',
        createdAt: '2026-11-07T09:00:00.000Z',
      },
    ];
    const events = buildIcStockInventoryEvents(purchases, sales);
    const { saleMargins } = simulateWarehouseInventory(events);
    const margin = saleMargins.get('s-cash');
    assert.ok(margin);
    assert.equal(margin!.cogs, 364_000);
    assert.equal(margin!.grossProfit, 1_000);
  });

  it('oversell after stock is gone still uses last WAC', () => {
    const t0 = new Date('2026-11-01T00:00:00.000Z').getTime();
    const events: WarehouseInventoryEvent[] = [
      { kind: 'purchase', at: t0, sortKey: 'p1', units: 100, cost: 364_000 },
      {
        kind: 'sale',
        at: t0 + 1,
        sortKey: 's1',
        saleId: 's1',
        units: 100,
        collectedUnits: null,
        unitRate: 36.5,
        aedAmount: 365_000,
        serviceCharge: 0,
      },
      {
        kind: 'sale',
        at: t0 + 86_400_000,
        sortKey: 's2',
        saleId: 's2',
        units: 50,
        collectedUnits: null,
        unitRate: 36.5,
        aedAmount: 182_500,
        serviceCharge: 0,
      },
    ];
    const { saleMargins } = simulateWarehouseInventory(events);
    const first = saleMargins.get('s1');
    const oversell = saleMargins.get('s2');
    assert.ok(first && oversell);
    assert.equal(first!.cogs, 364_000);
    assert.equal(oversell!.cogs, 182_000);
    assert.equal(oversell!.grossProfit, 500);
  });
});
