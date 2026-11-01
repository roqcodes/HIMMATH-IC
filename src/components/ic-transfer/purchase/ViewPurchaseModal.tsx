'use client';

import React, { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { asicBtnOutline } from '@/components/asic/ui';
import { btnDangerOutline } from '@/lib/ui';
import { ICPurchase } from '@/types';
import { useApp } from '@/context/AppContext';
import { ConfirmModal } from '@/components/warehouse/shared';
import { getFormattedTxnId } from '@/lib/icTransferMappers';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import { computeMetalSheetRateAed, formatSettlementModeLabel } from '@/lib/icTransfer/metalSettlement';
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
import { effectivePurchaseCounterpartyId } from '@/lib/counterparties/effectiveId';
import CounterpartyLink from '@/components/counterparties/CounterpartyLink';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';

type Props = {
  open: boolean;
  onClose: () => void;
  purchase: ICPurchase | null;
};

export default function ViewPurchaseModal({ open, onClose, purchase }: Props) {
  const { icSuppliers, icWarehouses, deleteICPurchase } = useApp();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const amounts = useMemo(() => {
    if (!purchase) return null;
    const inrTotal = purchase.convertedTotal ?? 0;
    const aedTotal = purchase.aedTotal ?? purchase.units * purchase.unitRate;
    return { inrTotal, aedTotal };
  }, [purchase]);

  if (!purchase || !amounts) return null;

  const isMetal = purchase.settlementMode === 'metal';

  const getSupplierName = (id?: string) => icSuppliers.find(s => s.id === id)?.name || id || 'Unknown';
  const getWarehouseName = (id?: string) => {
    if (!id) return '—';
    return icWarehouses.find(w => w.id === id)?.name || '—';
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
              disabled={deleteLoading}
            >
              Delete
            </button>
            <button type="button" className={asicBtnOutline} onClick={onClose} disabled={deleteLoading}>
              Close
            </button>
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
              label="Status"
              value={
                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  Completed
                </span>
              }
            />
            <ModalDetailRow
              label="Settlement"
              value={
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  {formatSettlementModeLabel(purchase.settlementMode)}
                </span>
              }
            />
          </div>

          <div className={modalCounterpartyPanelClass}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ModalDetailRow
                label="Supplier"
                value={
                  <CounterpartyLink
                    counterpartyId={effectivePurchaseCounterpartyId(purchase)}
                    name={getSupplierName(effectivePurchaseCounterpartyId(purchase))}
                  />
                }
              />
              <ModalDetailRow
                label="Warehouse"
                value={
                  <WarehouseLink warehouseId={purchase.warehouseId} name={getWarehouseName(purchase.warehouseId)} />
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            {isMetal ? (
              <div className={`grid grid-cols-2 gap-4 sm:grid-cols-3 ${modalCalcPanelClass}`}>
                <ModalDetailRow label="Weight (g)" value={formatAmount(purchase.metalWeightG ?? 0, 4)} />
                <ModalDetailRow label="G rate (INR)" value={formatAmount(purchase.metalRateInrPerG ?? 0)} />
                <ModalDetailRow
                  label="Rate (AED)"
                  value={formatAmount(computeMetalSheetRateAed(purchase.inrTotal ?? 0, purchase.aedTotal ?? 0))}
                />
              </div>
            ) : (
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
            )}

            <div className={`grid grid-cols-1 gap-4 ${isMetal ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} ${modalCalcPanelClass}`}>
              {isMetal ? (
                <div>
                  <ModalCalcLabel>Stock units</ModalCalcLabel>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                    {formatAmount(purchase.units, 4)}
                  </p>
                </div>
              ) : null}
              <div>
                <ModalCalcLabel>Total (INR)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {formatModalInrTotal(amounts.inrTotal)}
                </p>
                <InrAmountInWords amount={amounts.inrTotal} className="mt-1" />
              </div>
              <div>
                <ModalCalcLabel>Total (AED)</ModalCalcLabel>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                  {formatModalAedTotal(amounts.aedTotal)}
                </p>
              </div>
            </div>

            {purchase.notes ? (
              <ModalDetailRow label="Notes" value={purchase.notes} />
            ) : null}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDeleteOpen}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete purchase?"
        message="This will remove the purchase and reverse its ledger entries."
        confirmLabel="Delete"
        loading={deleteLoading}
      />
    </>
  );
}
