/** Branch portal customer profile — matches CustomersPage navigation. */
export function customerProfilePath(branchSlug: string, customerId: string): string {
  return `/branch/${branchSlug}/customers/${customerId}`;
}
