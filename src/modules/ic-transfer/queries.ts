export const icTransferKeys = {
  all: ['ic-transfer'] as const,
  sales: (branchId?: string) => [...icTransferKeys.all, 'sales', branchId] as const,
  orders: (branchId?: string) => [...icTransferKeys.all, 'orders', branchId] as const,
};
