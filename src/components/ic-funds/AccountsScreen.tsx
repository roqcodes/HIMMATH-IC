'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  listHQICFundAccountsAction,
  listICFundAccountsAction,
  updateICFundAccountAction,
} from '@/app/actions/icFundsActions';
import { trackLoading } from '@/lib/loadingBar';
import ICFundAccountModal from '@/components/ic-funds/ICFundAccountModal';
import {
  icfBtnGhost,
  icfCard,
  icfInput,
  icfLabel,
  icfTable,
  icfTableWrap,
  icfTd,
  icfTh,
  icfTheadRow,
} from '@/components/ic-funds/ui';
import { asicBtnPrimary, asicFormGrid } from '@/components/asic/ui';
import AsicPageHeader from '@/components/asic/AsicPageHeader';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { computeAccountsKpis } from '@/lib/icFunds/kpiMetrics';
import { accountTypeLabel, IC_FUND_ACCOUNT_TYPE_OPTIONS } from '@/lib/icFunds/constants';
import { ASICTableRowsSkeleton } from '@/components/asic/ASICTableSkeleton';
import {
  MobileCardActions,
  MobileCardField,
  MobileCardList,
  MobileCardSkeleton,
  MobileEmptyState,
  mobileCardInteractiveClass,
} from '@/components/ui/MobileDataCard';
import { resolveAccountDetailHref } from '@/lib/icFunds/accountNavigation';
import ICFundAccountLink from '@/components/ic-funds/ICFundAccountLink';
import { BalanceWithPending } from '@/components/ic-funds/BalanceWithPending';
import { fmtLedgerAed } from '@/lib/icFunds/format';
import { HQ_IC_FUNDS_BRANCH_ID } from '@/lib/icFunds/hqBranch';
import { useWriteAccess } from '@/context/RbacWriteContext';
import { useApp } from '@/context/AppContext';
import type { ICFundAccount } from '@/types';

type SortField = 'name' | 'accountType' | 'phone' | 'email' | 'openingBalance' | 'balance' | 'status';
type SortDirection = 'asc' | 'desc';

export default function AccountsScreen({
  branchId,
  navSlug,
  hqMode = false,
}: {
  branchId: string;
  navSlug?: string;
  hqMode?: boolean;
}) {
  const { showToast, currentSlug } = useApp();
  const { canWrite, buttonProps } = useWriteAccess();
  const router = useRouter();

  const [accounts, setAccounts] = useState<ICFundAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ICFundAccount | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const ledgerBranchId = hqMode ? HQ_IC_FUNDS_BRANCH_ID : branchId;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(
        await trackLoading(() =>
          hqMode ? listHQICFundAccountsAction() : listICFundAccountsAction(branchId),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [branchId, hqMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEdit = (account: ICFundAccount) => {
    if (!canWrite) return;
    setEditingAccount(account);
    setIsModalOpen(true);
  };

  const toggleStatus = async (account: ICFundAccount) => {
    if (!canWrite) return;
    const result = await trackLoading(() =>
      updateICFundAccountAction({
        branchId: account.branchId || branchId,
        id: account.id,
        status: account.status === 'active' ? 'inactive' : 'active',
      }),
    );
    if (!result.success) {
      showToast(result.error, 'error');
      return;
    }
    showToast(account.status === 'active' ? 'Account deactivated' : 'Account activated', 'success');
    await load();
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
  };

  const handleSave = () => {
    const wasEdit = Boolean(editingAccount);
    void load();
    handleModalClose();
    showToast(wasEdit ? 'Account updated' : 'Account created', 'success');
  };

  const openAccountDetail = (account: ICFundAccount) => {
    const slug = accountLinkSlug(account);
    if (!slug) return;
    router.push(resolveAccountDetailHref(slug, account));
  };

  const accountLinkSlug = (account: ICFundAccount) =>
    account.branchSlug || navSlug || (currentSlug !== 'superadmin' ? currentSlug : '');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortMark = (field: SortField) => (sortField === field ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : '');

  const entityAccountTypeOptions = useMemo(
    () => IC_FUND_ACCOUNT_TYPE_OPTIONS.filter(opt => opt.value !== 'personal'),
    [],
  );

  const ledgerAccounts = useMemo(
    () => accounts.filter(a => a.accountType !== 'personal'),
    [accounts],
  );

  const filteredAndSorted = useMemo(() => {
    let result = [...ledgerAccounts];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        a =>
          a.name.toLowerCase().includes(q) ||
          (a.phone && a.phone.includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q)) ||
          (a.notes && a.notes.toLowerCase().includes(q)) ||
          (a.branchName && a.branchName.toLowerCase().includes(q)),
      );
    }

    if (filterStatus) {
      result = result.filter(a => a.status === filterStatus);
    }

    if (filterType) {
      result = result.filter(a => a.accountType === filterType);
    }

    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (sortField === 'balance' || sortField === 'openingBalance') {
        valA = Number(a[sortField] ?? 0);
        valB = Number(b[sortField] ?? 0);
      } else if (sortField === 'accountType') {
        valA = accountTypeLabel(a.accountType).toLowerCase();
        valB = accountTypeLabel(b.accountType).toLowerCase();
      } else {
        valA = a[sortField] ?? '';
        valB = b[sortField] ?? '';
      }

      if (sortField !== 'balance' && sortField !== 'openingBalance' && sortField !== 'accountType' && typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [ledgerAccounts, searchTerm, filterStatus, filterType, sortField, sortDirection]);

  const kpiMetrics = useMemo(
    () => computeAccountsKpis(ledgerAccounts, hqMode, true),
    [ledgerAccounts, hqMode],
  );

  return (
    <>
      <AsicPageHeader
        title="Entities"
        actions={
          <button
            type="button"
            className={asicBtnPrimary}
            {...buttonProps()}
            onClick={() => {
              if (!canWrite) return;
              setEditingAccount(null);
              setIsModalOpen(true);
            }}
          >
            New entity
          </button>
        }
      />

      <AsicKpiStrip metrics={kpiMetrics} />

      <div className={icfCard}>
        <div className="border-b border-slate-200 px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className={`${asicFormGrid} min-w-0 flex-1`}>
              <div className="min-w-0 lg:col-span-5">
                <label className={icfLabel} htmlFor="icf-accounts-search">Find</label>
                <input
                  id="icf-accounts-search"
                  className={icfInput}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Name, phone, email, notes"
                />
              </div>
              <div className="lg:col-span-2">
                <label className={icfLabel} htmlFor="icf-accounts-type">Type</label>
                <select id="icf-accounts-type" className={icfInput} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  {entityAccountTypeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className={icfLabel} htmlFor="icf-accounts-status">Status</label>
                <select id="icf-accounts-status" className={icfInput} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex items-end lg:col-span-1">
                <span className="pb-1 text-[11px] text-slate-500">{filteredAndSorted.length} entities</span>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className={`${icfTable} min-w-[880px]`}>
            <thead>
              <tr className={icfTheadRow}>
                <th className={`${icfTh} cursor-pointer select-none`} onClick={() => handleSort('name')}>
                  Name{sortMark('name')}
                </th>
                <th className={`${icfTh} cursor-pointer select-none`} onClick={() => handleSort('accountType')}>
                  Type{sortMark('accountType')}
                </th>
                <th className={`${icfTh} cursor-pointer select-none`} onClick={() => handleSort('phone')}>
                  Phone{sortMark('phone')}
                </th>
                <th className={`${icfTh} cursor-pointer select-none`} onClick={() => handleSort('email')}>
                  Email{sortMark('email')}
                </th>
                <th
                  className={`${icfTh} cursor-pointer select-none text-right`}
                  onClick={() => handleSort('openingBalance')}
                >
                  Opening (AED){sortMark('openingBalance')}
                </th>
                <th className={`${icfTh} cursor-pointer select-none text-right`} onClick={() => handleSort('balance')}>
                  Balance (AED){sortMark('balance')}
                </th>
                <th className={`${icfTh} cursor-pointer select-none`} onClick={() => handleSort('status')}>
                  Status{sortMark('status')}
                </th>
                <th className={icfTh} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <ASICTableRowsSkeleton rows={8} cols={8} />
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`${icfTd} py-6 text-center text-slate-500`}>
                    {ledgerAccounts.length === 0 ? 'No entities yet.' : 'No rows match the filters.'}
                  </td>
                </tr>
              ) : (
                filteredAndSorted.map(account => (
                  <tr
                    key={account.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => openAccountDetail(account)}
                  >
                    <td className={icfTd} onClick={e => e.stopPropagation()}>
                      <ICFundAccountLink
                        slug={accountLinkSlug(account)}
                        accountId={account.id}
                        name={account.name}
                        accounts={[account]}
                      />
                    </td>
                    <td className={`${icfTd} text-slate-500`}>{accountTypeLabel(account.accountType)}</td>
                    <td className={`${icfTd} text-slate-500`}>{account.phone || '—'}</td>
                    <td className={`${icfTd} max-w-[12rem] truncate text-slate-500`}>{account.email || '—'}</td>
                    <td className={`${icfTd} text-right font-mono tabular-nums`}>
                      {fmtLedgerAed(account.openingBalance)}
                    </td>
                    <td className={`${icfTd} text-right`}>
                      <BalanceWithPending balance={account.balance} pendingBalance={account.pendingBalance} />
                    </td>
                    <td className={`${icfTd} capitalize text-slate-500`}>{account.status}</td>
                    <td className={`${icfTd} text-right`} onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canWrite ? (
                          <>
                            <button type="button" className={icfBtnGhost} onClick={() => handleEdit(account)}>
                              Edit
                            </button>
                            <button type="button" className={icfBtnGhost} onClick={() => void toggleStatus(account)}>
                              {account.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden">
          {loading ? (
            <MobileCardSkeleton rows={6} />
          ) : filteredAndSorted.length === 0 ? (
            <MobileEmptyState>
              {ledgerAccounts.length === 0 ? 'No entities yet.' : 'No rows match the filters.'}
            </MobileEmptyState>
          ) : (
            <MobileCardList>
              {filteredAndSorted.map(account => (
                <div
                  key={account.id}
                  className={mobileCardInteractiveClass}
                  onClick={() => openAccountDetail(account)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">
                      <ICFundAccountLink
                        slug={accountLinkSlug(account)}
                        accountId={account.id}
                        name={account.name}
                        accounts={[account]}
                      />
                    </p>
                    <span className="shrink-0 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-600">
                      {account.status}
                    </span>
                  </div>
                  <MobileCardField label="Type">{accountTypeLabel(account.accountType)}</MobileCardField>
                  <MobileCardField label="Phone">{account.phone || '—'}</MobileCardField>
                  <MobileCardField label="Balance">
                    <BalanceWithPending balance={account.balance} pendingBalance={account.pendingBalance} />
                  </MobileCardField>
                  {canWrite ? (
                    <MobileCardActions>
                      <button type="button" className={icfBtnGhost} onClick={e => { e.stopPropagation(); handleEdit(account); }}>
                        Edit
                      </button>
                      <button type="button" className={icfBtnGhost} onClick={e => { e.stopPropagation(); void toggleStatus(account); }}>
                        {account.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </MobileCardActions>
                  ) : null}
                </div>
              ))}
            </MobileCardList>
          )}
        </div>
      </div>

      {isModalOpen ? (
        <ICFundAccountModal
          branchId={ledgerBranchId}
          open={isModalOpen}
          account={editingAccount}
          onClose={handleModalClose}
          onSave={handleSave}
          entityLedgerMode
        />
      ) : null}
    </>
  );
}
