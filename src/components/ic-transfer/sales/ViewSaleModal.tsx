'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { asicBtnOutline } from '@/components/asic/ui';
import { btnDangerOutline } from '@/lib/ui';
import { ICSale } from '@/types';
import { useApp } from '@/context/AppContext';
import { ConfirmModal } from '@/components/warehouse/shared';
import SalePriorityControl from '../shared/SalePriorityControl';
import FulfillmentHandlerControl from '../shared/FulfillmentHandlerControl';
import SaleOrderWorkflowSection from '../shared/SaleOrderWorkflowSection';
import ProofImageActions from '../shared/ProofImageActions';
import CopyOrderDetailsButton from '../shared/CopyOrderDetailsButton';
import { canBranchDeleteOrder, canCustomerSeeDeliveryProof } from '@/lib/icTransfer/orderStatus';
import { canEditOrder, canDeleteOrder, canRequestOrderCancellation } from '@/lib/icTransfer/customerOrderReview';
import { computeMetalSheetRateAed, resolveSaleInrDisplay } from '@/lib/icTransfer/metalSettlement';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { isBranchScopedUser } from '@/lib/rbac';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { dbGetCustomerPhoneAction } from '@/app/actions/icTransferActions';
import {
  getAdminSaleCustomerName,
  getSaleEndCustomerId,
  getSaleEndCustomerName,
  getSaleOrderImageLabel,
} from '@/lib/icTransfer/branchOrderOwnership';
import { effectiveSaleCounterpartyId } from '@/lib/counterparties/effectiveId';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';
import { isBranchHandledSale } from '@/lib/icTransfer/fulfillmentHandler';
import { formatICSaleTransactionTypeLabel } from '@/lib/icTransfer/transactionTypes';
import InrAmountInWords from '../shared/InrAmountInWords';
import { ModalRecordedOnValue } from '../shared/modalDetailUi';

type Props = {
  open: boolean;
  onClose: () => void;
  sale: ICSale | null;
  onEdit?: (sale: ICSale) => void;
  /** Force admin workflow UI on IC Transfer sales page. */
  workflowVariant?: 'admin' | 'branch' | 'auto';
  branchId?: string;
};

export default function ViewSaleModal({ open, onClose, sale, onEdit, workflowVariant = 'auto', branchId }: Props) {
  const { icWarehouses, deleteICSale, branchDeleteICSale, user, branches, icSales, refetchData, showToast, currentSlug } = useApp();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const liveSale = sale ? (icSales.find(s => s.id === sale.id) ?? sale) : null;
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [phoneChecked, setPhoneChecked] = useState(false);

  const branchName = branches.find(b => b.slug === currentSlug)?.name || currentSlug || '';
  const isBranchAdminView = currentSlug !== 'superadmin';
  const txnBranchName = isBranchAdminView ? branchName : undefined;
  const displayCustomerName = liveSale
    ? getAdminSaleCustomerName(liveSale, branchName, branches)
    : '';
  const endCustomerId = liveSale ? getSaleEndCustomerId(liveSale, branchName) : undefined;
  const endCustomerName = liveSale ? getSaleEndCustomerName(liveSale, branchName, branches) : '';
  const orderImageLabel = liveSale ? getSaleOrderImageLabel(liveSale, branchName) : 'Original Order Image';

  React.useEffect(() => {
    if (!open) {
      setCustomerPhone(null);
      setPhoneChecked(false);
      return;
    }
    setPhoneChecked(false);
    dbGetCustomerPhoneAction({
      customerId: endCustomerId,
      customerName: endCustomerName,
    }).then(res => {
      setCustomerPhone(res.success ? res.data ?? null : null);
      setPhoneChecked(true);
    });
  }, [open, endCustomerId, endCustomerName]);

  if (!sale || !liveSale) return null;

  const handleDelete = async () => {
    setDeleteLoading(true);
    if (isBranchPortalView) {
      await branchDeleteICSale(liveSale.id, currentSlug !== 'superadmin' ? currentSlug : undefined);
    } else {
      await deleteICSale(liveSale.id);
    }
    setDeleteLoading(false);
    setConfirmDeleteOpen(false);
    onClose();
  };

  const getWarehouseName = (id?: string) => icWarehouses.find((w: any) => w.id === id)?.name || id || 'None';

  const formatAED = (val: any) => {
    return Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' AED';
  };

  const isMetalSale = liveSale.settlementMode === 'metal';
  const saleInr = resolveSaleInrDisplay(liveSale);
  const isBranchPortalView = workflowVariant === 'branch'
    || (workflowVariant === 'auto' && isBranchScopedUser(user));
  const workflowUiVariant = isBranchPortalView ? 'branch' : 'admin';
  const branchHandled = isBranchHandledSale(liveSale);
  const canBranchModifyRejected =
    isBranchPortalView && canEditOrder(liveSale, user?.role);
  const showDelete = isBranchPortalView
    ? canDeleteOrder(liveSale, user?.role)
    : !branchHandled;
  const showAdminEdit = !isBranchPortalView && !branchHandled && !!onEdit;
  const canShowDeliveryProof =
    (!isBranchPortalView || canCustomerSeeDeliveryProof(liveSale.orderStatus))
    && !!liveSale.deliveryImageUrl;
  const showDeliveryProofPending =
    isBranchPortalView && !canCustomerSeeDeliveryProof(liveSale.orderStatus);

  const handleWorkflowUpdated = async () => {
    await refetchData();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Sale details"
        maxWidth="max-w-4xl"
        footer={
          <div className={`flex w-full items-center ${showDelete ? 'justify-between' : 'justify-end'}`}>
            {showDelete && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className={btnDangerOutline}
              >
                Delete
              </button>
            )}
            <div className="flex gap-2">
              <button 
                type="button" 
                className={asicBtnOutline} 
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Details */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transaction ID</p>
                <p className="font-mono text-sm font-semibold text-slate-900 mt-0.5">{getFormattedTxnId(liveSale.id, 'sale', liveSale, branches, txnBranchName)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recorded on</p>
                <div className="mt-0.5 text-sm font-semibold text-slate-900">
                  <ModalRecordedOnValue iso={liveSale.createdAt} />
                </div>
              </div>
            </div>

            {liveSale.derivedFromSaleId && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-800">
                <span className="font-semibold">Split order</span>
                <span className="text-indigo-600"> · remainder from </span>
                <span className="font-mono font-medium">{getFormattedTxnId(liveSale.derivedFromSaleId, 'sale', null, branches, txnBranchName)}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Customer
                </p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  <CounterpartyLink
                    counterpartyId={effectiveSaleCounterpartyId(liveSale) || liveSale.orderCustomerId}
                    name={displayCustomerName}
                    branchSlug={currentSlug !== 'superadmin' ? currentSlug : undefined}
                  />
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Transaction type</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize mt-0.5 ${
                  liveSale.transactionType === 'by_hand'
                    ? 'border border-violet-200 bg-violet-50 text-violet-700'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {formatICSaleTransactionTypeLabel(liveSale.transactionType)}
                </span>
              </div>
            </div>

            {/* Calculations Box */}
            <div className="space-y-3">
              {isMetalSale ? (
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-100 bg-slate-50/55 p-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Weight</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">
                      {(liveSale.metalWeightG ?? 0).toLocaleString()} g
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">G rate (INR)</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">
                      {formatAmount(liveSale.metalRateInrPerG ?? 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rate (AED)</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">
                      {formatAmount(computeMetalSheetRateAed(saleInr, liveSale.aedAmount ?? 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Receipt</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">AED from customer</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-100 bg-slate-50/55 p-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Units</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-900">{Number(liveSale.units).toLocaleString()}</p>
                  </div>
                  <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit rate (AED)</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-900">{formatAmount(liveSale.unitRate)}</p>
                    </div>
                </div>
              )}

              <div className="grid gap-4 rounded-lg border border-slate-100 bg-slate-50/55 p-4 grid-cols-1 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total (INR)</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                    {saleInr.toLocaleString()} INR
                  </p>
                  <InrAmountInWords
                    amount={saleInr}
                    className="mt-0.5 text-sm font-medium leading-snug text-slate-500"
                  />
                </div>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total (AED)</p>
                    <p className="mt-0.5 text-sm font-bold text-accent">{formatAED(liveSale.aedAmount)}</p>
                  </div>
              </div>
            </div>

            {!isBranchPortalView && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Priority</p>
                  <SalePriorityControl saleId={liveSale.id} priority={liveSale.priority} />
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Handling</p>
                  <FulfillmentHandlerControl sale={liveSale} />
                </div>
              </div>
            )}

            {liveSale.deliveryAgentName && !isBranchPortalView && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned agent</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">{liveSale.deliveryAgentName}</p>
              </div>
            )}

            {liveSale.address ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery address</p>
                <p className="text-sm text-slate-700 mt-0.5 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">{liveSale.address}</p>
              </div>
            ) : !isBranchPortalView ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Warehouse</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <WarehouseLink
                    warehouseId={liveSale.warehouseId}
                    name={getWarehouseName(liveSale.warehouseId)}
                    branchSlug={currentSlug !== 'superadmin' ? currentSlug : ''}
                  />
                </p>
              </div>
            ) : null}

            {liveSale.transactionType === 'by_hand' && (liveSale.location || liveSale.district) ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {liveSale.location ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Location</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{liveSale.location}</p>
                  </div>
                ) : null}
                {liveSale.district ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">District</p>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{liveSale.district}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {liveSale.transactionType !== 'by_hand' && liveSale.bank ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bank</p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{liveSale.bank}</p>
              </div>
            ) : null}

            <SaleOrderWorkflowSection
              sale={liveSale}
              variant={workflowUiVariant}
              branchId={branchId}
              onUpdated={handleWorkflowUpdated}
              onResubmit={
                onEdit && canBranchModifyRejected
                  ? s => {
                      onClose();
                      onEdit(s);
                    }
                  : undefined
              }
            />

            {liveSale.serviceCharge !== undefined && liveSale.serviceCharge > 0 && (
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Service Charge:</span>
                <span className="text-sm font-bold text-slate-700">{formatAED(liveSale.serviceCharge)}</span>
              </div>
            )}

          </div>

          {/* Right Column: Image Previews */}
          <div className="flex flex-col gap-6 lg:border-l lg:pl-8 lg:border-slate-100">
            {/* Original Order Image */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{orderImageLabel}</p>
              {liveSale.imageUrl ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <a href={liveSale.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img src={liveSale.imageUrl} alt="Order proof" className="absolute inset-0 h-full w-full object-contain hover:opacity-90 transition-opacity" />
                  </a>
                </div>
              ) : (
                <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-slate-400 text-xs font-medium">
                  <span>No original image uploaded</span>
                  <CopyOrderDetailsButton
                    address={liveSale.address}
                    units={Number(liveSale.units)}
                    onCopySuccess={() => showToast('Details copied')}
                    onCopyError={msg => showToast(msg, 'error')}
                  />
                </div>
              )}
            </div>

            {/* Delivery Proof */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment proof (agent upload)</p>
              {showDeliveryProofPending ? (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 text-slate-500 text-xs font-medium">
                  Pending
                </div>
              ) : canShowDeliveryProof ? (
                <>
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <a href={liveSale.deliveryImageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={liveSale.deliveryImageUrl} alt="Delivery proof" className="absolute inset-0 h-full w-full object-contain hover:opacity-90 transition-opacity" />
                    </a>
                  </div>
                  <ProofImageActions
                    imageUrl={liveSale.deliveryImageUrl!}
                    downloadFilename={`payment-proof-${getFormattedTxnId(liveSale.id, 'sale', liveSale, branches, txnBranchName)}`}
                    enableShare
                    shareTitle="Payment proof"
                    shareText={`Payment proof for order ${getFormattedTxnId(liveSale.id, 'sale', liveSale, branches, txnBranchName)}`}
                    enableWhatsApp={phoneChecked}
                    whatsappPhone={customerPhone ?? undefined}
                    whatsappMessage={`Hello ${endCustomerName}, here is the payment proof for your order ${getFormattedTxnId(liveSale.id, 'sale', liveSale, branches, txnBranchName)}: ${liveSale.deliveryImageUrl}`.trim()}
                    onCopySuccess={() => showToast('Image copied')}
                    onCopyError={msg => showToast(msg, 'error')}
                    onDownloadError={msg => showToast(msg, 'error')}
                    onShareError={msg => showToast(msg, 'error')}
                  />
                </>
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 text-slate-400 text-xs font-medium">
                  No delivery proof image uploaded
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
        confirmLabel="Delete sale"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
