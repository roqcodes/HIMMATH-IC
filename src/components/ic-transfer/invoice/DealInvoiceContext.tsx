'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import DealInvoiceDocument from '@/components/ic-transfer/invoice/DealInvoiceDocument';
import { useApp } from '@/context/AppContext';
import { dealAgentDisplayName, dealAgentPartyId } from '@/lib/counterparties/dealAgent';
import { effectivePurchaseCounterpartyId, effectiveSaleCounterpartyId } from '@/lib/counterparties/effectiveId';
import { getAdminSaleCustomerName } from '@/lib/icTransfer/branchOrderOwnership';
import {
  buildPurchaseInvoice,
  buildSaleInvoice,
  resolveDealInvoiceIssuer,
  type DealInvoiceDoc,
} from '@/lib/icTransfer/dealInvoice';
import { downloadDealInvoicePdf } from '@/lib/icTransfer/dealInvoiceDownload';
import type { ICPurchase, ICSale } from '@/types';

type DealInvoiceApi = {
  viewPurchaseInvoice: (purchase: ICPurchase) => void;
  viewSaleInvoice: (sale: ICSale) => void;
  downloadPurchaseInvoice: (purchase: ICPurchase) => void;
  downloadSaleInvoice: (sale: ICSale) => void;
};

const DealInvoiceContext = createContext<DealInvoiceApi | null>(null);

export function useDealInvoice(): DealInvoiceApi {
  const ctx = useContext(DealInvoiceContext);
  if (!ctx) {
    throw new Error('useDealInvoice must be used within DealInvoiceProvider');
  }
  return ctx;
}

export function DealInvoiceProvider({ children }: { children: React.ReactNode }) {
  const { branches, icWarehouses, icSuppliers, user, currentSlug } = useApp();
  const [doc, setDoc] = useState<DealInvoiceDoc | null>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!doc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDoc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc]);

  const partyNameOf = useCallback(
    (id?: string | null) => icSuppliers.find(s => s.id === id)?.name || id || '—',
    [icSuppliers],
  );

  const warehouseNameOf = useCallback(
    (id?: string) => (id ? icWarehouses.find(w => w.id === id)?.name || '—' : '—'),
    [icWarehouses],
  );

  const issuerFor = useCallback(
    (warehouseId?: string) =>
      resolveDealInvoiceIssuer(branches, {
        currentSlug,
        userBranchId: user?.branchId,
        warehouse: warehouseId ? icWarehouses.find(w => w.id === warehouseId) || null : null,
      }),
    [branches, currentSlug, icWarehouses, user?.branchId],
  );

  const purchaseDoc = useCallback(
    (purchase: ICPurchase): DealInvoiceDoc => {
      const { issuer, branchName } = issuerFor(purchase.warehouseId);
      return buildPurchaseInvoice(purchase, {
        issuer,
        branchName,
        warehouseName: warehouseNameOf(purchase.warehouseId),
        partyName: partyNameOf(effectivePurchaseCounterpartyId(purchase)),
        agentName: dealAgentPartyId(purchase) ? dealAgentDisplayName(purchase, partyNameOf) : null,
      });
    },
    [issuerFor, partyNameOf, warehouseNameOf],
  );

  const saleDoc = useCallback(
    (sale: ICSale): DealInvoiceDoc => {
      const { issuer, branchName } = issuerFor(sale.warehouseId);
      const branchLabel = branches.find(b => b.slug === currentSlug)?.name || branchName;
      return buildSaleInvoice(sale, {
        issuer,
        branchName,
        warehouseName: warehouseNameOf(sale.warehouseId),
        partyName: getAdminSaleCustomerName(sale, branchLabel, branches) || partyNameOf(effectiveSaleCounterpartyId(sale)),
        agentName: dealAgentPartyId(sale) ? dealAgentDisplayName(sale, partyNameOf) : null,
      });
    },
    [branches, currentSlug, issuerFor, partyNameOf, warehouseNameOf],
  );

  const api = useMemo<DealInvoiceApi>(
    () => ({
      viewPurchaseInvoice: p => setDoc(purchaseDoc(p)),
      viewSaleInvoice: s => setDoc(saleDoc(s)),
      downloadPurchaseInvoice: p => void downloadDealInvoicePdf(purchaseDoc(p)),
      downloadSaleInvoice: s => void downloadDealInvoicePdf(saleDoc(s)),
    }),
    [purchaseDoc, saleDoc],
  );

  return (
    <DealInvoiceContext.Provider value={api}>
      {children}
      {mounted && doc
        ? createPortal(
            <div className="fixed inset-0 z-[460] flex flex-col bg-slate-800/70">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-2.5 text-white">
                <p className="truncate text-sm font-semibold">
                  {doc.titleEn} · {doc.number}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={asicBtnPrimary}
                    onClick={() => void downloadDealInvoicePdf(doc)}
                  >
                    Download
                  </button>
                  <button type="button" className={asicBtnOutline} onClick={() => setDoc(null)}>
                    Close
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[#e8eaed] px-4 py-8 sm:px-8">
                <div className="mx-auto w-fit shadow-[0_8px_30px_rgb(15_23_42/0.18)]">
                  <DealInvoiceDocument doc={doc} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </DealInvoiceContext.Provider>
  );
}
