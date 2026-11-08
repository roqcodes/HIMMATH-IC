export const CAPITAL_SETTINGS_ID = 'hq';

export const HOUSE_INVESTOR_ID = 'ICINV-HOUSE';

/** Default management-share receiver and opening-capital holder (HQ ledger). */
export const HQ_INVESTOR_NAME = 'HQ';

export const CAPITAL_MOVEMENT_TYPES = ['opening', 'deposit', 'withdraw', 'payout'] as const;
export type CapitalMovementType = (typeof CAPITAL_MOVEMENT_TYPES)[number];

export const CAPITAL_ALLOCATION_KINDS = ['profit', 'expense', 'management', 'payout'] as const;
export type CapitalAllocationKind = (typeof CAPITAL_ALLOCATION_KINDS)[number];

export const CAPITAL_REF_OPENING = 'capital_opening';
export const CAPITAL_REF_DEPOSIT = 'capital_deposit';
export const CAPITAL_REF_WITHDRAW = 'capital_withdraw';
export const CAPITAL_REF_PAYOUT = 'capital_payout';

/** System references that must not trigger capital allocation on manual vouchers. */
export const CAPITAL_SKIP_ALLOCATION_REFERENCE_TYPES = new Set([
  'ic_sale_cogs',
  'ic_purchase_cost',
  'metal_cost',
  'metal_sale_cogs',
  'capital_opening',
  'capital_deposit',
  'capital_withdraw',
  'capital_payout',
]);
