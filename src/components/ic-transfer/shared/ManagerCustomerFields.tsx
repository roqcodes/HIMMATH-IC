'use client';

import React, { useEffect, useMemo } from 'react';
import { asicInput } from '@/components/asic/ui';
import ICTransferFormField from '@/components/ic-transfer/shared/ICTransferFormField';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { useApp } from '@/context/AppContext';
import {
  filterCounterpartiesForManagers,
  filterCounterpartiesForPurchase,
  filterCounterpartiesForSales,
} from '@/lib/icTransfer/branchPortalScope';
import { filterCounterpartiesByKind } from '@/lib/counterparties/roles';
import { buildCounterpartySearchOptions } from '@/lib/icTransfer/entitySearchOptions';
import { CUSTOMER_FIELD_LABEL, MANAGER_FIELD_LABEL, PURCHASE_COUNTERPARTY_FIELD_LABEL } from '@/lib/counterparties/labels';
import type { EntityLedgerBalances } from '@/lib/icTransfer/entitySearchOptions';
import type { ICSupplier } from '@/types';

type Mode = 'sale' | 'purchase';

type Props = {
  branchId?: string;
  /** `null` = pick warehouse first; `[]` = none assigned; non-empty = allowed managers only. */
  allowedManagerIds?: string[] | null;
  mode: Mode;
  managerId: string;
  customerId: string;
  onManagerChange: (id: string) => void;
  onCustomerChange: (id: string) => void;
  entityLedgerById?: Record<string, EntityLedgerBalances>;
  disabled?: boolean;
  /** Only render manager picker (customer chosen elsewhere). */
  managerOnly?: boolean;
  /** Single column in parent grid — no full-width row span. */
  inline?: boolean;
  /** Children participate in parent grid (e.g. 3-col voucher row). */
  contentsGrid?: boolean;
  inputClassName?: string;
};

export default function ManagerCustomerFields({
  branchId,
  allowedManagerIds,
  mode,
  managerId,
  customerId,
  onManagerChange,
  onCustomerChange,
  entityLedgerById,
  disabled,
  managerOnly,
  inline,
  contentsGrid,
  inputClassName = asicInput,
}: Props) {
  const { icSuppliers, quickCreateICCounterparty } = useApp();

  const noManagersAssigned =
    allowedManagerIds !== null && allowedManagerIds !== undefined && allowedManagerIds.length === 0;

  const managers = useMemo(() => {
    if (allowedManagerIds === null || allowedManagerIds === undefined) return [];
    if (allowedManagerIds.length === 0) return [];
    const filtered = filterCounterpartiesForManagers(icSuppliers, branchId, allowedManagerIds);
    if (filtered.length === 0) {
      const allowed = new Set(allowedManagerIds);
      return filterCounterpartiesByKind(icSuppliers, 'manager').filter(m => allowed.has(m.id));
    }
    return filtered;
  }, [icSuppliers, branchId, allowedManagerIds]);

  const managerPlaceholder = allowedManagerIds === null
    ? 'Select warehouse first'
    : noManagersAssigned
      ? 'No managers assigned'
      : 'Select manager';

  const customers = useMemo(() => {
    const filter =
      mode === 'sale'
        ? filterCounterpartiesForSales
        : filterCounterpartiesForPurchase;
    return filter(icSuppliers, branchId, managerId || undefined);
  }, [icSuppliers, branchId, managerId, mode]);

  const managerOptions = useMemo(
    () => managers.map(m => ({ value: m.id, label: m.name, code: m.code })),
    [managers],
  );

  const customerOptions = useMemo(
    () => buildCounterpartySearchOptions(customers, entityLedgerById),
    [customers, entityLedgerById],
  );

  useEffect(() => {
    if (!managerId) return;
    if (customerId && !customers.some(c => c.id === customerId)) {
      onCustomerChange('');
    }
  }, [managerId, customers, customerId, onCustomerChange]);

  const wrapClass = contentsGrid
    ? 'contents'
    : inline
      ? 'min-w-0'
      : 'grid grid-cols-1 gap-x-3 gap-y-1 sm:col-span-2 sm:grid-cols-2';

  return (
    <div className={wrapClass}>
      <ICTransferFormField
        label={`${MANAGER_FIELD_LABEL} *`}
        compact={inline || contentsGrid}
        className={`min-w-0 ${noManagersAssigned && !contentsGrid ? 'sm:col-span-2' : ''}`}
      >
        {noManagersAssigned ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            No managers assigned — edit this warehouse or branch and assign at least one manager.
          </p>
        ) : (
          <EntitySearchSelect
            options={managerOptions}
            selectedId={managerId}
            onSelectId={id => onManagerChange(id)}
            createOptionLabel={name => `Create manager “${name}”`}
            onCreateOption={async name => {
              const manager = await quickCreateICCounterparty(name, 'manager', branchId);
              return manager ? { value: manager.id, label: manager.name, code: manager.code } : null;
            }}
            placeholder={managerPlaceholder}
            disabled={disabled}
            inputClassName={inputClassName}
            showDetailLine={!inline}
          />
        )}
      </ICTransferFormField>
      {managerOnly ? null : (
        <ICTransferFormField label={`${mode === 'purchase' ? PURCHASE_COUNTERPARTY_FIELD_LABEL : CUSTOMER_FIELD_LABEL} *`} compact={inline || contentsGrid} className="min-w-0">
          <EntitySearchSelect
            options={customerOptions}
            selectedId={customerId}
            onSelectId={id => onCustomerChange(id)}
            createOptionLabel={name => `Create ${mode === 'purchase' ? 'supplier' : 'customer'} “${name}”`}
            onCreateOption={async name => {
              const customer = await quickCreateICCounterparty(
                name,
                'customer',
                branchId,
                managerId || null,
                [mode === 'purchase' ? 'supplier' : 'party'],
              );
              return customer ? { value: customer.id, label: customer.name, code: customer.code } : null;
            }}
            placeholder={managerId ? 'Select customer' : 'Pick a manager first'}
            disabled={disabled || !managerId}
            inputClassName={inputClassName}
            showDetailLine={!inline}
          />
        </ICTransferFormField>
      )}
    </div>
  );
}

export function resolveManagerDefault(
  customer: ICSupplier | null | undefined,
): string {
  return customer?.homeManagerId || '';
}
