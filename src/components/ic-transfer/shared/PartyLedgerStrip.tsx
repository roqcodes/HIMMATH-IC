'use client';

import React, { useEffect, useState } from 'react';
import {
  getCounterpartyLedgerKpisAction,
  type CounterpartyBookSnapshot,
} from '@/app/actions/icFundsActions';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';

type Props = {
  counterpartyId: string;
  partyLabel?: string;
  /** Cash IC deals use the AED book; metal uses INR. */
  book: 'AED' | 'INR';
};

function Amount({ n, book }: { n: number; book: 'AED' | 'INR' }) {
  const Node = book === 'INR' ? FmtLedgerInr : FmtLedgerAed;
  return <Node amount={n} />;
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

export default function PartyLedgerStrip({ counterpartyId, partyLabel, book }: Props) {
  const [snap, setSnap] = useState<CounterpartyBookSnapshot | null>(null);

  useEffect(() => {
    if (!counterpartyId) {
      setSnap(null);
      return;
    }
    let cancelled = false;
    setSnap(null);
    void getCounterpartyLedgerKpisAction({ counterpartyId })
      .then(next => {
        if (!cancelled) setSnap(book === 'INR' ? next.inr : next.aed);
      })
      .catch(() => {
        if (!cancelled) setSnap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [counterpartyId, book]);

  if (!counterpartyId) return null;

  const debit = snap?.periodDebit ?? 0;
  const credit = snap?.periodCredit ?? 0;
  const balance = snap?.closing ?? 0;
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
          <Amount n={debit} book={book} />
        </div>
      </div>
      <div className="border-r border-slate-200 px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Credit</div>
        <div className="mt-0.5 font-mono font-semibold tabular-nums text-red-600">
          <Amount n={credit} book={book} />
        </div>
      </div>
      <div className="px-2.5 py-1.5">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Balance</div>
        <div className="mt-0.5 font-semibold">
          <Balance n={balance} book={book} />
        </div>
      </div>
    </div>
  );
}
