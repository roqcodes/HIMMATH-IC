'use client';

import React from 'react';
import CustomerDetailPage from '@/components/customers/CustomerDetailPage';

export default function AdminCustomerDetailPageClient({ customerId }: { customerId: string }) {
  return <CustomerDetailPage key={customerId} />;
}
