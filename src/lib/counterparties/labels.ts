/** Unified master-data page (customers + suppliers). */
export const COUNTERPARTIES_PAGE_TITLE = 'Counterparties';
export const COUNTERPARTIES_PAGE_SUBTITLE =
  'Trading partners — register once, use as customer on sales or supplier on purchases.';

/** Field labels in transaction modals (unchanged business roles). */
export const PURCHASE_COUNTERPARTY_FIELD_LABEL = 'Supplier';
export const SALE_COUNTERPARTY_FIELD_LABEL = 'Customer';

export type CounterpartyRole = 'customer' | 'supplier' | 'both';

export const COUNTERPARTY_ROLE_LABEL: Record<CounterpartyRole, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  both: 'Customer & supplier',
};
