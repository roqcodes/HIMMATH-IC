'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { findCounterpartyByRouteParam } from '@/lib/counterparties/counterpartySlug';
import { counterpartyListPath } from '@/lib/counterparties/navigation';
import { formatCounterpartyRolesLabel } from '@/lib/counterparties/roles';
import CounterpartyDetailTabs from '@/components/counterparties/CounterpartyDetailTabs';
import CounterpartyModal from '@/components/counterparties/CounterpartyModal';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { useICTransferFilters } from '@/components/ic-transfer/ui';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import {
  counterpartyPartyAccountId,
  counterpartyVoucherHref,
  pickCounterpartyVoucherBook,
} from '@/lib/icFunds/voucherDeepLink';
import { voucherPostedTargetsCounterparty } from '@/lib/icFunds/voucherPostedNotify';
import { useOnIcFundsVoucherPosted } from '@/hooks/useOnIcFundsVoucherPosted';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { fmtLedgerAed, fmtLedgerInr } from '@/lib/icFunds/format';
import { buildLedgerAccountMetrics } from '@/lib/icFunds/ledgerKpiMetrics';
import {
  getCounterpartyLedgerKpisAction,
  type CounterpartyLedgerKpis,
} from '@/app/actions/icFundsActions';

type Props = {
  counterpartyId: string;
  branchSlug?: string;
};

const EMPTY_KPIS: CounterpartyLedgerKpis = {
  aed: { accountId: null, accountName: null, opening: 0, periodDebit: 0, periodCredit: 0, closing: 0 },
  inr: { accountId: null, accountName: null, opening: 0, periodDebit: 0, periodCredit: 0, closing: 0 },
};

export default function CounterpartyDetailsClient({ counterpartyId, branchSlug }: Props) {
  const { icSuppliers } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [editOpen, setEditOpen] = useState(false);
  const [ledger, setLedger] = useState<CounterpartyLedgerKpis>(EMPTY_KPIS);

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
  } = useICTransferFilters();

  const counterparty = useMemo(
    () => findCounterpartyByRouteParam(icSuppliers, counterpartyId),
    [icSuppliers, counterpartyId],
  );

  const range = useMemo(
    () => resolveDateFilterRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const rangeLabel = useMemo(
    () => getDateFilterLabel(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate],
  );

  const reloadLedgerKpis = useCallback(() => {
    if (!counterparty?.id) return;
    void getCounterpartyLedgerKpisAction({
      counterpartyId: counterparty.id,
      startDate: range.startDate ?? undefined,
      endDate: range.endDate ?? undefined,
    }).then(setLedger);
  }, [counterparty?.id, range.startDate, range.endDate]);

  useEffect(() => {
    reloadLedgerKpis();
  }, [reloadLedgerKpis]);

  useOnIcFundsVoucherPosted(detail => {
    if (!counterparty?.id || !voucherPostedTargetsCounterparty(detail, counterparty.id)) return;
    reloadLedgerKpis();
  });

  if (!counterparty && icSuppliers.length > 0) {
    return notFound();
  }

  if (!counterparty) return null;

  const listHref = counterpartyListPath(branchSlug ? { branchSlug } : undefined);
  const rolesLabel = formatCounterpartyRolesLabel(counterparty.roles);

  const voucherBook = pickCounterpartyVoucherBook(ledger.aed.accountId, ledger.inr.accountId);
  const partyAccountId = counterpartyPartyAccountId(voucherBook, ledger.aed.accountId, ledger.inr.accountId);
  const paymentHref = counterpartyVoucherHref('payment', {
    partyAccountId,
    book: voucherBook,
    branchSlug,
  });
  const receiptHref = counterpartyVoucherHref('receipt', {
    partyAccountId,
    book: voucherBook,
    branchSlug,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[{ label: 'Counterparties', href: listHref }, { label: counterparty.name }]}
        subtitle={`${counterparty.code?.trim() || 'No code'} · ${rolesLabel} · ${counterparty.status === 'inactive' ? 'Inactive' : 'Active'}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canWrite ? (
              <>
                <Link href={paymentHref} className={`${asicBtnPrimary} no-underline`} {...wp()}>
                  Payment
                </Link>
                <Link href={receiptHref} className={`${asicBtnOutline} no-underline`} {...wp()}>
                  Receipt
                </Link>
              </>
            ) : (
              <>
                <span className={`${asicBtnPrimary} cursor-not-allowed opacity-50`} {...wp()}>
                  Payment
                </span>
                <span className={`${asicBtnOutline} cursor-not-allowed opacity-50`} {...wp()}>
                  Receipt
                </span>
              </>
            )}
            <button
              type="button"
              className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
              onClick={canWrite ? () => setEditOpen(true) : undefined}
              {...wp()}
            >
              Edit
            </button>
          </div>
        }
      />

      <ICTransferDateFilterBar
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
      />

      <AsicKpiStrip
        columns={4}
        metrics={buildLedgerAccountMetrics({
          book: ledger.aed,
          rangeLabel,
          currency: 'AED',
        })}
      />
      <AsicKpiStrip
        columns={4}
        metrics={buildLedgerAccountMetrics({
          book: ledger.inr,
          rangeLabel,
          currency: 'INR',
        })}
      />

      <CounterpartyDetailTabs
        counterpartyId={counterparty.id}
        range={range}
        branchSlug={branchSlug}
      />

      <CounterpartyModal
        open={editOpen}
        counterparty={counterparty}
        branchId={counterparty.branchId}
        branchSlug={branchSlug}
        onClose={() => setEditOpen(false)}
        onSaved={() => setEditOpen(false)}
      />
    </div>
  );
}
