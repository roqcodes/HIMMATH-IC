'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { completeDeliveryWithUnits, deliveryAgentRejectOrder, warehouseRejectOrder } from '@/app/actions/warehouseActions';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import Modal from '@/components/ui/Modal';
import ImageDropZone from '@/components/ui/ImageDropZone';
import RejectRemarkModal from '@/components/ic-transfer/shared/RejectRemarkModal';
import CopyOrderDetailsButton from '@/components/ic-transfer/shared/CopyOrderDetailsButton';
import ProofImageActions from '@/components/ic-transfer/shared/ProofImageActions';
import { canDeliveryAgentAct } from '@/lib/icTransfer/orderStatus';
import { PriorityBadge } from '@/components/warehouse/shared';
import { formatUnits, getRemainingUnits, isDeliveryAgentFinished } from '@/lib/icTransfer/saleUnits';
import { AdminOrderStatusBadge } from '@/components/ic-transfer/shared/OrderStatusBadge';
import { btnDangerOutline, btnPrimary, btnSecondary, formHint, formInput, formLabel } from '@/lib/ui';
import { uploadImageToCloudinary, deleteCloudinaryImageByToken } from '@/lib/cloudinary';
import type { WarehouseOrder } from '@/types/warehouse';

type Props = {
  order: WarehouseOrder;
  isDeliveryView?: boolean;
  isWarehouseDirectDeliver?: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function MetricTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'warning'
        ? 'text-amber-700'
        : 'text-slate-900';

  return (
    <div className="flex min-w-0 flex-col items-center px-2 py-3 text-center sm:px-4 sm:py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums leading-none sm:text-xl ${toneClass}`}>{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-slate-200/90 bg-white ${className}`}>
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</p>
        {description ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p> : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}

export default function OrderDetailsModal({
  order,
  isDeliveryView = false,
  isWarehouseDirectDeliver = false,
  onClose,
  onSuccess,
}: Props) {
  const { showToast, user, branches } = useApp();
  const [loading, setLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const totalUnits = Number(order.units);
  const [collectedUnits, setCollectedUnits] = useState('');
  const [deliveryImageUrl, setDeliveryImageUrl] = useState(order?.delivery_image_url || '');
  const [deleteToken, setDeleteToken] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  if (!order) return null;

  const canRecordDelivery =
    (isDeliveryView || isWarehouseDirectDeliver) &&
    !isDeliveryAgentFinished(order.order_status) &&
    canDeliveryAgentAct(order.order_status);
  const isEditable = canRecordDelivery;

  const deliveredUnits = isEditable
    ? Math.min(totalUnits, Math.max(0, parseFloat(collectedUnits) || 0))
    : Number(order.collected_units || (order.order_status === 'completed' ? totalUnits : 0));

  const remainingUnits = isEditable
    ? Math.max(0, totalUnits - deliveredUnits)
    : getRemainingUnits(totalUnits, order.collected_units, order.order_status);

  const deliveryPct = totalUnits <= 0 ? 0 : Math.min(100, Math.round((deliveredUnits / totalUnits) * 100));

  const parsedDeliveredUnits = parseFloat(collectedUnits);
  const canSubmitDelivery =
    Number.isFinite(parsedDeliveredUnits) &&
    parsedDeliveredUnits > 0 &&
    parsedDeliveredUnits <= totalUnits;

  const formattedId = getFormattedTxnId(order.id, 'sale', order, branches);
  const parentId = order.derived_from_sale_id
    ? getFormattedTxnId(order.derived_from_sale_id, 'sale', null, branches)
    : null;

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const { secureUrl, deleteToken: token } = await uploadImageToCloudinary(file);
      setDeliveryImageUrl(secureUrl);
      setDeleteToken(token || '');
      showToast('Delivery proof image uploaded successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      showToast(message === 'Upload failed' ? 'Failed to upload image. Please try again.' : message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    if (deleteToken) {
      try {
        await deleteCloudinaryImageByToken(deleteToken);
      } catch {
        /* non-blocking */
      }
    }
    setDeliveryImageUrl('');
    setDeleteToken('');
  };

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const units = parseFloat(collectedUnits);
    if (!Number.isFinite(units) || units <= 0 || units > totalUnits) {
      showToast(`Enter delivered units between 1 and ${formatUnits(totalUnits)}`, 'error');
      setLoading(false);
      return;
    }
    const res = await completeDeliveryWithUnits(
      order.id,
      units,
      deliveryImageUrl,
      user?.email || 'delivery_agent',
    );
    setLoading(false);
    if (!res.success) {
      showToast(res.error || 'Failed to update order', 'error');
    } else {
      showToast(res.message || 'Delivery recorded', 'success');
      onSuccess();
    }
  };

  const handleReject = async (remarks: string) => {
    setLoading(true);
    const updatedBy = user?.email || (isWarehouseDirectDeliver ? 'warehouse' : 'delivery_agent');
    const res = isWarehouseDirectDeliver
      ? await warehouseRejectOrder(order.id, remarks, updatedBy)
      : await deliveryAgentRejectOrder(order.id, remarks, updatedBy);
    setLoading(false);
    if (res.success) {
      showToast('Order rejected', 'success');
      setRejectOpen(false);
      onSuccess();
    } else {
      showToast(res.error || 'Failed to reject order', 'error');
    }
  };

  return (
    <>
      <Modal
        open={true}
        onClose={onClose}
        title={
          <div className="min-w-0 pr-2">
            <p className="text-sm font-semibold text-slate-900 sm:text-base">
              {isEditable ? 'Record Delivery' : 'Order Details'}
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] font-normal text-slate-500 sm:text-xs">{formattedId}</p>
          </div>
        }
        maxWidth="max-w-2xl"
        footer={
          isEditable ? (
            <>
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                disabled={loading}
                className={`${btnDangerOutline} w-full sm:mr-auto sm:w-auto`}
              >
                Reject order
              </button>
              <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                form="complete-order-form"
                disabled={loading || isUploading || !canSubmitDelivery}
                className={`${btnPrimary} w-full sm:w-auto`}
                title={!canSubmitDelivery ? 'Enter delivered units greater than 0' : undefined}
              >
                {loading ? 'Processing…' : 'Complete delivery'}
              </button>
            </>
          ) : (
            <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={onClose}>
              Close
            </button>
          )
        }
      >
        <div className="space-y-4 sm:space-y-5">
          <section className="overflow-hidden rounded-lg border border-slate-200/90 bg-white">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Created</p>
                <p className="mt-1 text-sm text-slate-700">{new Date(order.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={order.priority} />
                <AdminOrderStatusBadge status={order.order_status} />
              </div>
            </div>

            {parentId ? (
              <div className="border-b border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-xs text-indigo-800 sm:px-5">
                <span className="font-semibold">Split order</span>
                <span className="text-indigo-600"> · remainder from </span>
                <span className="font-mono font-medium">{parentId}</span>
              </div>
            ) : null}

            <div className="px-4 py-4 sm:px-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Delivery progress</p>
              <div className="mt-3 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
                <MetricTile label="Total" value={formatUnits(totalUnits)} />
                <MetricTile label="Delivered" value={formatUnits(deliveredUnits)} tone="success" />
                <MetricTile
                  label="Remaining"
                  value={formatUnits(remainingUnits)}
                  tone={remainingUnits > 0 ? 'warning' : 'default'}
                />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                  <span>Progress</span>
                  <span className="tabular-nums">{deliveryPct}%</span>
                </div>
                <div
                  className="relative h-2 overflow-hidden rounded-full bg-slate-200/80"
                  role="progressbar"
                  aria-valuenow={deliveryPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Share of order units delivered"
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${deliveryPct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {formatUnits(deliveredUnits)} delivered
                  {remainingUnits > 0
                    ? ` · ${formatUnits(remainingUnits)} will move to a linked order`
                    : ' · full delivery'}
                </p>
              </div>
            </div>
          </section>

          {isEditable ? (
            <SectionCard
              title="Complete delivery"
              description="Enter how many units were delivered and attach payment proof if available."
            >
              <form id="complete-order-form" onSubmit={handleUpdateOrder} className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                <div className="space-y-3">
                  <div>
                    <label htmlFor="delivered-units" className={formLabel}>
                      Delivered units
                    </label>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <input
                        id="delivered-units"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0.01"
                        max={totalUnits}
                        required
                        value={collectedUnits}
                        onChange={e => setCollectedUnits(e.target.value)}
                        className={`${formInput} text-right text-lg font-semibold tabular-nums sm:flex-1 sm:text-xl`}
                        placeholder="0"
                        aria-describedby="delivered-units-hint"
                      />
                      <button
                        type="button"
                        className={`${btnSecondary} shrink-0 whitespace-nowrap`}
                        onClick={() => setCollectedUnits(String(totalUnits))}
                      >
                        Deliver all ({formatUnits(totalUnits)})
                      </button>
                    </div>
                    <p id="delivered-units-hint" className={formHint}>
                      Max {formatUnits(totalUnits)} units for this order
                    </p>
                    {remainingUnits > 0 && collectedUnits ? (
                      <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-800">
                        {formatUnits(remainingUnits)} units will stay on a new linked order after you complete this
                        delivery.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0">
                  <p className={formLabel}>Payment proof</p>
                  <div className="mt-1.5">
                    <ImageDropZone
                      imageUrl={deliveryImageUrl}
                      onUpload={handleImageUpload}
                      onClear={handleDeleteImage}
                      isUploading={isUploading}
                      showCapture
                      emptyLabel="Tap to add payment proof"
                    />
                  </div>
                </div>
              </form>
            </SectionCard>
          ) : null}

          <SectionCard title="Delivery address">
            {order.address?.trim() ? (
              <div className="space-y-3">
                <p className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-700">
                  {order.address}
                </p>
                <CopyOrderDetailsButton
                  address={order.address}
                  units={totalUnits}
                  enableShare
                  onCopySuccess={() => showToast('Address details copied')}
                  onCopyError={msg => showToast(msg, 'error')}
                  onShareError={msg => showToast(msg, 'error')}
                />
              </div>
            ) : (
              <div className="flex min-h-[7rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-xs font-medium text-slate-400">
                No address text provided
              </div>
            )}
          </SectionCard>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-slate-200/90 bg-white p-4 sm:p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Original order</p>
              {order.image_url ? (
                <div className="space-y-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={order.image_url}
                      alt="Original order"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </div>
                  <ProofImageActions
                    imageUrl={order.image_url}
                    downloadFilename={`order-${formattedId}`}
                    enableShare
                    shareTitle="Original order image"
                    shareText={`Original order image for ${formattedId}`}
                    onCopySuccess={() => showToast('Image copied')}
                    onCopyError={msg => showToast(msg, 'error')}
                    onDownloadError={msg => showToast(msg, 'error')}
                    onShareError={msg => showToast(msg, 'error')}
                  />
                </div>
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-center text-xs font-medium text-slate-400">
                  <span>No original image</span>
                  <CopyOrderDetailsButton
                    address={order.address ?? undefined}
                    units={totalUnits}
                    enableShare
                    onCopySuccess={() => showToast('Details copied')}
                    onCopyError={msg => showToast(msg, 'error')}
                    onShareError={msg => showToast(msg, 'error')}
                  />
                </div>
              )}
            </div>

            {!isEditable ? (
              <div className="min-w-0 rounded-lg border border-slate-200/90 bg-white p-4 sm:p-5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Payment proof</p>
                {deliveryImageUrl ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={deliveryImageUrl}
                        alt="Payment proof"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                    <ProofImageActions
                      imageUrl={deliveryImageUrl}
                      downloadFilename={`payment-proof-${formattedId}`}
                      enableShare
                      shareTitle="Payment proof"
                      shareText={`Payment proof for ${formattedId}`}
                      onCopySuccess={() => showToast('Image copied')}
                      onCopyError={msg => showToast(msg, 'error')}
                      onDownloadError={msg => showToast(msg, 'error')}
                      onShareError={msg => showToast(msg, 'error')}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-400">
                    No payment proof
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </Modal>

      <RejectRemarkModal
        open={rejectOpen}
        loading={loading}
        title={isWarehouseDirectDeliver ? 'Reject Order' : 'Reject Delivery'}
        description={
          isWarehouseDirectDeliver
            ? 'Provide a reason for rejecting this order. The admin will be notified to reassign or reject.'
            : 'Provide a reason for rejecting this delivery. The warehouse manager and admin will be notified.'
        }
        onConfirm={handleReject}
        onCancel={() => setRejectOpen(false)}
      />
    </>
  );
}
