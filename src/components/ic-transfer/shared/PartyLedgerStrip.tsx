'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getCounterpartyLedgerKpisAction,
  type CounterpartyBookSnapshot,
} from '@/app/actions/icFundsActions';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import type { EntityLedgerBalances } from '@/lib/icTransfer/entitySearchOptions';
import { voucherPostedTargetsCounterparty } from '@/lib/icFunds/voucherPostedNotify';
import { useOnIcFundsVoucherPosted } from '@/hooks/useOnIcFundsVoucherPosted';

type Props = {
  counterpartyId: string;
  partyLabel?: string;
  /** Cash IC deals use the AED book; metal uses INR. */
  book: 'AED' | 'INR';
  /** Modal snapshot balances (same source as customer search detail). */
  balances?: EntityLedgerBalances;
};

function Amount({
  n,
  book,
  loading,
}: {
  n: number;
  book: 'AED' | 'INR';
  loading?: boolean;
}) {
  if (loading) {
    return <span className="text-slate-300">…</span>;
  }
  const Node = book === 'INR' ? FmtLedgerInr : FmtLedgerAed;
  return <Node amount={n} zeroDisplay="—" />;
}

function Balance({ n, book }: { n: number; book: 'AED' | 'INR' }) {
  if (Math.abs(n) < 0.005) {
    return (
      <span className="font-mono tabular-nums text-slate-900">
        <Amount n={0} book={book} />
      </span>
    );
  }
  const tone = n > 0 ? 'text-slate-900' : 'text-red-600';
  const side = n > 0 ? 'Dr' : 'Cr';
  return (
    <span className={`font-mono tabular-nums ${tone}`}>
      <Amount n={Math.abs(n)} book={book} /> {side}
    </span>
  );
}

export default function PartyLedgerStrip({ counterpartyId, partyLabel, book, balances }: Props) {
  const [snap, setSnap] = useState<CounterpartyBookSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const hintBalance = book === 'INR' ? balances?.inr ?? 0 : balances?.aed ?? 0;

  const loadSnap = useCallback(() => {
    if (!counterpartyId) {
      setSnap(null);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    void getCounterpartyLedgerKpisAction({ counterpartyId })
      .then(next => {
        if (id !== requestId.current) return;
        setSnap(book === 'INR' ? next.inr : next.aed);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setSnap(null);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [counterpartyId, book]);

  useEffect(() => {
    setSnap(null);
    loadSnap();
  }, [loadSnap, balances?.aed, balances?.inr]);

  useOnIcFundsVoucherPosted(detail => {
    if (!voucherPostedTargetsCounterparty(detail, counterpartyId)) return;
    loadSnap();
  });

  if (!counterpartyId) return null;

  const hasKpi = Boolean(snap?.accountId);
  const debit = hasKpi ? snap!.periodDebit : 0;
  const credit = hasKpi ? snap!.periodCredit : 0;
  const closing = hasKpi ? snap!.closing : hintBalance;
  const kpiPending = loading && !hasKpi;

  const title = partyLabel?.trim() ? `${partyLabel} · ${book}` : book;

  return (
    <div
      className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-[11px]"
      role="group"
      aria-label={`${title} ledger`}
    >
      <div className="border-r border-slate-200 px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Debit</div>
        <div className="mt-0.5 font-mono font-semibold tabular-nums text-slate-900">
          <Amount n={debit} book={book} loading={kpiPending} />
        </div>
      </div>
      <div className="border-r border-slate-200 px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Credit</div>
        <div className="mt-0.5 font-mono font-semibold tabular-nums text-red-600">
          <Amount n={credit} book={book} loading={kpiPending} />
        </div>
      </div>
      <div className="px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Balance</div>
        <div className="mt-0.5 font-semibold">
          <Balance n={closing} book={book} />
        </div>
      </div>
    </div>
  );
}
