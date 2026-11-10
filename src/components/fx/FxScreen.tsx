'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip, { type AsicKpiMetric } from '@/components/asic/AsicKpiStrip';
import AsicFormField from '@/components/asic/AsicFormField';
import { asicBtnPrimary, asicFormGrid, asicInput, asicTextarea } from '@/components/asic/ui';
import FormattedNumberInput from '@/components/ic-transfer/shared/FormattedNumberInput';
import { getFxPageDataAction, postCurrencyExchangeAction, type FxExchangeRow } from '@/app/actions/fxActions';
import { computeCurrencyExchangeAmounts, type FxDirection } from '@/lib/fx/amounts';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { notifyIcFundsVoucherPosted } from '@/lib/icFunds/voucherPostedNotify';
import { icfCard, icfTable, icfTableWrap, icfTd, icfTh, icfTheadRow, icfTr } from '@/components/ic-funds/ui';
import { useApp } from '@/context/AppContext';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { ASICKPISkeleton, ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';

type BankOpt = { id: string; name: string; balance: number };

export default function FxScreen() {
  const { showToast } = useApp();
  const { canWrite, buttonProps } = useWriteAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banksAed, setBanksAed] = useState<BankOpt[]>([]);
  const [banksInr, setBanksInr] = useState<BankOpt[]>([]);
  const [cashAed, setCashAed] = useState(0);
  const [cashInr, setCashInr] = useState(0);
  const [exchanges, setExchanges] = useState<FxExchangeRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [direction, setDirection] = useState<FxDirection>('aed_to_inr');
  const [sourceAmount, setSourceAmount] = useState(0);
  const [inrPerAed, setInrPerAed] = useState(0);
  const [aedBankId, setAedBankId] = useState('');
  const [inrBankId, setInrBankId] = useState('');
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getFxPageDataAction();
    if (!res.success) {
      setLoadError(res.error);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setBanksAed(res.data.banks.aed);
    setBanksInr(res.data.banks.inr);
    setCashAed(res.data.cashAed);
    setCashInr(res.data.cashInr);
    setExchanges(res.data.exchanges);
    setAedBankId(prev => prev || res.data.banks.aed[0]?.id || '');
    setInrBankId(prev => prev || res.data.banks.inr[0]?.id || '');
    setInrPerAed(prev => (prev > 0 ? prev : res.data.defaultInrPerAed));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = computeCurrencyExchangeAmounts(direction, sourceAmount, inrPerAed);

  const kpis = useMemo((): AsicKpiMetric[] => {
    return [
      { label: 'Cash (AED)', value: <FmtLedgerAed amount={cashAed} />, hint: 'Available to sell into INR', tone: 'emerald' },
      { label: 'Cash (INR)', value: <FmtLedgerInr amount={cashInr} />, hint: 'Available to sell into AED', tone: 'emerald' },
    ];
  }, [cashAed, cashInr]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    const res = await postCurrencyExchangeAction({
      direction,
      sourceAmount,
      inrPerAed,
      aedBankAccountId: aedBankId,
      inrBankAccountId: inrBankId,
      voucherDate,
      notes,
    });
    setSaving(false);
    if (!res.success) {
      showToast(res.error, 'error');
      return;
    }
    showToast(
      direction === 'aed_to_inr'
        ? `Exchanged ${res.data.aed.toFixed(2)} AED for ${res.data.inr.toFixed(2)} INR`
        : `Exchanged ${res.data.inr.toFixed(2)} INR for ${res.data.aed.toFixed(2)} AED`,
      'success',
    );
    notifyIcFundsVoucherPosted();
    setSourceAmount(0);
    setNotes('');
    void load();
  };

  return (
    <div className="space-y-3">
      <AsicPageHeader
        title="FX"
        subtitle="Move cash between AED and INR at an agreed rate. This is not metal profit and does not change investor allocations."
      />

      {loading && exchanges.length === 0 ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading FX">
          <ASICKPISkeleton count={2} />
          <ASICTableSkeleton rows={4} cols={5} />
        </div>
      ) : null}

      {loadError ? (
        <div className={`${icfCard} space-y-3 p-4`}>
          <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>
          <button type="button" className={asicBtnPrimary} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {!loadError ? (
        <>
          <AsicKpiStrip metrics={kpis} />

          <form className={`${icfCard} p-4`} onSubmit={e => void onSubmit(e)}>
            <div className={asicFormGrid}>
              <AsicFormField label="Direction" colSpan={6}>
                <div
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 text-xs font-semibold shadow-surface-xs dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)]"
                  role="group"
                  aria-label="Exchange direction"
                >
                  <button
                    type="button"
                    disabled={!canWrite}
                    className={`rounded-md px-3 py-1.5 ${
                      direction === 'aed_to_inr'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border)]'
                        : 'text-slate-500 dark:text-[var(--theme-text-secondary)]'
                    }`}
                    onClick={() => setDirection('aed_to_inr')}
                  >
                    AED → INR
                  </button>
                  <button
                    type="button"
                    disabled={!canWrite}
                    className={`rounded-md px-3 py-1.5 ${
                      direction === 'inr_to_aed'
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80 dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text)] dark:ring-[var(--theme-border)]'
                        : 'text-slate-500 dark:text-[var(--theme-text-secondary)]'
                    }`}
                    onClick={() => setDirection('inr_to_aed')}
                  >
                    INR → AED
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-[var(--theme-text-secondary)]">
                  {direction === 'aed_to_inr'
                    ? 'Sell AED from HIMMATH, receive INR cash.'
                    : 'Sell INR cash, receive AED in HIMMATH.'}
                </p>
              </AsicFormField>
              <AsicFormField label="Date" htmlFor="fx-date" colSpan={6}>
                <input
                  id="fx-date"
                  type="date"
                  className={asicInput}
                  value={voucherDate}
                  onChange={e => setVoucherDate(e.target.value)}
                  disabled={!canWrite}
                />
              </AsicFormField>
              <AsicFormField
                label={direction === 'aed_to_inr' ? 'AED amount' : 'INR amount'}
                htmlFor="fx-amount"
                colSpan={4}
              >
                <FormattedNumberInput
                  id="fx-amount"
                  value={sourceAmount}
                  onNumericChange={setSourceAmount}
                  book={direction === 'aed_to_inr' ? 'aed' : 'inr'}
                  className={asicInput}
                  disabled={!canWrite}
                />
              </AsicFormField>
              <AsicFormField label="INR per AED" htmlFor="fx-rate" colSpan={4}>
                <FormattedNumberInput
                  id="fx-rate"
                  value={inrPerAed}
                  onNumericChange={setInrPerAed}
                  book="inr"
                  className={asicInput}
                  disabled={!canWrite}
                />
              </AsicFormField>
              <AsicFormField label={direction === 'aed_to_inr' ? 'INR received' : 'AED received'} colSpan={4}>
                <p className="flex h-8 items-center text-sm font-medium tabular-nums text-slate-900 dark:text-[var(--theme-text)]">
                  {direction === 'aed_to_inr' ? (
                    <FmtLedgerInr amount={computed.inr} />
                  ) : (
                    <FmtLedgerAed amount={computed.aed} />
                  )}
                </p>
              </AsicFormField>
              <AsicFormField label="AED bank" htmlFor="fx-aed-bank" colSpan={6}>
                <select
                  id="fx-aed-bank"
                  className={asicInput}
                  value={aedBankId}
                  onChange={e => setAedBankId(e.target.value)}
                  disabled={!canWrite}
                >
                  {banksAed.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </AsicFormField>
              <AsicFormField label="INR bank" htmlFor="fx-inr-bank" colSpan={6}>
                <select
                  id="fx-inr-bank"
                  className={asicInput}
                  value={inrBankId}
                  onChange={e => setInrBankId(e.target.value)}
                  disabled={!canWrite}
                >
                  {banksInr.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </AsicFormField>
              <AsicFormField label="Notes" htmlFor="fx-notes" colSpan={12}>
                <textarea
                  id="fx-notes"
                  className={asicTextarea}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  disabled={!canWrite}
                  rows={2}
                />
              </AsicFormField>
            </div>
            {canWrite ? (
              <div className="mt-3 flex justify-end">
                <button type="submit" className={`${asicBtnPrimary} gap-1.5`} disabled={saving} {...buttonProps}>
                  <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden />
                  {saving ? 'Posting…' : 'Post exchange'}
                </button>
              </div>
            ) : null}
          </form>

          <div className={icfCard}>
            <div className={icfTableWrap}>
              <table className={`${icfTable} min-w-[720px]`}>
                <thead>
                  <tr className={icfTheadRow}>
                    <th className={icfTh}>Date</th>
                    <th className={icfTh}>Direction</th>
                    <th className={icfTh}>AED</th>
                    <th className={icfTh}>INR</th>
                    <th className={icfTh}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {exchanges.length === 0 ? (
                    <tr className={icfTr}>
                      <td className={icfTd} colSpan={5}>
                        No exchanges yet. Convert AED to INR here before paying INR profit due.
                      </td>
                    </tr>
                  ) : (
                    exchanges.map(row => (
                      <tr key={row.id} className={icfTr}>
                        <td className={icfTd}>{row.voucherDate}</td>
                        <td className={icfTd}>{row.direction === 'aed_to_inr' ? 'AED → INR' : 'INR → AED'}</td>
                        <td className={icfTd}>
                          <FmtLedgerAed amount={row.aedAmount} />
                        </td>
                        <td className={icfTd}>
                          <FmtLedgerInr amount={row.inrAmount} />
                        </td>
                        <td className={icfTd}>{row.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
