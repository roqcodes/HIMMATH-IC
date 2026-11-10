'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Banknote,
  HandCoins,
  Landmark,
  Percent,
  UserPlus,
} from 'lucide-react';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import CapitalKpiSummary from '@/components/capital/CapitalKpiSummary';
import AsicTabBar from '@/components/asic/AsicTabBar';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import CapitalModal, { type CapitalDashData, type CapitalModalKind } from '@/components/capital/CapitalModal';
import {
  createCapitalInvestorAction,
  getCapitalPageDataAction,
  listCapitalBankAccountsBothAction,
  postCapitalMovementAction,
  setCapitalOpeningAction,
  setManagementShareAction,
} from '@/app/actions/capitalActions';
import { FmtLedgerAed, FmtLedgerInr } from '@/lib/icFunds/format';
import {
  icfBtnOutline,
  icfCard,
  icfTable,
  icfTableWrap,
  icfTd,
  icfTh,
  icfTheadRow,
  icfTr,
} from '@/components/ic-funds/ui';
import { useApp } from '@/context/AppContext';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { ASICKPISkeleton, ASICTableSkeleton } from '@/components/asic/ASICTableSkeleton';
import type { AsicKpiMetric } from '@/components/asic/AsicKpiStrip';

type TabId = 'investors' | 'movements' | 'allocations';

function formatCapitalSharePct(shareBps: number): string {
  if (!shareBps) return '—';
  return `${(shareBps / 100).toFixed(2)}%`;
}

function AllocationDateTimeCell({ iso }: { iso?: string }) {
  if (!iso) return <span className="text-slate-400">—</span>;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return <span className="text-slate-400">{iso.slice(0, 10)}</span>;
  return (
    <div className="leading-tight">
      <div className="text-xs font-medium text-slate-800">
        {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>
      <div className="text-[10px] text-slate-400">
        {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}

const ALLOCATION_KIND_ORDER: Record<string, number> = {
  management: 0,
  profit: 1,
  expense: 2,
  payout: 3,
};

export default function CapitalScreen() {
  const { showToast } = useApp();
  const { canWrite, buttonProps } = useWriteAccess();
  const [loading, setLoading] = useState(true);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [tab, setTab] = useState<TabId>('investors');
  const [data, setData] = useState<CapitalDashData | null>(null);
  type CapitalMovementRow = {
    id: string;
    investorName: string;
    movementType: string;
    book: string;
    lotDate: string;
    amountNative: number;
    inrPerAed: number;
    aedEq: number;
    notes: string;
  };
  type CapitalAllocationRow = {
    id: string;
    voucherDate: string;
    voucherPostedAt: string;
    sourceVoucherId: string;
    book: string;
    investorName: string;
    kind: string;
    eventAmount: number;
    allocatedAmount: number;
    shareBps: number;
  };
  const [movements, setMovements] = useState<CapitalMovementRow[]>([]);
  const [allocations, setAllocations] = useState<CapitalAllocationRow[]>([]);
  const [banksAed, setBanksAed] = useState<Array<{ id: string; name: string }>>([]);
  const [banksInr, setBanksInr] = useState<Array<{ id: string; name: string }>>([]);

  const [modal, setModal] = useState<CapitalModalKind | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadBanks = useCallback(async () => {
    const banks = await listCapitalBankAccountsBothAction();
    if (banks.success) {
      setBanksAed(banks.data.aed.map(b => ({ id: b.id, name: b.name })));
      setBanksInr(banks.data.inr.map(b => ({ id: b.id, name: b.name })));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setTabsLoading(true);
    setLoadError(null);
    try {
      const page = await getCapitalPageDataAction();
      if (!page.success) throw new Error(page.error);
      setData(page.data.dashboard);
      setMovements(page.data.movements);
      setAllocations(page.data.allocations);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load capital';
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setTabsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal || modal === 'investor' || modal === 'management') return;
    if (banksAed.length > 0 && banksInr.length > 0) return;
    void loadBanks();
  }, [modal, banksAed.length, banksInr.length, loadBanks]);

  const kpiGroups = useMemo(() => {
    if (!data) return [];
    const cashInrHint =
      data.cashInr > 0.005
        ? 'Pay metal / INR payouts from till'
        : 'Empty — convert on FX before INR payout';
    const profitInrHint =
      data.cashInr > 0.005
        ? 'Metal margin · pay from INR cash'
        : 'Metal margin · fund via FX, then payout';

    return [
      {
        id: 'cash',
        title: 'Cash in bank',
        lgCols: 2 as const,
        metrics: [
          {
            label: 'Cash (AED)',
            value: <FmtLedgerAed amount={data.cashAed} />,
            hint: 'Payout AED profit from here',
            tone: 'emerald' as const,
          },
          {
            label: 'Cash (INR)',
            value: <FmtLedgerInr amount={data.cashInr} />,
            hint: cashInrHint,
            tone: 'emerald' as const,
          },
        ] satisfies AsicKpiMetric[],
      },
      {
        id: 'books',
        title: 'Investor books',
        lgCols: 4 as const,
        metrics: [
          {
            label: 'Capital (AED eq)',
            value: <FmtLedgerAed amount={data.capitalAedEq} />,
            hint: 'Ownership pie — not profit',
            tone: 'indigo' as const,
          },
          {
            label: 'Profit due (AED)',
            value: <FmtLedgerAed amount={data.profitDueAed} />,
            hint: 'IC allocations · AED cash',
            tone: 'amber' as const,
          },
          {
            label: 'Profit due (INR)',
            value: <FmtLedgerInr amount={data.profitDueInr} />,
            hint: profitInrHint,
            tone: 'amber' as const,
          },
          {
            label: 'Management share',
            value: `${data.managementSharePct.toFixed(2)}%`,
            hint: 'HQ default receiver',
            tone: 'slate' as const,
          },
        ] satisfies AsicKpiMetric[],
      },
    ];
  }, [data]);

  const tabItems = useMemo(
    () => [
      { id: 'investors' as const, label: 'Investors', count: data?.investors.length ?? 0 },
      { id: 'movements' as const, label: 'Movements', count: movements.length },
      { id: 'allocations' as const, label: 'Profit allocations', count: allocations.length },
    ],
    [data?.investors.length, movements.length, allocations.length],
  );

  const allocationGroups = useMemo(() => {
    const map = new Map<string, CapitalAllocationRow[]>();
    for (const row of allocations) {
      const key = `${row.sourceVoucherId}|${row.book}`;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return [...map.entries()]
      .map(([key, lines]) => {
        const sorted = [...lines].sort((a, b) => {
          const ka = ALLOCATION_KIND_ORDER[a.kind] ?? 9;
          const kb = ALLOCATION_KIND_ORDER[b.kind] ?? 9;
          if (ka !== kb) return ka - kb;
          return a.investorName.localeCompare(b.investorName);
        });
        const head = sorted[0];
        const voucherPostedAt = sorted.reduce((latest, row) => {
          const t = Date.parse(row.voucherPostedAt);
          const cur = Date.parse(latest);
          return Number.isFinite(t) && t > cur ? row.voucherPostedAt : latest;
        }, head.voucherPostedAt);
        return {
          key,
          voucherDate: head.voucherDate,
          voucherPostedAt,
          sourceVoucherId: head.sourceVoucherId,
          book: head.book,
          totalProfit: head.eventAmount,
          lines: sorted,
        };
      })
      .sort((a, b) => {
        const tb = Date.parse(b.voucherPostedAt) || 0;
        const ta = Date.parse(a.voucherPostedAt) || 0;
        if (tb !== ta) return tb - ta;
        return b.sourceVoucherId.localeCompare(a.sourceVoucherId);
      });
  }, [allocations]);

  const defaultDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const openModal = (kind: CapitalModalKind) => {
    if (!canWrite) return;
    setModal(kind);
  };

  return (
    <div className="space-y-3">
      <AsicPageHeader
        title="Capital"
        subtitle="Metal profit is always the INR sale margin. Convert AED to INR on FX before paying rupee due."
        meta={
          data?.openingLocked ? (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface-muted)] dark:text-[var(--theme-text-secondary)]">
              Opening locked
            </span>
          ) : null
        }
        toolbar={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={`${asicBtnOutline} gap-1.5`} onClick={() => openModal('investor')} {...buttonProps}>
                <UserPlus className="size-3.5 shrink-0" aria-hidden />
                Investor
              </button>
              <button type="button" className={`${asicBtnOutline} gap-1.5`} onClick={() => openModal('opening')} {...buttonProps}>
                <Landmark className="size-3.5 shrink-0" aria-hidden />
                Opening
              </button>
              <button type="button" className={`${asicBtnOutline} gap-1.5`} onClick={() => openModal('management')} {...buttonProps}>
                <Percent className="size-3.5 shrink-0" aria-hidden />
                Management
              </button>
              <Link href="/admin/fx" className={`${asicBtnOutline} gap-1.5`}>
                <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden />
                FX
              </Link>
            </div>
          ) : null
        }
        actions={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className={`${asicBtnPrimary} gap-1.5`} onClick={() => openModal('deposit')} {...buttonProps}>
                <ArrowDownToLine className="size-3.5 shrink-0" aria-hidden />
                Deposit
              </button>
              <button type="button" className={`${icfBtnOutline} gap-1.5`} onClick={() => openModal('withdraw')} {...buttonProps}>
                <ArrowUpFromLine className="size-3.5 shrink-0" aria-hidden />
                Withdraw
              </button>
              <button type="button" className={`${icfBtnOutline} gap-1.5`} onClick={() => openModal('payout')} {...buttonProps}>
                <HandCoins className="size-3.5 shrink-0" aria-hidden />
                Payout
              </button>
            </div>
          ) : null
        }
      />

      {loading && !data ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading capital">
          <ASICKPISkeleton count={6} />
          <ASICTableSkeleton rows={6} cols={7} />
        </div>
      ) : null}

      {!loading && !data && loadError ? (
        <div className={`${icfCard} space-y-3 p-4`}>
          <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>
          <p className="text-sm text-slate-600 dark:text-[var(--theme-text-secondary)]">
            If this is the first visit, apply the capital migration on the database, then refresh.
          </p>
          <button type="button" className={asicBtnPrimary} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <CapitalKpiSummary groups={kpiGroups} />

          <div className={icfCard}>
            <AsicTabBar
              tabs={tabItems}
              activeTab={tab}
              onTabChange={id => setTab(id as TabId)}
              ariaLabel="Capital registers"
            />

            <div className="p-0">
              {tab === 'investors' ? (
                <div className={icfTableWrap}>
                  <table className={`${icfTable} min-w-[960px]`}>
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
                      {data.investors.length === 0 ? (
                        <tr>
                          <td colSpan={7} className={`${icfTd} py-10 text-center text-slate-500`}>
                            <Banknote className="mx-auto mb-2 size-8 text-slate-300" aria-hidden />
                            No investors yet. Add an investor to begin capital tracking.
                          </td>
                        </tr>
                      ) : (
                        data.investors.map(row => (
                          <tr key={row.id} className={icfTr}>
                            <td className={icfTd}>
                              <span className="font-medium text-slate-900 dark:text-[var(--theme-text)]">{row.name}</span>
                              {row.isHouse ? (
                                <span className="ml-1.5 rounded-md bg-slate-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-[var(--theme-surface-muted)]">
                                  HQ
                                </span>
                              ) : null}
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              <FmtLedgerAed amount={row.capitalAed} />
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              <FmtLedgerInr amount={row.capitalInr} />
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              <FmtLedgerAed amount={row.aedEq} />
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>{row.sharePct.toFixed(2)}%</td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              <FmtLedgerAed amount={row.profitDueAed} />
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              <FmtLedgerInr amount={row.profitDueInr} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : tab === 'movements' ? (
                <div className={icfTableWrap}>
                  <table className={`${icfTable} min-w-[900px]`}>
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
                      {tabsLoading && movements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`${icfTd} py-8 text-center text-slate-500`}>
                            Loading movements…
                          </td>
                        </tr>
                      ) : movements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`${icfTd} py-10 text-center text-slate-500`}>
                            No capital movements yet.
                          </td>
                        </tr>
                      ) : (
                        movements.map(m => (
                          <tr key={m.id} className={icfTr}>
                            <td className={`${icfTd} font-mono tabular-nums`}>{m.lotDate}</td>
                            <td className={`${icfTd} capitalize`}>{m.movementType}</td>
                            <td className={icfTd}>{m.book}</td>
                            <td className={icfTd}>{m.investorName}</td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              {m.book === 'INR' ? (
                                <FmtLedgerInr amount={m.amountNative} />
                              ) : (
                                <FmtLedgerAed amount={m.amountNative} />
                              )}
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              {m.book === 'INR' ? m.inrPerAed.toLocaleString() : '—'}
                            </td>
                            <td className={`${icfTd} font-mono tabular-nums`}>
                              <FmtLedgerAed amount={m.aedEq} />
                            </td>
                            <td className={`${icfTd} max-w-[14rem] truncate text-slate-500`}>{m.notes || '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={icfTableWrap}>
                  <table className={`${icfTable} min-w-[960px]`}>
                    <thead>
                      <tr className={icfTheadRow}>
                        <th className={icfTh}>Date</th>
                        <th className={icfTh}>Voucher</th>
                        <th className={icfTh}>Book</th>
                        <th className={icfTh}>Investor</th>
                        <th className={icfTh}>Kind</th>
                        <th className={icfTh}>Total profit</th>
                        <th className={icfTh}>Allocated</th>
                        <th className={icfTh}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabsLoading && allocations.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`${icfTd} py-8 text-center text-slate-500`}>
                            Loading allocations…
                          </td>
                        </tr>
                      ) : allocations.length === 0 ? (
                        <tr>
                          <td colSpan={8} className={`${icfTd} py-10 text-center text-slate-500`}>
                            No profit allocations yet.
                          </td>
                        </tr>
                      ) : (
                        allocationGroups.map(group => (
                          <React.Fragment key={group.key}>
                            <tr className="border-t border-slate-200 bg-slate-50/90">
                              <td className={`${icfTd} py-2`}>
                                <AllocationDateTimeCell
                                  iso={group.voucherPostedAt || `${group.voucherDate}T00:00:00Z`}
                                />
                              </td>
                              <td className={`${icfTd} py-2 font-mono text-xs font-semibold text-slate-700`}>
                                {group.sourceVoucherId}
                              </td>
                              <td className={`${icfTd} py-2`}>{group.book}</td>
                              <td className={`${icfTd} py-2 text-xs text-slate-500`} colSpan={2}>
                                <span className="text-slate-400">
                                  {group.lines.length} {group.lines.length === 1 ? 'slice' : 'slices'}
                                </span>
                              </td>
                              <td className={`${icfTd} py-2 font-mono tabular-nums font-semibold text-slate-900`}>
                                {group.book === 'INR' ? (
                                  <FmtLedgerInr amount={group.totalProfit} />
                                ) : (
                                  <FmtLedgerAed amount={group.totalProfit} />
                                )}
                              </td>
                              <td className={icfTd} colSpan={2} />
                            </tr>
                            {group.lines.map(a => (
                              <tr key={a.id} className={icfTr}>
                                <td className={icfTd} />
                                <td className={icfTd} />
                                <td className={icfTd} />
                                <td className={`${icfTd} pl-4`}>{a.investorName}</td>
                                <td className={`${icfTd} capitalize`}>{a.kind}</td>
                                <td className={icfTd} />
                                <td className={`${icfTd} font-mono tabular-nums`}>
                                  {a.book === 'INR' ? (
                                    <FmtLedgerInr amount={a.allocatedAmount} />
                                  ) : (
                                    <FmtLedgerAed amount={a.allocatedAmount} />
                                  )}
                                </td>
                                <td className={`${icfTd} font-mono tabular-nums text-slate-700`}>
                                  {formatCapitalSharePct(a.shareBps)}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}

      {data && modal ? (
        <CapitalModal
          open={Boolean(modal)}
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
