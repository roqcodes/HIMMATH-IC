'use client';

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { ICSale } from '@/types';
import {
  adminAcceptICSaleAction,
  adminRejectICSaleAction,
  adminReassignICSaleWarehouseAction,
  adminApproveCancelICSaleAction,
  adminDeclineCancelICSaleAction,
  adminVerifyDeliveryAction,
} from '@/app/actions/icTransferActions';
import {
  canAdminAccept,
  canAdminReject,
  canAdminReassignWarehouse,
  canAdminVerifyDelivery,
  getAdminStatusLabel,
  getAdminStatusStyle,
  isAdminAcceptRejectReviewStatus,
  normalizeOrderStatus,
} from '@/lib/icTransfer/orderStatus';
import { canAdminResolveBranchCancellation, canAdminResolveCustomerCancellation } from '@/lib/icTransfer/orderWorkflowRules';
import { getOrderStatusDescription } from '@/lib/icTransfer/orderStatusDescriptions';
import RejectRemarkModal from './RejectRemarkModal';
import { ConfirmModal } from '@/components/warehouse/shared';
import {
  OrderWorkflowActionStack,
  WorkflowActionButton,
  WorkflowNotice,
  OrderStatusCard,
  IconCheck,
  IconX,
  IconRefresh,
  IconBan,
} from './orderWorkflow';
import ByHandAdminActions, { ByHandAdminNotice } from './ByHandAdminActions';
import { isByHandSale } from '@/lib/icTransfer/byHand';
import { isBranchHandledSale } from '@/lib/icTransfer/fulfillmentHandler';
import { canPerformICTransferAdminActions } from '@/lib/rbac';
import { filterWarehousesForAssignableUser } from '@/lib/icTransfer/branchPortalScope';
import WarehouseAssignPicker, { initialWarehouseSelection } from './WarehouseAssignPicker';
import { btnPrimary, btnSecondary } from '@/lib/ui';

type SharedProps = {
  sale: ICSale;
  onUpdated?: () => void;
};

function getRemarksVariant(status?: string | null) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === 'da_rejected') return 'warning' as const;
  if (normalized === 'admin_rejected' || normalized === 'wh_rejected' || normalized === 'branch_rejected') {
    return 'danger' as const;
  }
  return 'info' as const;
}

/** Status + remarks card for the Status column. */
export function AdminOrderStatusCard({
  sale,
  compact = true,
  className,
}: {
  sale: ICSale;
  compact?: boolean;
  className?: string;
}) {
  return (
    <OrderStatusCard
      label={getAdminStatusLabel(sale.orderStatus, sale.transactionType)}
      statusStyle={getAdminStatusStyle(sale.orderStatus, sale.transactionType)}
      flowDescription={getOrderStatusDescription(sale, 'admin')}
      remarks={sale.rejectionRemarks}
      remarksVariant={getRemarksVariant(sale.orderStatus)}
      compact={compact}
      className={className}
    />
  );
}

/** Workflow action buttons + modals for the Status column or detail panels. */
export function AdminOrderWorkflowActions({ sale, onUpdated, compact = true }: SharedProps & { compact?: boolean }) {
  const { icWarehouses, icRegions, showToast, refetchData, currentSlug, user } = useApp();
  const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
  const assignableWarehouses = useMemo(
    () => filterWarehousesForAssignableUser(icWarehouses, user),
    [icWarehouses, user],
  );
  const regionNameById = useMemo(() => new Map(icRegions.map(r => [r.id, r.name])), [icRegions]);
  const getRegionLabel = (regionId?: string) => (regionId ? regionNameById.get(regionId) : undefined);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveCancelOpen, setApproveCancelOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(sale.warehouseId || '');
  const [loading, setLoading] = useState(false);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      showToast('Please select a warehouse', 'error');
      return;
    }
    setLoading(true);
    const res = await adminAcceptICSaleAction(sale.id, warehouseId, branchSlug);
    setLoading(false);
    if (res.success) {
      showToast('Order accepted and warehouse assigned', 'success');
      setAcceptOpen(false);
      await refetchData();
      onUpdated?.();
    } else {
      showToast(res.error || 'Failed to accept order', 'error');
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      showToast('Please select a warehouse', 'error');
      return;
    }
    setLoading(true);
    const res = await adminReassignICSaleWarehouseAction(sale.id, warehouseId, branchSlug);
    setLoading(false);
    if (res.success) {
      showToast('Warehouse reassigned successfully', 'success');
      setReassignOpen(false);
      await refetchData();
      onUpdated?.();
    } else {
      showToast(res.error || 'Failed to reassign warehouse', 'error');
    }
  };

  const handleReject = async (remarks: string) => {
    setLoading(true);
    const res = await adminRejectICSaleAction(sale.id, remarks, branchSlug);
    setLoading(false);
    if (res.success) {
      showToast('Order rejected', 'success');
      setRejectOpen(false);
      await refetchData();
      onUpdated?.();
    } else {
      showToast(res.error || 'Failed to reject order', 'error');
    }
  };

  const handleApproveCancel = async () => {
    setLoading(true);
    const res = await adminApproveCancelICSaleAction(sale.id, branchSlug);
    setLoading(false);
    if (res.success) {
      showToast('Cancellation approved — order cancelled', 'success');
      setApproveCancelOpen(false);
      await refetchData();
      onUpdated?.();
    } else {
      showToast(res.error || 'Failed to approve cancellation', 'error');
    }
  };

  const handleDeclineCancel = async () => {
    setLoading(true);
    const res = await adminDeclineCancelICSaleAction(sale.id, branchSlug);
    setLoading(false);
    if (res.success) {
      showToast('Cancellation declined — order restored', 'success');
      await refetchData();
      onUpdated?.();
    } else {
      showToast(res.error || 'Failed to decline cancellation', 'error');
    }
  };

  const handleVerifyDelivery = async () => {
    setLoading(true);
    const res = await adminVerifyDeliveryAction(sale.id, branchSlug);
    setLoading(false);
    if (res.success) {
      showToast('Delivery verified — order completed for customer', 'success');
      setVerifyOpen(false);
      await refetchData();
      onUpdated?.();
    } else {
      showToast(res.error || 'Failed to verify delivery', 'error');
    }
  };

  const showAccept = canAdminAccept(sale.orderStatus);
  const showReject = canAdminReject(sale.orderStatus);
  const showReassign = canAdminReassignWarehouse(sale.orderStatus);
  const showResolveCancel =
    canAdminResolveBranchCancellation(sale) || canAdminResolveCustomerCancellation(sale);
  const showVerifyDelivery = canAdminVerifyDelivery(sale.orderStatus);
  const showByHandActions = isByHandSale(sale);
  const branchHandled = isBranchHandledSale(sale);
  const hasStandardActions = showAccept || showReject || showReassign || showResolveCancel || showVerifyDelivery;
  const hasActions = canPerformICTransferAdminActions(user) && !branchHandled && (hasStandardActions || showByHandActions);

  if (!hasActions) return null;

  return (
    <>
      {hasStandardActions ? (
      <OrderWorkflowActionStack compact={compact}>
        {showAccept && (
          <WorkflowActionButton
            variant="success"
            icon={<IconCheck />}
            size={compact ? 'sm' : 'md'}
            onClick={e => {
              e.stopPropagation();
              setWarehouseId(initialWarehouseSelection(assignableWarehouses));
              setAcceptOpen(true);
            }}
          >
            Accept
          </WorkflowActionButton>
        )}
        {showReassign && (
          <WorkflowActionButton
            variant="secondary"
            icon={<IconRefresh />}
            size={compact ? 'sm' : 'md'}
            onClick={e => {
              e.stopPropagation();
              setWarehouseId(initialWarehouseSelection(assignableWarehouses, sale.warehouseId));
              setReassignOpen(true);
            }}
          >
            Reassign WH
          </WorkflowActionButton>
        )}
        {showReject && (
          <WorkflowActionButton
            variant="danger"
            icon={<IconX />}
            size={compact ? 'sm' : 'md'}
            onClick={e => { e.stopPropagation(); setRejectOpen(true); }}
          >
            Reject
          </WorkflowActionButton>
        )}
        {showResolveCancel && (
          <>
            <WorkflowActionButton
              variant="danger"
              icon={<IconBan />}
              size={compact ? 'sm' : 'md'}
              onClick={e => { e.stopPropagation(); setApproveCancelOpen(true); }}
            >
              Approve Cancel
            </WorkflowActionButton>
            <WorkflowActionButton
              variant="secondary"
              icon={<IconRefresh />}
              size={compact ? 'sm' : 'md'}
              onClick={e => { e.stopPropagation(); handleDeclineCancel(); }}
            >
              Keep Order
            </WorkflowActionButton>
          </>
        )}
        {showVerifyDelivery && (
          <WorkflowActionButton
            variant="success"
            icon={<IconCheck />}
            size={compact ? 'sm' : 'md'}
            onClick={e => { e.stopPropagation(); setVerifyOpen(true); }}
          >
            Verify Delivery
          </WorkflowActionButton>
        )}
      </OrderWorkflowActionStack>
      ) : null}

      {showByHandActions ? (
        <div className={compact ? 'mt-1.5' : 'mt-2'}>
          <ByHandAdminActions sale={sale} onUpdated={onUpdated} compact={compact} />
        </div>
      ) : null}

      <Modal
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        title="Accept Order & Assign Warehouse"
        maxWidth="max-w-md"
        footer={
          <div className="flex w-full justify-end gap-3">
            <button type="button" className={btnSecondary} onClick={() => setAcceptOpen(false)} disabled={loading}>Cancel</button>
            <button
              type="submit"
              form="accept-order-form"
              className={btnPrimary}
              disabled={loading || (assignableWarehouses.length > 0 && !warehouseId)}
            >
              {loading ? 'Processing...' : 'Accept Order'}
            </button>
          </div>
        }
      >
        <form id="accept-order-form" onSubmit={handleAccept} className="space-y-4">
          {isByHandSale(sale) ? <ByHandAdminNotice sale={sale} /> : null}
          {assignableWarehouses.length === 0 ? (
            <p className="text-sm text-amber-700">
              No warehouses configured for your scope. Add one from IC Transfer → Warehouse.
            </p>
          ) : (
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[var(--theme-text-muted)]">
                Warehouse
              </legend>
              <p className="-mt-1 mb-2 text-sm text-slate-600 dark:text-[var(--theme-text-secondary)]">
                Choose a warehouse to fulfill this order.
              </p>
              <WarehouseAssignPicker
                name="accept-order-warehouse"
                warehouses={assignableWarehouses}
                value={warehouseId}
                onChange={setWarehouseId}
                getRegionLabel={getRegionLabel}
                disabled={loading}
              />
            </fieldset>
          )}
        </form>
      </Modal>

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign Warehouse"
        maxWidth="max-w-md"
        footer={
          <div className="flex w-full justify-end gap-3">
            <button type="button" className={btnSecondary} onClick={() => setReassignOpen(false)} disabled={loading}>Cancel</button>
            <button
              type="submit"
              form="reassign-order-form"
              className={btnPrimary}
              disabled={loading || (assignableWarehouses.length > 0 && !warehouseId)}
            >
              {loading ? 'Processing...' : 'Reassign'}
            </button>
          </div>
        }
      >
        <form id="reassign-order-form" onSubmit={handleReassign} className="space-y-4">
          {sale.rejectionRemarks && (
            <WorkflowNotice variant="warning" title="Previous rejection">
              {sale.rejectionRemarks}
            </WorkflowNotice>
          )}
          {assignableWarehouses.length === 0 ? (
            <p className="text-sm text-amber-700">
              No warehouses configured for your scope. Add one from IC Transfer → Warehouse.
            </p>
          ) : (
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-[var(--theme-text-muted)]">
                Warehouse
              </legend>
              <p className="-mt-1 mb-2 text-sm text-slate-600 dark:text-[var(--theme-text-secondary)]">
                Select a different warehouse to continue processing.
              </p>
              <WarehouseAssignPicker
                name="reassign-order-warehouse"
                warehouses={assignableWarehouses}
                value={warehouseId}
                onChange={setWarehouseId}
                getRegionLabel={getRegionLabel}
                currentWarehouseId={sale.warehouseId}
                disabled={loading}
              />
            </fieldset>
          )}
        </form>
      </Modal>

      <RejectRemarkModal
        open={rejectOpen}
        loading={loading}
        title="Reject Order"
        description="Provide a reason for rejecting this order. The branch will see the order as rejected."
        onConfirm={handleReject}
        onCancel={() => setRejectOpen(false)}
      />

      <ConfirmModal
        open={approveCancelOpen}
        title="Approve Cancellation"
        message="Approve the branch's cancellation request? The order will be marked as cancelled and removed from active processing."
        confirmLabel="Approve Cancellation"
        variant="danger"
        loading={loading}
        onConfirm={handleApproveCancel}
        onCancel={() => setApproveCancelOpen(false)}
      />

      <ConfirmModal
        open={verifyOpen}
        title="Verify Delivery"
        message="Confirm delivery proof and mark this order as completed? The customer will see the order as delivered."
        confirmLabel="Verify Delivery"
        variant="success"
        loading={loading}
        onConfirm={handleVerifyDelivery}
        onCancel={() => setVerifyOpen(false)}
      />
    </>
  );
}

type PanelProps = SharedProps & {
  compact?: boolean;
};

function AdminOrderStatusStack({ sale, onUpdated, compact = true }: PanelProps) {
  const { user } = useApp();
  const hideStatusBadge =
    canPerformICTransferAdminActions(user) &&
    !isBranchHandledSale(sale) &&
    isAdminAcceptRejectReviewStatus(sale.orderStatus);

  return (
    <div
      className={[
        'flex flex-col',
        compact ? 'items-center gap-1.5' : 'items-stretch gap-3',
      ].join(' ')}
      onClick={e => e.stopPropagation()}
    >
      {!hideStatusBadge ? <AdminOrderStatusCard sale={sale} compact={compact} /> : null}
      <AdminOrderWorkflowActions sale={sale} onUpdated={onUpdated} compact={compact} />
    </div>
  );
}

/** Status badge + accept/reject (etc.) for the sales table Status column. */
export function AdminOrderStatusCell(props: PanelProps) {
  return <AdminOrderStatusStack {...props} compact={props.compact ?? true} />;
}

/** Full status panel for modals — card + actions stacked. */
export default function AdminOrderWorkflowPanel({ sale, onUpdated, compact = false }: PanelProps) {
  return <AdminOrderStatusStack sale={sale} onUpdated={onUpdated} compact={compact} />;
}
