/** Default page size for journal / voucher list views. */
export const VOUCHER_LIST_PAGE_SIZE = 20;

/** Hard cap for report exports and internal bulk reads. */
export const VOUCHER_REPORT_MAX = 2000;

/** List-view columns only — excludes reference metadata and void audit fields. */
export const VOUCHER_LIST_SELECT_COLUMNS = `
  v.id,
  v.branch_id,
  v.voucher_no,
  v.voucher_type,
  v.voucher_date,
  v.debit_account_id,
  v.credit_account_id,
  v.amount,
  v.notes,
  v.created_by,
  v.created_by_name,
  v.created_by_user_id,
  v.created_at,
  v.status,
  da.name AS debit_account_name,
  da.account_type AS debit_account_type,
  ca.name AS credit_account_name,
  ca.account_type AS credit_account_type
`;

/** Detail / statement columns — still omits version and idempotency_key. */
export const VOUCHER_DETAIL_SELECT_COLUMNS = `
  ${VOUCHER_LIST_SELECT_COLUMNS},
  v.voided_at,
  v.voided_by_name,
  v.reference_type,
  v.reference_id
`;

export const VOUCHER_FROM_SQL = `
FROM ic_fund_vouchers v
JOIN ic_fund_accounts da ON da.id = v.debit_account_id
JOIN ic_fund_accounts ca ON ca.id = v.credit_account_id
`;

export const VOUCHER_LIST_SELECT_SQL = `
SELECT ${VOUCHER_LIST_SELECT_COLUMNS}
${VOUCHER_FROM_SQL}
`;

export const VOUCHER_DETAIL_SELECT_SQL = `
SELECT ${VOUCHER_DETAIL_SELECT_COLUMNS}
${VOUCHER_FROM_SQL}
`;

export type VoucherListFilter = {
  branchId: string;
  voucherType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
};

export function buildVoucherListFilter(
  filter: VoucherListFilter,
  startIdx = 1,
): { clauses: string[]; values: unknown[]; nextIdx: number } {
  const clauses = [`v.branch_id = $${startIdx}`];
  const values: unknown[] = [filter.branchId];
  let idx = startIdx + 1;

  if (filter.voucherType) {
    clauses.push(`v.voucher_type = $${idx}`);
    values.push(filter.voucherType);
    idx += 1;
  }
  if (filter.startDate) {
    clauses.push(`v.voucher_date >= $${idx}`);
    values.push(filter.startDate);
    idx += 1;
  }
  if (filter.endDate) {
    clauses.push(`v.voucher_date <= $${idx}`);
    values.push(filter.endDate);
    idx += 1;
  }
  if (filter.search?.trim()) {
    clauses.push(
      `(da.name ILIKE $${idx} OR ca.name ILIKE $${idx} OR v.notes ILIKE $${idx} OR CAST(v.voucher_no AS TEXT) ILIKE $${idx})`,
    );
    values.push(`%${filter.search.trim()}%`);
    idx += 1;
  }

  return { clauses, values, nextIdx: idx };
}

export function clampVoucherListLimit(limit?: number): number {
  if (limit == null) return VOUCHER_LIST_PAGE_SIZE;
  if (limit <= 0) return VOUCHER_LIST_PAGE_SIZE;
  return Math.min(Math.floor(limit), VOUCHER_REPORT_MAX);
}

export function clampVoucherListOffset(offset?: number): number {
  if (offset == null || offset < 0) return 0;
  return Math.floor(offset);
}
