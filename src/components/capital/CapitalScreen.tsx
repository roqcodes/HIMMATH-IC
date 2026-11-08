'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import {
  createCapitalInvestorAction,
  getCapitalDashboardAction,
  listCapitalBankAccountsAction,
  listCapitalMovementsAction,
  listCapitalAllocationsAction,
  postCapitalMovementAction,
  setCapitalOpeningAction,
  setManagementShareAction,
} from '@/app/actions/capitalActions';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import { icfBtnPrimary, icfCard, icfInput, icfLabel, icfTable, icfTableWrap, icfTd, icfTh, icfTheadRow } from '@/components/ic-funds/ui';
import { useApp } from '@/context/AppContext';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { ASICKPISkeleton, ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import type { AsicKpiMetric } from '@/components/asic/AsicKpiStrip';

type TabId = 'investors' | 'movements' | 'allocations';

export default function CapitalScreen() {
  const { showToast } = useApp();
  const { canWrite, buttonProps } = useWriteAccess();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('investors');
  const [data, setData] = useState<Awaited<ReturnType<typeof getCapitalDashboardAction>> extends { success: true; data: infer D } ? D : null>(null);
  const [movements, setMovements] = useState<Awaited<ReturnType<typeof listCapitalMovementsAction>> extends { success: true; data: infer M } ? M : []>([]);
  const [allocations, setAllocations] = useState<Awaited<ReturnType<typeof listCapitalAllocationsAction>> extends { success: true; data: infer A } ? A : []>([]);
  const [banksAed, setBanksAed] = useState<Array<{ id: string; name: string }>>([]);
  const [banksInr, setBanksInr] = useState<Array<{ id: string; name: string }>>([]);

  const [modal, setModal] = useState<
    'investor' | 'opening' | 'management' | 'deposit' | 'withdraw' | 'payout' | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dash, mov, alloc, aed, inr] = await Promise.all([
        getCapitalDashboardAction(),
        listCapitalMovementsAction(80),
        listCapitalAllocationsAction(120),
        listCapitalBankAccountsAction('AED'),
        listCapitalBankAccountsAction('INR'),
      ]);
      if (!dash.success) throw new Error(dash.error);
      setData(dash.data);
      if (mov.success) setMovements(mov.data);
      if (alloc.success) setAllocations(alloc.data);
      if (aed.success) setBanksAed(aed.data.map(b => ({ id: b.id, name: b.name })));
      if (inr.success) setBanksInr(inr.data.map(b => ({ id: b.id, name: b.name })));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load capital';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo((): AsicKpiMetric[] => {
    if (!data) return [];
    return [
      { label: 'Cash (AED)', value: <FmtLedgerAed amount={data.cashAed} />, hint: 'HQ bank accounts', tone: 'emerald' },
      { label: 'Cash (INR)', value: <FmtLedgerInr amount={data.cashInr} />, hint: 'HQ bank accounts', tone: 'emerald' },
      { label: 'Capital (AED eq)', value: <FmtLedgerAed amount={data.capitalAedEq} />, hint: 'Ownership pie', tone: 'indigo' },
      { label: 'Profit due (AED)', value: <FmtLedgerAed amount={data.profitDueAed} />, hint: 'After allocations', tone: 'amber' },
      { label: 'Profit due (INR)', value: <FmtLedgerInr amount={data.profitDueInr} />, hint: 'Metal book share', tone: 'amber' },
      {
        label: 'Management share',
        value: `${data.managementSharePct.toFixed(2)}%`,
        hint: 'Management cut — default receiver HQ',
        tone: 'slate',
      },
    ];
  }, [data]);

  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="space-y-3">
      <AsicPageHeader title="Capital" />

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading capital">
          <ASICKPISkeleton count={6} />
          <ASICTableSkeleton rows={6} cols={7} />
        </div>
      ) : null}

      {!loading && !data && loadError ? (
        <div className={`${icfCard} space-y-2 p-4`}>
          <p className="text-sm text-red-700">{loadError}</p>
          <p className="text-sm text-slate-600">
            If this is the first visit, apply the capital migration on the database, then refresh.
          </p>
          <button type="button" className={icfBtnPrimary} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <AsicKpiStrip metrics={kpis} />

          <div className="flex flex-wrap gap-2">
            {canWrite ? (
              <>
                <button type="button" className={icfBtnPrimary} onClick={() => setModal('investor')}>
                  Add investor
                </button>
                <button type="button" className={icfBtnPrimary} onClick={() => setModal('opening')}>
                  Opening capital
                </button>
                <button type="button" className={icfBtnPrimary} onClick={() => setModal('management')}>
                  Management share
                </button>
                <button type="button" className={icfBtnPrimary} onClick={() => setModal('deposit')}>
                  Deposit
                </button>
                <button type="button" className={icfBtnPrimary} onClick={() => setModal('withdraw')}>
                  Withdraw
                </button>
                <button type="button" className={icfBtnPrimary} onClick={() => setModal('payout')}>
                  Payout
                </button>
              </>
            ) : null}
          </div>

          <div className="flex gap-2 border-b border-slate-200 text-sm">
            <button
              type="button"
              className={`px-3 py-2 ${tab === 'investors' ? 'border-b-2 border-red-600 font-semibold text-slate-900' : 'text-slate-500'}`}
              onClick={() => setTab('investors')}
            >
              Investors
            </button>
            <button
              type="button"
              className={`px-3 py-2 ${tab === 'movements' ? 'border-b-2 border-red-600 font-semibold text-slate-900' : 'text-slate-500'}`}
              onClick={() => setTab('movements')}
            >
              Movements
            </button>
            <button
              type="button"
              className={`px-3 py-2 ${tab === 'allocations' ? 'border-b-2 border-red-600 font-semibold text-slate-900' : 'text-slate-500'}`}
              onClick={() => setTab('allocations')}
            >
              Profit allocations
            </button>
          </div>

          <div className={icfCard}>
            {tab === 'investors' ? (
              <div className={icfTableWrap}>
                <table className={icfTable}>
                  <thead>
                    <tr className={icfTheadRow}>
                      <th className={icfTh}>Investor</th>
                      <th className={icfTh}>Capital AED</th>
                      <th className={icfTh}>Capital INR</th>
                      <th className={icfTh}>AED equivalent</th>
                      <th className={icfTh}>% of pie</th>
                      <th className={icfTh}>Profit due AED</th>
                      <th className={icfTh}>Profit due INR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.investors.map(row => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className={icfTd}>
                          {row.name}
                          {row.isHouse ? <span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">HQ</span> : null}
                        </td>
                        <td className={`${icfTd} tabular-nums`}><FmtLedgerAed amount={row.capitalAed} /></td>
                        <td className={`${icfTd} tabular-nums`}><FmtLedgerInr amount={row.capitalInr} /></td>
                        <td className={`${icfTd} tabular-nums`}><FmtLedgerAed amount={row.aedEq} /></td>
                        <td className={`${icfTd} tabular-nums`}>{row.sharePct.toFixed(2)}%</td>
                        <td className={`${icfTd} tabular-nums`}><FmtLedgerAed amount={row.profitDueAed} /></td>
                        <td className={`${icfTd} tabular-nums`}><FmtLedgerInr amount={row.profitDueInr} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : tab === 'movements' ? (
              <div className={icfTableWrap}>
                <table className={icfTable}>
                  <thead>
                    <tr className={icfTheadRow}>
                      <th className={icfTh}>Date</th>
                      <th className={icfTh}>Type</th>
                      <th className={icfTh}>Book</th>
                      <th className={icfTh}>Investor</th>
                      <th className={icfTh}>Amount</th>
                      <th className={icfTh}>INR/AED</th>
                      <th className={icfTh}>AED eq</th>
                      <th className={icfTh}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={8} className={`${icfTd} py-8 text-center text-slate-500`}>
                          No capital movements yet.
                        </td>
                      </tr>
                    ) : (
                      movements.map(m => (
                        <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className={`${icfTd} tabular-nums`}>{m.lotDate}</td>
                          <td className={`${icfTd} capitalize`}>{m.movementType}</td>
                          <td className={icfTd}>{m.book}</td>
                          <td className={icfTd}>{m.investorName}</td>
                          <td className={`${icfTd} tabular-nums`}>
                            {m.book === 'INR' ? <FmtLedgerInr amount={m.amountNative} /> : <FmtLedgerAed amount={m.amountNative} />}
                          </td>
                          <td className={`${icfTd} tabular-nums`}>{m.book === 'INR' ? m.inrPerAed.toLocaleString() : '—'}</td>
                          <td className={`${icfTd} tabular-nums`}><FmtLedgerAed amount={m.aedEq} /></td>
                          <td className={`${icfTd} max-w-[12rem] truncate text-slate-500`}>{m.notes || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={icfTableWrap}>
                <table className={icfTable}>
                  <thead>
                    <tr className={icfTheadRow}>
                      <th className={icfTh}>Date</th>
                      <th className={icfTh}>Voucher</th>
                      <th className={icfTh}>Book</th>
                      <th className={icfTh}>Investor</th>
                      <th className={icfTh}>Kind</th>
                      <th className={icfTh}>Event</th>
                      <th className={icfTh}>Allocated</th>
                      <th className={icfTh}>Share bps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.length === 0 ? (
                      <tr>
                        <td colSpan={8} className={`${icfTd} py-8 text-center text-slate-500`}>
                          No profit allocations yet.
                        </td>
                      </tr>
                    ) : (
                      allocations.map(a => (
                        <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className={`${icfTd} tabular-nums`}>{a.voucherDate}</td>
                          <td className={`${icfTd} font-mono text-xs`}>{a.sourceVoucherId}</td>
                          <td className={icfTd}>{a.book}</td>
                          <td className={icfTd}>{a.investorName}</td>
                          <td className={`${icfTd} capitalize`}>{a.kind}</td>
                          <td className={`${icfTd} tabular-nums`}>
                            {a.book === 'INR' ? <FmtLedgerInr amount={a.eventAmount} /> : <FmtLedgerAed amount={a.eventAmount} />}
                          </td>
                          <td className={`${icfTd} tabular-nums`}>
                            {a.book === 'INR' ? <FmtLedgerInr amount={a.allocatedAmount} /> : <FmtLedgerAed amount={a.allocatedAmount} />}
                          </td>
                          <td className={`${icfTd} tabular-nums`}>{a.shareBps}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}

      {modal && data ? (
        <CapitalModal
          kind={modal}
          data={data}
          banksAed={banksAed}
          banksInr={banksInr}
          defaultDate={defaultDate}
          saving={saving}
          onClose={() => setModal(null)}
          onSubmit={async payload => {
            setSaving(true);
            try {
              if (modal === 'investor') {
                const res = await createCapitalInvestorAction(payload);
                if (!res.success) throw new Error(res.error);
                showToast('Investor created', 'success');
              } else if (modal === 'opening') {
                const res = await setCapitalOpeningAction(payload);
                if (!res.success) throw new Error(res.error);
                showToast(data.openingLocked ? 'Opening already locked' : 'Opening capital saved', 'success');
              } else if (modal === 'management') {
                const res = await setManagementShareAction(payload);
                if (!res.success) throw new Error(res.error);
                showToast('Management share updated', 'success');
              } else {
                const res = await postCapitalMovementAction({
                  ...payload,
                  movementType: modal,
                });
                if (!res.success) throw new Error(res.error);
                showToast(`${modal} posted`, 'success');
              }
              setModal(null);
              await load();
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Save failed', 'error');
            } finally {
              setSaving(false);
            }
          }}
          {...buttonProps}
        />
      ) : null}
    </div>
  );
}

function CapitalModal({
  kind,
  data,
  banksAed,
  banksInr,
  defaultDate,
  saving,
  onClose,
  onSubmit,
  disabled,
}: {
  kind: 'investor' | 'opening' | 'management' | 'deposit' | 'withdraw' | 'payout';
  data: NonNullable<Awaited<ReturnType<typeof getCapitalDashboardAction>> extends { success: true; data: infer D } ? D : never>;
  banksAed: Array<{ id: string; name: string }>;
  banksInr: Array<{ id: string; name: string }>;
  defaultDate: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  disabled?: boolean;
}) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [openingAed, setOpeningAed] = useState(String(data.settings.openingAed || ''));
  const [openingInr, setOpeningInr] = useState(String(data.settings.openingInr || ''));
  const [inrPerAed, setInrPerAed] = useState(String(data.settings.openingInrPerAed || ''));
  const [mgmtPct, setMgmtPct] = useState(String(data.managementSharePct || '0'));
  const [mgmtInvestor, setMgmtInvestor] = useState(data.settings.managementInvestorId ?? '');
  const [book, setBook] = useState<'AED' | 'INR'>('AED');
  const [investorId, setInvestorId] = useState(data.investors.find(i => !i.isHouse)?.id ?? data.investors[0]?.id ?? '');
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [lotDate, setLotDate] = useState(defaultDate);
  const [voucherDate, setVoucherDate] = useState(defaultDate);

  const banks = book === 'INR' ? banksInr : banksAed;
  useEffect(() => {
    if (!bankId && banks[0]) setBankId(banks[0].id);
  }, [banks, bankId]);

  const title =
    kind === 'investor'
      ? 'New investor'
      : kind === 'opening'
        ? 'Opening capital'
        : kind === 'management'
          ? 'Management share'
          : kind.charAt(0).toUpperCase() + kind.slice(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <div className="mt-3 space-y-2">
          {kind === 'investor' ? (
            <>
              <label className={icfLabel}>Name</label>
              <input className={icfInput} value={name} onChange={e => setName(e.target.value)} />
            </>
          ) : null}

          {kind === 'opening' ? (
            <>
              {data.openingLocked ? (
                <p className="text-sm text-amber-700">Opening capital is locked. Adjust via journal if needed.</p>
              ) : (
                <>
                  <label className={icfLabel}>Opening AED</label>
                  <input className={icfInput} value={openingAed} onChange={e => setOpeningAed(e.target.value)} />
                  <label className={icfLabel}>Opening INR</label>
                  <input className={icfInput} value={openingInr} onChange={e => setOpeningInr(e.target.value)} />
                  <label className={icfLabel}>INR per 1 AED</label>
                  <input className={icfInput} value={inrPerAed} onChange={e => setInrPerAed(e.target.value)} />
                  <label className={icfLabel}>Date</label>
                  <input type="date" className={icfInput} value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
                </>
              )}
            </>
          ) : null}

          {kind === 'management' ? (
            <>
              <label className={icfLabel}>Management % of profit</label>
              <input className={icfInput} value={mgmtPct} onChange={e => setMgmtPct(e.target.value)} />
              <label className={icfLabel}>Receiver investor (optional)</label>
              <select className={icfInput} value={mgmtInvestor} onChange={e => setMgmtInvestor(e.target.value)}>
                <option value="">HQ (default)</option>
                {data.investors.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {kind === 'deposit' || kind === 'withdraw' || kind === 'payout' ? (
            <>
              <label className={icfLabel}>Book</label>
              <select className={icfInput} value={book} onChange={e => setBook(e.target.value as 'AED' | 'INR')}>
                <option value="AED">AED</option>
                <option value="INR">INR</option>
              </select>
              <label className={icfLabel}>Investor</label>
              <select className={icfInput} value={investorId} onChange={e => setInvestorId(e.target.value)}>
                {data.investors.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <label className={icfLabel}>Bank account</label>
              <select className={icfInput} value={bankId} onChange={e => setBankId(e.target.value)}>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <label className={icfLabel}>Amount</label>
              <input className={icfInput} value={amount} onChange={e => setAmount(e.target.value)} />
              {book === 'INR' ? (
                <>
                  <label className={icfLabel}>INR per 1 AED</label>
                  <input className={icfInput} value={inrPerAed} onChange={e => setInrPerAed(e.target.value)} />
                </>
              ) : null}
              <label className={icfLabel}>Date</label>
              <input type="date" className={icfInput} value={lotDate} onChange={e => setLotDate(e.target.value)} />
            </>
          ) : null}

          <label className={icfLabel}>Notes</label>
          <input className={icfInput} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={icfInput} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={icfBtnPrimary}
            disabled={disabled || saving || (kind === 'opening' && data.openingLocked)}
            onClick={() => {
              void onSubmit(
                kind === 'investor'
                  ? { name, notes }
                  : kind === 'opening'
                    ? {
                        openingAed: Number(openingAed) || 0,
                        openingInr: Number(openingInr) || 0,
                        openingInrPerAed: Number(inrPerAed) || 0,
                        voucherDate,
                      }
                    : kind === 'management'
                      ? {
                          managementSharePct: Number(mgmtPct) || 0,
                          managementInvestorId: mgmtInvestor || null,
                        }
                      : {
                          investorId,
                          book,
                          amount: Number(amount),
                          inrPerAed: book === 'INR' ? Number(inrPerAed) : undefined,
                          bankAccountId: bankId,
                          lotDate,
                          notes,
                        },
              );
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
