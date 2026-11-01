'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { notFound } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { findCounterpartyByRouteParam } from '@/lib/counterparties/counterpartySlug';
import {
  computeSingleCounterpartyMetrics,
  counterpartyTotalProfitAed,
} from '@/lib/counterparties/counterpartyMetrics';
import { counterpartyListPath } from '@/lib/counterparties/navigation';
import CounterpartyDetailTabs from '@/components/counterparties/CounterpartyDetailTabs';
import CounterpartyModal from '@/components/counterparties/CounterpartyModal';
import { resolveDateFilterRange, getDateFilterLabel } from '@/lib/dateFilterRange';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import ICTransferDateFilterBar from '@/components/ic-transfer/shared/ICTransferDateFilterBar';
import { useICTransferFilters } from '@/components/ic-transfer/ui';
import { asicBtnOutline, asicCard, asicFormGridLoose } from '@/components/asic/ui';
import { useWriteAccess } from '@/context/RbacWriteContext';

type Props = {
  counterpartyId: string;
  branchSlug?: string;
};

function fmtKpiAed(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dealCountHint(count: number, rangeLabel: string): string {
  return `${count} ${count === 1 ? 'deal' : 'deals'} · ${rangeLabel}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-900">{value}</p>
    </div>
  );
}

export default function CounterpartyDetailsClient({ counterpartyId, branchSlug }: Props) {
  const { icSuppliers, icPurchases, icSales } = useApp();
  const { canWrite, buttonProps: wp } = useWriteAccess();
  const [editOpen, setEditOpen] = useState(false);

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

  const kpiMetrics = useMemo(() => {
    if (!counterparty) {
      return {
        cashPurchases: 0,
        metalPurchases: 0,
        cashSales: 0,
        metalSales: 0,
        cashPurchaseAed: 0,
        metalPurchaseAed: 0,
        cashSaleAed: 0,
        metalSaleAed: 0,
        cashGrossProfitAed: 0,
        metalProfitAed: 0,
        metalProfitInr: 0,
      };
    }
    return computeSingleCounterpartyMetrics(counterparty.id, icPurchases, icSales, range);
  }, [counterparty, icPurchases, icSales, range]);

  const totalProfitAed = useMemo(
    () => counterpartyTotalProfitAed(kpiMetrics.cashGrossProfitAed, kpiMetrics.metalProfitAed),
    [kpiMetrics.cashGrossProfitAed, kpiMetrics.metalProfitAed],
  );

  if (!counterparty && icSuppliers.length > 0) {
    return notFound();
  }

  if (!counterparty) return null;

  const listHref = counterpartyListPath(branchSlug ? { branchSlug } : undefined);
  const locationLabel =
    [counterparty.locality, counterparty.subdivision, counterparty.country].filter(Boolean).join(', ') || '—';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AsicPageHeader
        breadcrumbs={[
          { label: 'Counterparties', href: listHref },
          { label: counterparty.name },
        ]}
        actions={
          <button
            type="button"
            className={`${asicBtnOutline}${!canWrite ? ' cursor-not-allowed opacity-50' : ''}`}
            onClick={canWrite ? () => setEditOpen(true) : undefined}
            {...wp()}
          >
            Edit profile
          </button>
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
        metrics={[
          {
            label: 'Code',
            value: counterparty.code?.trim() || '—',
            hint: counterparty.status === 'inactive' ? 'Inactive' : 'Active',
            tone: counterparty.status === 'inactive' ? 'slate' : 'indigo',
          },
          {
            label: 'IC purchases',
            value: fmtKpiAed(kpiMetrics.cashPurchaseAed),
            hint: dealCountHint(kpiMetrics.cashPurchases, rangeLabel),
          },
          {
            label: 'IC sales',
            value: fmtKpiAed(kpiMetrics.cashSaleAed),
            hint: dealCountHint(kpiMetrics.cashSales, rangeLabel),
            tone: 'emerald',
          },
          {
            label: 'Location',
            value: locationLabel.length > 28 ? `${locationLabel.slice(0, 26)}…` : locationLabel,
            hint: 'Registered address',
          },
          {
            label: 'Metal purchases',
            value: fmtKpiAed(kpiMetrics.metalPurchaseAed),
            hint: dealCountHint(kpiMetrics.metalPurchases, rangeLabel),
            tone: 'indigo',
          },
          {
            label: 'Metal sales',
            value: fmtKpiAed(kpiMetrics.metalSaleAed),
            hint: dealCountHint(kpiMetrics.metalSales, rangeLabel),
            tone: 'amber',
          },
          {
            label: 'IC profit',
            value: fmtKpiAed(kpiMetrics.cashGrossProfitAed),
            hint: 'WAC on IC sales',
            tone: kpiMetrics.cashGrossProfitAed >= 0 ? 'emerald' : 'red',
          },
          {
            label: 'Metal profit',
            value: fmtKpiAed(kpiMetrics.metalProfitAed),
            hint: 'Sale − purchase AED',
            tone: kpiMetrics.metalProfitAed >= 0 ? 'emerald' : 'red',
          },
          {
            label: 'Total profit',
            value: fmtKpiAed(totalProfitAed),
            hint: rangeLabel,
            tone: totalProfitAed >= 0 ? 'emerald' : 'red',
          },
        ]}
        columns={3}
      />

      <div className={`${asicCard} mb-3`}>
        <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <h3 className="text-sm font-semibold text-slate-900">Profile</h3>
        </div>
        <div className={`${asicFormGridLoose} p-3 sm:p-4`}>
          <DetailRow label="Phone" value={counterparty.phone || '—'} />
          <DetailRow label="Email" value={counterparty.email || '—'} />
          <DetailRow
            label="Address"
            value={
              counterparty.address ? (
                <span className="line-clamp-3" title={counterparty.address}>
                  {counterparty.address}
                </span>
              ) : (
                '—'
              )
            }
          />
          <DetailRow label="Location" value={locationLabel} />
          <DetailRow
            label="Commission"
            value={counterparty.commission != null ? `${counterparty.commission}%` : '—'}
          />
          <DetailRow label="Status" value={counterparty.status === 'inactive' ? 'Inactive' : 'Active'} />
        </div>
      </div>

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
