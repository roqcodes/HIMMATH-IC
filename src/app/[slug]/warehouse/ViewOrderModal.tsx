'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import { asicBtnOutline } from '@/components/asic/ui';
import { AdminOrderStatusBadge } from '@/components/ic-transfer/shared/OrderStatusBadge';
import CopyOrderDetailsButton from '@/components/ic-transfer/shared/CopyOrderDetailsButton';
import ProofImageActions from '@/components/ic-transfer/shared/ProofImageActions';
import {
  ModalCalcLabel,
  ModalDetailRow,
  ModalRecordedOnValue,
  formatModalAedTotal,
  modalCalcPanelClass,
} from '@/components/ic-transfer/shared/modalDetailUi';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { getSaleInrAmount } from '@/lib/icTransfer/saleUnits';
import InrAmountInWords from '@/components/ic-transfer/shared/InrAmountInWords';
import { useApp } from '@/context/AppContext';

type ViewOrderModalProps = {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    aed_amount?: number;
    units?: number;
    order_status?: string;
    delivery_agent_name?: string | null;
    image_url?: string | null;
    delivery_image_url?: string | null;
    address?: string | null;
    created_at?: string;
  } | null;
};

export default function ViewOrderModal({ open, onClose, order }: ViewOrderModalProps) {
  const { showToast } = useApp();
  if (!order) return null;

  const totalUnits = Number(order.units || 0);
  const aedTotal = Number(order.aed_amount || 0);
  const inrTotal = getSaleInrAmount(totalUnits);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Order details"
      maxWidth="max-w-4xl"
      footer={
        <div className="flex w-full justify-end">
          <button type="button" className={asicBtnOutline} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ModalDetailRow
              label="Order ID"
              value={<span className="font-mono text-sm">{order.id}</span>}
            />
            <ModalDetailRow
              label="Recorded on"
              value={<ModalRecordedOnValue iso={order.created_at} />}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ModalDetailRow
              label="Order status"
              value={<AdminOrderStatusBadge status={order.order_status} />}
            />
            <ModalDetailRow
              label="Delivery agent"
              value={order.delivery_agent_name?.trim() || 'Unassigned'}
            />
          </div>

          <div className="space-y-3">
            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${modalCalcPanelClass}`}>
              <div>
                <ModalCalcLabel>Units</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {totalUnits > 0 ? formatAmount(totalUnits, 4) : '—'}
                </p>
              </div>
              <div>
                <ModalCalcLabel>Total (AED)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-accent">
                  {formatModalAedTotal(aedTotal)}
                </p>
              </div>
            </div>
            {totalUnits > 0 ? (
              <div className={modalCalcPanelClass}>
                <ModalCalcLabel>Total (INR)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {inrTotal.toLocaleString()} INR
                </p>
                <InrAmountInWords
                  amount={inrTotal}
                  className="mt-0.5 text-sm font-medium leading-snug text-slate-500"
                />
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Delivery address</p>
            {order.address?.trim() ? (
              <>
                <p className="mt-1.5 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
                  {order.address}
                </p>
                <div className="mt-2">
                  <CopyOrderDetailsButton
                    address={order.address}
                    units={totalUnits}
                    enableShare
                    onCopySuccess={() => showToast('Address details copied')}
                    onCopyError={msg => showToast(msg, 'error')}
                    onShareError={msg => showToast(msg, 'error')}
                  />
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm font-medium text-slate-500">Not provided</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:border-l lg:border-slate-100 lg:pl-8">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Original order image</p>
            {order.image_url ? (
              <>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.image_url}
                    alt="Order proof"
                    className="absolute inset-0 h-full w-full object-contain hover:opacity-90 transition-opacity"
                  />
                </div>
                <ProofImageActions
                  imageUrl={order.image_url}
                  downloadFilename={`order-${order.id}`}
                  enableShare
                  shareTitle="Original order image"
                  onCopySuccess={() => showToast('Image copied')}
                  onCopyError={msg => showToast(msg, 'error')}
                  onDownloadError={msg => showToast(msg, 'error')}
                  onShareError={msg => showToast(msg, 'error')}
                />
              </>
            ) : (
              <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-slate-500">
                <p className="text-xs font-medium">No original image uploaded</p>
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

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment proof</p>
            {order.delivery_image_url ? (
              <>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={order.delivery_image_url}
                    alt="Payment proof"
                    className="absolute inset-0 h-full w-full object-contain hover:opacity-90 transition-opacity"
                  />
                </div>
                <ProofImageActions
                  imageUrl={order.delivery_image_url}
                  downloadFilename={`payment-proof-${order.id}`}
                  enableShare
                  shareTitle="Payment proof"
                  onCopySuccess={() => showToast('Image copied')}
                  onCopyError={msg => showToast(msg, 'error')}
                  onDownloadError={msg => showToast(msg, 'error')}
                  onShareError={msg => showToast(msg, 'error')}
                />
              </>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 text-xs font-medium text-slate-500">
                No payment proof uploaded
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
