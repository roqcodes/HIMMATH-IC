'use client';

import React from 'react';
import { useDealInvoice } from '@/components/ic-transfer/invoice/DealInvoiceContext';
import { ICTransferRowIconButton } from '@/components/ic-transfer/shared/ICTransferTableActions';
import { asicBtnOutline } from '@/components/asic/ui';
import type { ICPurchase, ICSale } from '@/types';

export function DealInvoiceIconButtons({
  purchase,
  sale,
}: {
  purchase?: ICPurchase | null;
  sale?: ICSale | null;
}) {
  const invoice = useDealInvoice();
  if (purchase) {
    return (
      <>
        <ICTransferRowIconButton
          title="View invoice"
          onClick={e => {
            e.stopPropagation();
            invoice.viewPurchaseInvoice(purchase);
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h6l5 5v13H7V3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v5h5M9 13h6M9 17h4" />
        </ICTransferRowIconButton>
        <ICTransferRowIconButton
          title="Download invoice"
          onClick={e => {
            e.stopPropagation();
            invoice.downloadPurchaseInvoice(purchase);
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
        </ICTransferRowIconButton>
      </>
    );
  }
  if (sale) {
    return (
      <>
        <ICTransferRowIconButton
          title="View invoice"
          onClick={e => {
            e.stopPropagation();
            invoice.viewSaleInvoice(sale);
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h6l5 5v13H7V3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v5h5M9 13h6M9 17h4" />
        </ICTransferRowIconButton>
        <ICTransferRowIconButton
          title="Download invoice"
          onClick={e => {
            e.stopPropagation();
            invoice.downloadSaleInvoice(sale);
          }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0l-4-4m4 4l4-4M5 19h14" />
        </ICTransferRowIconButton>
      </>
    );
  }
  return null;
}

export function DealInvoiceTextButtons({
  purchase,
  sale,
}: {
  purchase?: ICPurchase | null;
  sale?: ICSale | null;
}) {
  const invoice = useDealInvoice();
  if (!purchase && !sale) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={asicBtnOutline}
        onClick={() => {
          if (purchase) invoice.viewPurchaseInvoice(purchase);
          if (sale) invoice.viewSaleInvoice(sale);
        }}
      >
        View invoice
      </button>
      <button
        type="button"
        className={asicBtnOutline}
        onClick={() => {
          if (purchase) invoice.downloadPurchaseInvoice(purchase);
          if (sale) invoice.downloadSaleInvoice(sale);
        }}
      >
        Download invoice
      </button>
    </div>
  );
}
