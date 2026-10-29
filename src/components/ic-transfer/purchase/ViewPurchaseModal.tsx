'use client';

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { asicBtnOutline } from '@/components/asic/ui';
import { btnDangerOutline, btnSuccessSolid, btnWarningSolid } from '@/lib/ui';
import { ICPurchase } from '@/types';
import { useApp } from '@/context/AppContext';
import { ConfirmModal } from '@/components/warehouse/shared';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { getSaleInrAmount } from '@/lib/icTransfer/saleUnits';
import InrAmountInWords from '../shared/InrAmountInWords';
import {
  ModalCalcLabel,
  ModalDetailRow,
  ModalRecordedOnValue,
  formatModalAedTotal,
  formatModalInrTotal,
  modalCalcPanelClass,
  modalCounterpartyPanelClass,
} from '../shared/modalDetailUi';

type Props = {
  open: boolean;
  onClose: () => void;
  purchase: ICPurchase | null;
};

function paymentStatusLabel(status?: ICPurchase['paymentStatus']) {
  return status === 'paid' ? 'Paid' : 'Pending';
}

export default function ViewPurchaseModal({ open, onClose, purchase }: Props) {
  const { icSuppliers, icWarehouses, updateICPurchase, deleteICPurchase } = useApp();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const amounts = useMemo(() => {
    if (!purchase) return null;
    const inrTotal = purchase.convertedTotal ?? getSaleInrAmount(purchase.units);
    const aedTotal = purchase.aedTotal ?? purchase.units * purchase.unitRate;
    return { inrTotal, aedTotal };
  }, [purchase]);

  if (!purchase || !amounts) return null;

  const isPaid = purchase.paymentStatus === 'paid';

  const getSupplierName = (id?: string) => icSuppliers.find(s => s.id === id)?.name || id || 'Unknown';
  const getWarehouseName = (id?: string) => icWarehouses.find(w => w.id === id)?.name || id || 'Unknown';

  const handleTogglePaid = async () => {
    setStatusLoading(true);
    const newStatus = isPaid ? 'pending' : 'paid';
    await updateICPurchase(purchase.id, { paymentStatus: newStatus });
    setStatusLoading(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    await deleteICPurchase(purchase.id);
    setDeleteLoading(false);
    setConfirmDeleteOpen(false);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Purchase details"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex w-full items-center justify-between">
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              className={btnDangerOutline}
              disabled={deleteLoading || statusLoading}
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className={asicBtnOutline}
                onClick={onClose}
                disabled={deleteLoading || statusLoading}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleTogglePaid}
                disabled={deleteLoading || statusLoading}
                className={isPaid ? btnWarningSolid : btnSuccessSolid}
              >
                {statusLoading
                  ? 'Updating…'
                  : isPaid
                    ? 'Mark as pending'
                    : 'Mark as paid'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ModalDetailRow
              label="Transaction ID"
              value={
                <span className="font-mono text-sm">
                  {getFormattedTxnId(purchase.id, 'purchase', purchase)}
                </span>
              }
            />
            <ModalDetailRow
              label="Recorded on"
              value={<ModalRecordedOnValue iso={purchase.createdAt} />}
            />
            <ModalDetailRow
              label="Payment status"
              value={
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {paymentStatusLabel(purchase.paymentStatus)}
                </span>
              }
            />
          </div>

          <div className={modalCounterpartyPanelClass}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModalDetailRow label="Supplier" value={getSupplierName(purchase.supplierId)} />
              <ModalDetailRow label="Warehouse" value={getWarehouseName(purchase.warehouseId)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className={`grid grid-cols-2 gap-4 ${modalCalcPanelClass}`}>
              <div>
                <ModalCalcLabel>Units</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {formatAmount(purchase.units, 4)}
                </p>
              </div>
              <div>
                <ModalCalcLabel>Unit rate (AED)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {formatAmount(purchase.unitRate)}
                </p>
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${modalCalcPanelClass}`}>
              <div>
                <ModalCalcLabel>Total (INR)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {formatModalInrTotal(amounts.inrTotal)}
                </p>
                <InrAmountInWords
                  amount={amounts.inrTotal}
                  className="mt-0.5 text-sm font-medium leading-snug text-slate-500"
                />
              </div>
              <div>
                <ModalCalcLabel>Total (AED)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-accent">
                  {formatModalAedTotal(amounts.aedTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <ModalDetailRow
              label="Payment method"
              value={
                <span className="font-medium capitalize text-slate-700">
                  {purchase.paymentMethod?.trim() || 'Not recorded'}
                </span>
              }
            />
            {purchase.notes?.trim() ? (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Notes</p>
                <p className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {purchase.notes.trim()}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete purchase"
        message="Are you sure you want to delete this purchase? This action cannot be undone."
        confirmLabel="Delete purchase"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </>
  );
}
