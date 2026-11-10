'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import AccountPicker from '@/components/ic-funds/AccountPicker';
import {
  deleteICFundVoucherAction,
  getICFundVoucherPageAction,
  listICFundAccountsLiteAction,
  postICFundVoucherAction,
} from '@/app/actions/icFundsActions';
import { IC_FUND_VOUCHER_LABELS, type ICFundVoucherType } from '@/lib/icFunds/constants';
import { VOUCHER_LIST_PAGE_SIZE } from '@/lib/icFunds/voucherQueries';
import { ActionError, logClientActionError } from '@/lib/errors/actionError';
import { trackLoading } from '@/lib/loadingBar';
import { allowedAccountTypesForVoucher, voucherFieldLabels } from '@/lib/icFunds/voucherRules';
import { fmtICDate, icfLedgerColumnLabel, FmtLedgerAmount } from '@/lib/icFunds/format';
import { parseFormAmount } from '@/lib/parseFormAmount';
import { validateVoucherCurrencyPolicy } from '@/lib/icFunds/currencyPolicy';
import { icfBtnGhost, icfBtnPrimary, icfCard, icfInput, icfLabel, icfTable, icfTableWrap, icfTd, icfTh, icfThAlign, icfTheadRow } from '@/components/ic-funds/ui';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { computeVoucherKpis } from '@/lib/icFunds/kpiMetrics';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import ICFundsDateFilterBar from '@/components/ic-funds/ICFundsDateFilterBar';
import { useICFundsDateFilter } from '@/components/ic-funds/useICFundsDateFilter';
import VoucherUserCell from '@/components/ic-funds/VoucherUserCell';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { useApp } from '@/context/AppContext';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import type { ICFundAccount, ICFundVoucher } from '@/types';
import {
  counterpartyIdsFromVoucherAccounts,
  notifyIcFundsVoucherPosted,
} from '@/lib/icFunds/voucherPostedNotify';

type LedgerBook = 'AED' | 'INR';

const BOOK_STORAGE_KEY = 'asic_ic_funds_voucher_book';

function bookToggleClass(active: boolean) {
  return `inline-flex h-8 min-w-[3.25rem] items-center justify-center rounded-md px-3 text-xs font-semibold transition-colors ${
    active
      ? 'bg-red-600 text-white shadow-sm shadow-red-600/25'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700 hover:ring-red-200'
  }`;
}

export default function VoucherScreen({
  branchId,
  voucherType,
  branchSlug,
}: {
  branchId: string;
  voucherType: ICFundVoucherType;
  branchSlug?: string;
}) {
  const { showToast, currentSlug, branches } = useApp();
  const { canWrite, buttonProps } = useWriteAccess();
  const { confirm, confirmDialog, alert } = useConfirmDialog();
  const labels = voucherFieldLabels(voucherType);

  const [accounts, setAccounts] = useState<ICFundAccount[]>([]);
  const [vouchers, setVouchers] = useState<ICFundVoucher[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [kpi, setKpi] = useState({
    entries: 0,
    voided: 0,
    total: 0,
    posted: 0,
    pending: 0,
    pendingTotal: 0,
    largest: 0,
  });

  const slug = branchSlug ?? (currentSlug !== 'superadmin' ? currentSlug : '');
  const branch = branches.find(b => b.slug === slug);

  const [voucherDate, setVoucherDate] = useState('');
  const [debitId, setDebitId] = useState('');
  const [creditId, setCreditId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const cashBookEnabled = voucherType === 'payment' || voucherType === 'receipt';
  const [book, setBook] = useState<LedgerBook>('AED');
  const saveIdempotencyKey = useRef<string | null>(null);
  const deepLinkPartyApplied = useRef(false);
  const searchParams = useSearchParams();

  const pageSize = VOUCHER_LIST_PAGE_SIZE;

  const {
    dateFilter,
    setDateFilter,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    startDate,
    endDate,
    defaultVoucherDate,
  } = useICFundsDateFilter(branch?.timezone);

  useEffect(() => {
    if (!voucherDate) setVoucherDate(defaultVoucherDate);
  }, [defaultVoucherDate, voucherDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!cashBookEnabled) {
      setBook('AED');
      return;
    }
    const fromUrl = searchParams.get('book');
    if (fromUrl === 'INR' || fromUrl === 'AED') {
      setBook(fromUrl);
      return;
    }
    try {
      const stored = sessionStorage.getItem(BOOK_STORAGE_KEY);
      if (stored === 'INR' || stored === 'AED') setBook(stored);
    } catch {
      /* ignore */
    }
  }, [cashBookEnabled, searchParams]);

  useEffect(() => {
    deepLinkPartyApplied.current = false;
  }, [searchParams]);

  useEffect(() => {
    if (!cashBookEnabled || deepLinkPartyApplied.current) return;
    const partyId = searchParams.get('partyAccountId')?.trim();
    if (!partyId || accounts.length === 0) return;
    if (!accounts.some(a => a.id === partyId)) return;
    if (voucherType === 'payment') setDebitId(partyId);
    else if (voucherType === 'receipt') setCreditId(partyId);
    deepLinkPartyApplied.current = true;
  }, [accounts, cashBookEnabled, searchParams, voucherType]);

  useEffect(() => {
    setOffset(0);
  }, [branchId, voucherType, startDate, endDate, debouncedSearch, book]);

  useEffect(() => {
    setDebitId('');
    setCreditId('');
  }, [book, voucherType, branchId]);

  const loadAccounts = useCallback(async () => {
    const lite = await listICFundAccountsLiteAction(branchId, cashBookEnabled ? book : 'AED');
    setAccounts(lite);
  }, [branchId, book, cashBookEnabled]);

  useEffect(() => {
    let cancelled = false;
    void trackLoading(async () => {
      const lite = await listICFundAccountsLiteAction(branchId, cashBookEnabled ? book : 'AED');
      if (!cancelled) setAccounts(lite);
    });
    return () => {
      cancelled = true;
    };
  }, [branchId, book, cashBookEnabled]);

  const loadVouchers = useCallback(async () => {
    setTableLoading(true);
    try {
      const result = await trackLoading(() =>
        getICFundVoucherPageAction({
          branchId,
          voucherType,
          startDate,
          endDate,
          search: debouncedSearch || undefined,
          limit: pageSize,
          offset,
          includeStats: offset === 0,
          book: cashBookEnabled ? book : 'AED',
        }),
      );
      if (!result.success) {
        throw new ActionError(result.error, { scope: 'VoucherScreen.loadVouchers' });
      }
      setVouchers(result.data.vouchers);
      setTotal(result.data.total);
      if (result.data.stats) setKpi(result.data.stats);
    } catch (err) {
      logClientActionError('VoucherScreen.loadVouchers', err);
      const message =
        err instanceof ActionError
          ? err.message
          : 'Could not load entries. Check your connection and try again.';
      await alert({
        title: 'Failed to load entries',
        message,
        variant: 'danger',
      });
    } finally {
      setTableLoading(false);
    }
  }, [alert, branchId, voucherType, startDate, endDate, debouncedSearch, offset, pageSize, book, cashBookEnabled]);

  useEffect(() => {
    void loadVouchers();
  }, [loadVouchers]);

  const resetForm = () => {
    setDebitId('');
    setCreditId('');
    setAmount('');
    setNotes('');
    setVoucherDate(defaultVoucherDate);
  };

  const resetFormAfterSave = () => {
    const partyAccountId = voucherType === 'payment' ? debitId : creditId;
    setAmount('');
    setNotes('');
    setVoucherDate(defaultVoucherDate);
    if (voucherType === 'payment') {
      setDebitId(partyAccountId);
      setCreditId('');
    } else if (voucherType === 'receipt') {
      setDebitId('');
      setCreditId(partyAccountId);
    } else {
      resetForm();
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!canWrite) return;
    if (!debitId || !creditId) {
      showToast('Select both accounts', 'error');
      return;
    }
    const parsedAmount = parseFormAmount(amount);
    if (parsedAmount === null) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    if (parsedAmount <= 0) {
      showToast('Amount must be greater than zero', 'error');
      return;
    }
    setSaving(true);
    if (!saveIdempotencyKey.current) {
      saveIdempotencyKey.current = crypto.randomUUID();
    }
    try {
      const result = await trackLoading(() =>
        postICFundVoucherAction({
          branchId,
          voucherType,
          voucherDate,
          debitAccountId: debitId,
          creditAccountId: creditId,
          amount: parsedAmount,
          notes,
          book: cashBookEnabled ? book : 'AED',
          idempotencyKey: saveIdempotencyKey.current ?? undefined,
        }),
      );
      if (!result.success) {
        showToast(result.error, 'error');
        return;
      }
      showToast(`${IC_FUND_VOUCHER_LABELS[voucherType].slice(0, -1)} saved`, 'success');
      saveIdempotencyKey.current = null;
      const counterpartyIds = counterpartyIdsFromVoucherAccounts(accounts, debitId, creditId);
      await Promise.all([loadVouchers(), loadAccounts()]);
      notifyIcFundsVoucherPosted(
        counterpartyIds.length > 0 ? { counterpartyIds } : undefined,
      );
      resetFormAfterSave();
    } finally {
      setSaving(false);
    }
  };

  const handleVoid = async (voucher: ICFundVoucher) => {
    const ok = await confirm({
      title: `Void voucher #${voucher.voucherNo}?`,
      message: 'The entry stays in the audit log but is excluded from balances and reports.',
    });
    if (!ok) return;
    const voucherBook = voucher.id.startsWith('INFV-') ? 'INR' : 'AED';
    const result = await trackLoading(() => deleteICFundVoucherAction(branchId, voucher.id, voucherBook));
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    showToast('Voucher voided', 'success');
    const counterpartyIds = counterpartyIdsFromVoucherAccounts(
      accounts,
      voucher.debitAccountId,
      voucher.creditAccountId,
    );
    await Promise.all([loadVouchers(), loadAccounts()]);
    notifyIcFundsVoucherPosted(
      counterpartyIds.length > 0 ? { counterpartyIds } : undefined,
    );
  };

  const visible = vouchers;
  const bankCol = voucherType === 'receipt' ? 'debit' : 'credit';
  const partyCol = voucherType === 'receipt' ? 'credit' : 'debit';

  const debitAccount = accounts.find(a => a.id === debitId);
  const creditAccount = accounts.find(a => a.id === creditId);

  const currencyBlockReason =
    debitAccount && creditAccount
      ? validateVoucherCurrencyPolicy(
          { account_type: debitAccount.accountType, currency: book },
          { account_type: creditAccount.accountType, currency: book },
        )
      : null;

  let amountBlockReason: string | null = null;
  if (!amount.trim()) {
    amountBlockReason = 'Enter amount';
  } else {
    const parsed = parseFormAmount(amount);
    if (parsed === null) amountBlockReason = 'Enter a valid amount';
    else if (parsed <= 0) amountBlockReason = 'Amount must be greater than zero';
  }

  const canSaveEntry =
    Boolean(debitId && creditId && voucherDate && !currencyBlockReason && !amountBlockReason);

  const kpiMetrics = useMemo(
    () => computeVoucherKpis(kpi, voucherType, cashBookEnabled ? book : 'AED'),
    [kpi, voucherType, book, cashBookEnabled],
  );

  const selectBook = (next: LedgerBook) => {
    setBook(next);
    try {
      sessionStorage.setItem(BOOK_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  };

  const accountCell = (accountId: string, name: string) =>
    cashBookEnabled && book === 'INR' ? (
      <span>{name}</span>
    ) : (
      <ICFundAccountLink slug={slug} accountId={accountId} name={name} accounts={accounts} />
    );
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + VOUCHER_LIST_PAGE_SIZE, total);

  return (
    <div className="space-y-2">
      {confirmDialog}

      <AsicKpiStrip metrics={kpiMetrics} />

      <div className={icfCard}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <p className="text-sm font-medium text-slate-900">New entry</p>
          {cashBookEnabled ? (
            <div className="flex items-center gap-1" role="group" aria-label="Settlement currency">
              <button type="button" className={bookToggleClass(book === 'AED')} onClick={() => selectBook('AED')}>
                AED
              </button>
              <button type="button" className={bookToggleClass(book === 'INR')} onClick={() => selectBook('INR')}>
                INR
              </button>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-2 overflow-visible p-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <div className="sm:col-span-1 lg:col-span-2">
            <label className={icfLabel} htmlFor={`${voucherType}-date`}>Date</label>
            <input id={`${voucherType}-date`} type="date" className={icfInput} value={voucherDate} onChange={e => setVoucherDate(e.target.value)} />
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-3">
            <AccountPicker
              label={labels.credit}
              accounts={accounts}
              allowedTypes={allowedAccountTypesForVoucher(voucherType, 'credit')}
              value={creditId}
              excludeId={debitId}
              onChange={setCreditId}
              book={cashBookEnabled ? book : 'AED'}
              partyOnly={voucherType === 'receipt'}
            />
          </div>
          <div className="min-w-0 sm:col-span-2 lg:col-span-3">
            <AccountPicker
              label={labels.debit}
              accounts={accounts}
              allowedTypes={allowedAccountTypesForVoucher(voucherType, 'debit')}
              value={debitId}
              excludeId={creditId}
              onChange={setDebitId}
              book={cashBookEnabled ? book : 'AED'}
              partyOnly={voucherType === 'payment'}
            />
          </div>
          <div className="sm:col-span-1 lg:col-span-1">
            <label className={icfLabel} htmlFor={`${voucherType}-amount`}>
              Amount ({cashBookEnabled ? book : 'AED'})
            </label>
            <input
              id={`${voucherType}-amount`}
              className={`${icfInput} font-mono tabular-nums`}
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="min-w-0 sm:col-span-1 lg:col-span-2">
            <label className={icfLabel} htmlFor={`${voucherType}-notes`}>Notes</label>
            <input id={`${voucherType}-notes`} className={icfInput} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Narration" />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            {currencyBlockReason ? (
              <p className="mb-1 text-[11px] font-medium text-red-600">{currencyBlockReason}</p>
            ) : amountBlockReason ? (
              <p className="mb-1 text-[11px] font-medium text-red-600">{amountBlockReason}</p>
            ) : null}
            <button
              type="button"
              className={`${icfBtnPrimary} w-full`}
              {...buttonProps({ disabled: saving || !canSaveEntry })}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className={icfCard}>
        <div className="border-b border-slate-200 px-3 pt-2">
          <ICFundsDateFilterBar
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            customStartDate={customStartDate}
            setCustomStartDate={setCustomStartDate}
            customEndDate={customEndDate}
            setCustomEndDate={setCustomEndDate}
          />
          <div className="flex flex-wrap items-end gap-2 pb-2">
            <div className="min-w-[10rem] flex-1">
              <label className={icfLabel} htmlFor={`${voucherType}-search`}>Find</label>
              <input
                id={`${voucherType}-search`}
                className={icfInput}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Account, notes, #"
              />
            </div>
            {cashBookEnabled ? (
              <div className="flex items-center gap-1 pb-0.5" role="group" aria-label="List settlement currency">
                <button type="button" className={bookToggleClass(book === 'AED')} onClick={() => selectBook('AED')}>
                  AED
                </button>
                <button type="button" className={bookToggleClass(book === 'INR')} onClick={() => selectBook('INR')}>
                  INR
                </button>
              </div>
            ) : null}
            <span className="pb-1 text-[11px] text-slate-500">
              {total > 0 ? `${pageStart}–${pageEnd} of ${total}` : `${visible.length} entries`}
            </span>
          </div>
        </div>

        <div className={icfTableWrap}>
        <table className={`${icfTable} min-w-[720px]`}>
          <thead>
            <tr className={icfTheadRow}>
              <th className={icfTh}>#</th>
              <th className={icfTh}>Date</th>
              {voucherType === 'journal' ? (
                <>
                  <th className={icfTh}>Debit</th>
                  <th className={icfTh}>Credit</th>
                </>
              ) : (
                <>
                  <th className={icfTh}>{voucherType === 'contra' ? 'To bank' : 'Cash / bank'}</th>
                  <th className={icfTh}>{voucherType === 'contra' ? 'From bank' : 'Account'}</th>
                </>
              )}
              <th className={icfThAlign('right')}>
                {cashBookEnabled && book === 'INR' ? 'Amount (INR)' : icfLedgerColumnLabel.amount}
              </th>
              <th className={icfTh}>User</th>
              <th className={icfTh}>Notes</th>
              <th className={icfTh} />
            </tr>
          </thead>
          <tbody>
            {tableLoading ? (
              <ASICTableRowsSkeleton rows={8} cols={8} />
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${icfTd} py-6 text-center text-slate-500`}>
                  {debouncedSearch
                    ? 'No rows match the search.'
                    : 'No entries in this range. Add accounts first if pickers are empty.'}
                </td>
              </tr>
            ) : (
              visible.map(row => {
                const cashOrBank = bankCol === 'debit' ? row.debitAccountName : row.creditAccountName;
                const party = partyCol === 'debit' ? row.debitAccountName : row.creditAccountName;
                const isVoid = row.status === 'void';
                const isPending = row.status === 'pending';
                return (
                  <tr key={row.id} className={`border-b border-slate-100 ${isVoid ? 'bg-slate-50/80 text-slate-400' : isPending ? 'bg-amber-50/40 text-slate-600' : 'hover:bg-slate-50'}`}>
                    <td className={`${icfTd} font-mono tabular-nums text-slate-500`}>
                      {row.voucherNo}
                      {isVoid ? <span className="ml-1 text-[10px] font-semibold uppercase text-red-500">VOID</span> : null}
                      {isPending ? <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600">PENDING</span> : null}
                    </td>
                    <td className={`${icfTd} tabular-nums`}>{fmtICDate(row.voucherDate)}</td>
                    {voucherType === 'journal' ? (
                      <>
                        <td className={icfTd}>{accountCell(row.debitAccountId, row.debitAccountName)}</td>
                        <td className={icfTd}>{accountCell(row.creditAccountId, row.creditAccountName)}</td>
                      </>
                    ) : (
                      <>
                        <td className={icfTd}>
                          {voucherType === 'contra'
                            ? accountCell(row.debitAccountId, row.debitAccountName)
                            : bankCol === 'debit'
                              ? accountCell(row.debitAccountId, cashOrBank)
                              : accountCell(row.creditAccountId, cashOrBank)}
                        </td>
                        <td className={icfTd}>
                          {voucherType === 'contra'
                            ? accountCell(row.creditAccountId, row.creditAccountName)
                            : partyCol === 'debit'
                              ? accountCell(row.debitAccountId, party)
                              : accountCell(row.creditAccountId, party)}
                        </td>
                      </>
                    )}
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      <FmtLedgerAmount amount={row.amount} book={cashBookEnabled ? book : 'AED'} />
                    </td>
                    <td className={icfTd}><VoucherUserCell voucher={row} /></td>
                    <td className={`${icfTd} max-w-[14rem] truncate text-slate-500`}>{row.notes || '—'}</td>
                    <td className={`${icfTd} text-right`}>
                      {canWrite && !isVoid && !isPending ? (
                        <button type="button" className={icfBtnGhost} onClick={() => void handleVoid(row)}>
                          Void
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
        {total > pageSize ? (
          <div className="flex items-center gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
            <button
              type="button"
              className={`${icfInput} !h-7 w-auto`}
              disabled={tableLoading || offset === 0}
              onClick={() => setOffset(o => Math.max(0, o - pageSize))}
            >
              Prev
            </button>
            <span>
              Page {Math.floor(offset / pageSize) + 1} of {Math.max(1, Math.ceil(total / pageSize))}
            </span>
            <button
              type="button"
              className={`${icfInput} !h-7 w-auto`}
              disabled={tableLoading || offset + pageSize >= total}
              onClick={() => setOffset(o => o + pageSize)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
