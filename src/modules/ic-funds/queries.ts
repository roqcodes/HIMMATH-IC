export const icFundsKeys = {
  all: ['ic-funds'] as const,
  vouchers: (branchId: string, type: string) => [...icFundsKeys.all, 'vouchers', branchId, type] as const,
  accounts: (branchId: string) => [...icFundsKeys.all, 'accounts', branchId] as const,
};
