export type WarehouseNavPageId =
  | 'settlement'
  | 'delivery-agents'
  | 'order-settlement';

export type WarehouseNavPage = {
  id: WarehouseNavPageId;
  label: string;
  path: string;
};

export const WAREHOUSE_NAV: WarehouseNavPage[] = [
  { id: 'settlement', label: 'Order Fulfillment', path: '' },
  { id: 'delivery-agents', label: 'Delivery Agents', path: '/delivery-agents' },
  { id: 'order-settlement', label: 'Delivery Settlement', path: '/order-settlement' },
];
