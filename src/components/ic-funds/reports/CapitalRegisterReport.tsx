'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { listCapitalAllocationsAction, listCapitalMovementsAction } from '@/app/actions/capitalActions';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfCard, icfTable, icfTableWrap, icfTd, icfTh, icfTheadRow } from '@/components/ic-funds/ui';

export default function CapitalRegisterReport() {
  const [movements, setMovements] = useState<
    Extract<Awaited<ReturnType<typeof listCapitalMovementsAction>>, { success: true }>['data']
  >([]);
  const [allocations, setAllocations] = useState<
    Extract<Awaited<ReturnType<typeof listCapitalAllocationsAction>>, { success: true }>['data']
  >([]);

  useEffect(() => {
    void Promise.all([listCapitalMovementsAction(200), listCapitalAllocationsAction(200)]).then(([m, a]) => {
      if (m.success) setMovements(m.data);
      if (a.success) setAllocations(a.data);
    });
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Manage investors and opening capital on{' '}
        <Link href="/admin/capital" className="font-medium text-red-700 underline">
          Capital
        </Link>
        .
      </p>
      <div className={icfCard}>
        <h3 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Capital movements</h3>
        <div className={icfTableWrap}>
          <table className={icfTable}>
            <thead>
              <tr className={icfTheadRow}>
                <th className={icfTh}>Date</th>
                <th className={icfTh}>Type</th>
                <th className={icfTh}>Investor</th>
                <th className={icfTh}>Book</th>
                <th className={icfTh}>Amount</th>
                <th className={icfTh}>AED eq</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(row => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className={icfTd}>{row.lotDate}</td>
                  <td className={`${icfTd} capitalize`}>{row.movementType}</td>
                  <td className={icfTd}>{row.investorName}</td>
                  <td className={icfTd}>{row.book}</td>
                  <td className={icfTd}>
                    {row.book === 'INR' ? <FmtLedgerInr amount={row.amountNative} /> : <FmtLedgerAed amount={row.amountNative} />}
                  </td>
                  <td className={icfTd}><FmtLedgerAed amount={row.aedEq} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={icfCard}>
        <h3 className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Profit allocations</h3>
        <div className={icfTableWrap}>
          <table className={icfTable}>
            <thead>
              <tr className={icfTheadRow}>
                <th className={icfTh}>Date</th>
                <th className={icfTh}>Investor</th>
                <th className={icfTh}>Kind</th>
                <th className={icfTh}>Allocated</th>
                <th className={icfTh}>Share bps</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map(row => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className={icfTd}>{row.voucherDate}</td>
                  <td className={icfTd}>{row.investorName}</td>
                  <td className={`${icfTd} capitalize`}>{row.kind}</td>
                  <td className={icfTd}>
                    {row.book === 'INR' ? <FmtLedgerInr amount={row.allocatedAmount} /> : <FmtLedgerAed amount={row.allocatedAmount} />}
                  </td>
                  <td className={icfTd}>{row.shareBps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
