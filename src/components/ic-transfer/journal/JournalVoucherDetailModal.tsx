'use client';

import React from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { asicBtnOutline } from '@/components/asic/ui';
import { IC_FUND_VOUCHER_LABELS } from '@/lib/icFunds/constants';
import { fmtICDate, FmtLedgerAmount } from '@/lib/icFunds/format';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import VoucherUserCell from '@/components/ic-funds/VoucherUserCell';
import {
  warehouseJournalEntryLabel,
} from '@/lib/icTransfer/warehouseJournalLabels';
import { resolveJournalReferenceLink } from '@/lib/icTransfer/journalReference';
import type { ICTransferPortalMode } from '@/lib/icTransfer/branchPortalScope';
import WarehouseLink from '@/components/ic-transfer/warehouse/WarehouseLink';
import { ModalDetailRow } from '@/components/ic-transfer/shared/modalDetailUi';
import type { ICPurchase, ICSale, ICFundVoucher } from '@/types';
import { useApp } from '@/context/AppContext';

type Props = {
  open: boolean;
  onClose: () => void;
  voucher: ICFundVoucher | null;
  icFundsSlug: string;
  portalMode?: ICTransferPortalMode;
  branchSlug?: string;
  purchases: ICPurchase[];
  sales: ICSale[];
  onViewPurchase?: (purchase: ICPurchase) => void;
  onViewSale?: (sale: ICSale) => void;
};

function statusBadge(status: ICFundVoucher['status']) {
  if (status === 'void') {
    return (
      <span className="ml-2 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
        Void
      </span>
    );
  }
  if (status === 'pending') {
    return (
      <span className="ml-2 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700">
        Pending
      </span>
    );
  }
  return null;
}

export default function JournalVoucherDetailModal({
  open,
  onClose,
  voucher,
  icFundsSlug,
  portalMode = 'admin',
  branchSlug = '',
  purchases,
  sales,
  onViewPurchase,
  onViewSale,
}: Props) {
  const { icWarehouses } = useApp();
  if (!voucher) return null;

  const entryLabel = warehouseJournalEntryLabel(voucher, purchases, sales);
  const reference = resolveJournalReferenceLink(voucher, purchases, sales, {
    icFundsSlug,
    portalMode,
  });

  const warehouseMeta = (() => {
    if (reference.kind === 'purchase' && reference.purchase.warehouseId) {
      const name =
        icWarehouses.find(w => w.id === reference.purchase.warehouseId)?.name || 'Warehouse';
      return { id: reference.purchase.warehouseId, name };
    }
    if (reference.kind === 'sale' && reference.sale.warehouseId) {
      const name =
        icWarehouses.find(w => w.id === reference.sale.warehouseId)?.name || 'Warehouse';
      return { id: reference.sale.warehouseId, name };
    }
    return null;
  })();

  const relatedDocument = (() => {
    if (reference.kind === 'purchase') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="font-mono text-sm font-semibold text-sky-800 hover:underline"
            onClick={() => {
              onViewPurchase?.(reference.purchase);
              onClose();
            }}
          >
            {reference.label}
          </button>
          <span className="text-xs text-slate-500">Purchase</span>
        </div>
      );
    }
    if (reference.kind === 'sale') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="font-mono text-sm font-semibold text-sky-800 hover:underline"
            onClick={() => {
              onViewSale?.(reference.sale);
              onClose();
            }}
          >
            {reference.label}
          </button>
          <span className="text-xs text-slate-500">Sale</span>
        </div>
      );
    }
    if (reference.kind === 'manual') {
      return (
        <div className="space-y-1">
          <Link href={reference.href} className="text-sm font-semibold text-sky-800 hover:underline">
            {reference.label}
          </Link>
          <p className="text-xs text-slate-500">{reference.description}</p>
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <span className="font-mono text-sm text-slate-800">{reference.label}</span>
        {reference.description ? (
          <p className="text-xs text-slate-500">{reference.description}</p>
        ) : null}
      </div>
    );
  })();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Journal entry"
      maxWidth="max-w-lg"
      footer={
        <button type="button" onClick={onClose} className={asicBtnOutline}>
          Close
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <ModalDetailRow
          label="Date"
          value={
            <>
              {fmtICDate(voucher.voucherDate)}
              {statusBadge(voucher.status)}
            </>
          }
        />
        <ModalDetailRow
          label="Voucher"
          value={
            <span className="font-mono tabular-nums">
              {voucher.book === 'INR' ? 'INR' : 'AED'} #{voucher.voucherNo}
            </span>
          }
        />
        <ModalDetailRow label="Entry" value={entryLabel} />
        <ModalDetailRow label="Voucher type" value={IC_FUND_VOUCHER_LABELS[voucher.voucherType]} />
        <ModalDetailRow
          label="Debit"
          value={
            voucher.book === 'INR' ? (
              voucher.debitAccountName
            ) : (
              <ICFundAccountLink
                slug={icFundsSlug}
                accountId={voucher.debitAccountId}
                name={voucher.debitAccountName}
              />
            )
          }
        />
        <ModalDetailRow
          label="Credit"
          value={
            voucher.book === 'INR' ? (
              voucher.creditAccountName
            ) : (
              <ICFundAccountLink
                slug={icFundsSlug}
                accountId={voucher.creditAccountId}
                name={voucher.creditAccountName}
              />
            )
          }
        />
        <ModalDetailRow
          label="Amount"
          value={
            <span className="font-mono tabular-nums">
              <FmtLedgerAmount amount={voucher.amount} book={voucher.book} />
            </span>
          }
        />
        <ModalDetailRow label="Posted by" value={<VoucherUserCell voucher={voucher} />} />
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Related document</p>
        <div className="mt-2">{relatedDocument}</div>
        {warehouseMeta?.id ? (
          <p className="mt-2 text-xs text-slate-500">
            Warehouse{' '}
            <WarehouseLink
              warehouseId={warehouseMeta.id}
              name={warehouseMeta.name || 'View warehouse'}
              branchSlug={branchSlug}
              portalMode={portalMode}
              className="font-medium text-sky-800 hover:underline"
            />
          </p>
        ) : null}
      </div>

      {voucher.notes?.trim() ? (
        <div className="mt-4">
          <ModalDetailRow label="Notes" value={<span className="font-normal text-slate-700">{voucher.notes}</span>} />
        </div>
      ) : null}
    </Modal>
  );
}
