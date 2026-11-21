'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { findCounterpartyByRouteParam } from '@/lib/counterparties/counterpartySlug';
import { counterpartyListPath } from '@/lib/counterparties/navigation';
import {
  counterpartyIsAgent,
  counterpartyIsManager,
  formatCounterpartyRolesLabel,
} from '@/lib/counterparties/roles';
import CounterpartyDetailTabs from '@/components/counterparties/CounterpartyDetailTabs';
import CounterpartyManagerScopeTabs from '@/components/counterparties/CounterpartyManagerScopeTabs';
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
import { indexSaleLineProfits } from '@/lib/icTransfer/dealProfit';
import {
  getCounterpartyLedgerKpisAction,
  type CounterpartyLedgerKpis,
} from '@/app/actions/icFundsActions';
import type { ICBranchDeposit } from '@/types';
import { filterCounterpartyDeposits, filterCounterpartySales } from '@/lib/counterparties/counterpartyActivity';

type Props = {
  counterpartyId: string;
  branchSlug?: string;
};

const EMPTY_KPIS: CounterpartyLedgerKpis = {
  aed: { accountId: null, accountName: null, opening: 0, periodDebit: 0, periodCredit: 0, closing: 0 },
  inr: { accountId: null, accountName: null, opening: 0, periodDebit: 0, periodCredit: 0, closing: 0 },
};

export default function CounterpartyDetailsClient({ counterpartyId, branchSlug }: Props) {
  const { icSuppliers, icPurchases, icSales, icWarehouses } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [editOpen, setEditOpen] = useState(false);
  const [ledger, setLedger] = useState<CounterpartyLedgerKpis>(EMPTY_KPIS);
  const [managerDeposits, setManagerDeposits] = useState<ICBranchDeposit[]>([]);

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

  const isManager = counterparty ? counterpartyIsManager(counterparty) : false;
  const isAgent = counterparty ? counterpartyIsAgent(counterparty) : false;
  const noPartyLedger = isManager || isAgent;

  const periodSales = useMemo(
    () => counterparty ? filterCounterpartySales(icSales, counterparty.id, range) : [],
    [counterparty, icSales, range],
  );
  const saleProfits = useMemo(
    () => indexSaleLineProfits({ purchases: icPurchases, sales: icSales, range, warehouses: icWarehouses }),
    [icPurchases, icSales, icWarehouses, range],
  );
  const periodProfit = useMemo(() => {
    let aed = 0;
    let inr = 0;
    for (const sale of periodSales) {
      const profit = saleProfits.get(sale.id);
      if (!profit) continue;
      if (profit.currency === 'AED') aed += profit.amount;
      else inr += profit.amount;
      if (profit.secondaryCurrency === 'AED') aed += profit.secondaryAmount ?? 0;
      if (profit.secondaryCurrency === 'INR') inr += profit.secondaryAmount ?? 0;
    }
    return { aed, inr };
  }, [periodSales, saleProfits]);

  const reloadLedgerKpis = useCallback(() => {
    if (!counterparty?.id || noPartyLedger) return;
    void getCounterpartyLedgerKpisAction({
      counterpartyId: counterparty.id,
      startDate: range.startDate ?? undefined,
      endDate: range.endDate ?? undefined,
    }).then(setLedger);
  }, [counterparty?.id, range.startDate, range.endDate, noPartyLedger]);

  useEffect(() => {
    reloadLedgerKpis();
  }, [reloadLedgerKpis]);

  useOnIcFundsVoucherPosted(detail => {
    if (!counterparty?.id || !voucherPostedTargetsCounterparty(detail, counterparty.id)) return;
    reloadLedgerKpis();
  });

  const managerPeriodDeposits = useMemo(
    () => filterCounterpartyDeposits(managerDeposits, range),
    [managerDeposits, range],
  );

  const managerDepositAed = useMemo(
    () => managerPeriodDeposits.reduce((s, d) => s + Number(d.amountAed || 0), 0),
    [managerPeriodDeposits],
  );

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

  const showPartyLedgerActions = !noPartyLedger;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[{ label: 'Counterparties', href: listHref }, { label: counterparty.name }]}
        subtitle={`${counterparty.code?.trim() || 'No code'} · ${rolesLabel} · ${counterparty.status === 'inactive' ? 'Inactive' : 'Active'}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showPartyLedgerActions ? (
              canWrite ? (
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
              )
            ) : null}
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

      {isManager ? (
        <AsicKpiStrip
          columns={3}
          metrics={[
            {
              label: 'Period deposits (AED)',
              value: fmtLedgerAed(managerDepositAed),
              hint: rangeLabel,
            },
            {
              label: 'Deposit count',
              value: String(managerPeriodDeposits.length),
              hint: 'UAE branch desks',
            },
            {
              label: 'Scope',
              value: 'Manager',
              hint: 'Deals & P&R tagged with this manager',
            },
          ]}
        />
      ) : isAgent ? (
        <AsicKpiStrip
          columns={2}
          metrics={[
            { label: 'Scope', value: 'Agent', hint: 'Metal AED routing tag — no ledger' },
            { label: 'Period', value: rangeLabel, hint: 'Filter' },
          ]}
        />
      ) : null}

      {!noPartyLedger ? (
        <>
          <AsicKpiStrip
            columns={5}
            metrics={[
              ...buildLedgerAccountMetrics({ book: ledger.aed, rangeLabel, currency: 'AED' }),
              {
                label: 'AED profit',
                value: fmtLedgerAed(periodProfit.aed),
                hint: `Deal profit Â· ${rangeLabel}`,
                tone: periodProfit.aed > 0 ? 'emerald' : periodProfit.aed < 0 ? 'red' : 'slate',
              },
            ]}
          />
          <AsicKpiStrip
            columns={5}
            metrics={[
              ...buildLedgerAccountMetrics({ book: ledger.inr, rangeLabel, currency: 'INR' }),
              {
                label: 'INR profit',
                value: fmtLedgerInr(periodProfit.inr),
                hint: `Deal profit Â· ${rangeLabel}`,
                tone: periodProfit.inr > 0 ? 'emerald' : periodProfit.inr < 0 ? 'red' : 'slate',
              },
            ]}
          />
        </>
      ) : null}

      {isManager ? (
        <CounterpartyManagerScopeTabs
          managerId={counterparty.id}
          range={range}
          branchSlug={branchSlug}
          onDepositsLoaded={setManagerDeposits}
        />
      ) : (
        <CounterpartyDetailTabs
          counterpartyId={counterparty.id}
          range={range}
          branchSlug={branchSlug}
          onLedgerRepaired={reloadLedgerKpis}
        />
      )}

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
