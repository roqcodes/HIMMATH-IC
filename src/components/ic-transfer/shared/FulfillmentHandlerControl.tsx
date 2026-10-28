'use client';

import React from 'react';
import { ICSale } from '@/types';
import { useApp } from '@/context/AppContext';
import { isCustomerCreatedOrder } from '@/lib/icTransfer/fulfillmentHandler';
import { canAdminChangeFulfillmentHandler } from '@/lib/icTransfer/orderWorkflowRules';
import { isCustomerOrderPendingAtAdmin } from '@/lib/icTransfer/adminOnlyBranch';
import { canPerformICTransferAdminActions } from '@/lib/rbac';

type Props = {
  sale: ICSale;
  onUpdated?: () => void;
};

export default function FulfillmentHandlerControl({ sale }: Props) {
  const { user } = useApp();

  if (!canPerformICTransferAdminActions(user) || !isCustomerCreatedOrder(sale)) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }

  if (!canAdminChangeFulfillmentHandler(sale)) {
    if (isCustomerOrderPendingAtAdmin(sale)) {
      return (
        <span className="text-[10px] font-medium text-amber-700" title="Awaiting admin acceptance">
          Admin queue
        </span>
      );
    }
    return (
      <span className="text-[10px] text-slate-400" title="Handling locked after acceptance">
        Admin
      </span>
    );
  }

  return (
    <span className="text-[10px] font-medium text-slate-600" title="HQ admin fulfillment">
      Admin
    </span>
  );
}

export function FulfillmentHandlerBadge(_props: { sale: ICSale }) {
  return null;
}
