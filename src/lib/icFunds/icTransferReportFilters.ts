/** Order statuses excluded from IC trade registers (rejected, cancelled, draft). */
export const IC_SALE_VOID_ORDER_STATUSES = [
  'pending',
  'pending_branch_review',
  'branch_rejected',
  'admin_rejected',
  'wh_rejected',
  'da_rejected',
  'cancelled',
  'cancellation_pending',
] as const;

const SQL_LIST = IC_SALE_VOID_ORDER_STATUSES.map(s => `'${s}'`).join(', ');

/** Append to ic_sales queries — keeps in-flight and completed deals, drops void/rejected. */
export function sqlExcludeVoidIcSales(alias = 's'): string {
  return `AND ${alias}.order_status NOT IN (${SQL_LIST})`;
}

export function isVoidIcSaleOrderStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  return (IC_SALE_VOID_ORDER_STATUSES as readonly string[]).includes(status);
}
