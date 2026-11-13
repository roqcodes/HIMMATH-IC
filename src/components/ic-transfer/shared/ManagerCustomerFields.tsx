'use client';

import React, { useEffect, useMemo } from 'react';
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
import { CUSTOMER_FIELD_LABEL, MANAGER_FIELD_LABEL } from '@/lib/counterparties/labels';
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
}: Props) {
  const { icSuppliers } = useApp();

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

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:col-span-2 sm:grid-cols-2">
      <ICTransferFormField
        label={`${MANAGER_FIELD_LABEL} *`}
        className={noManagersAssigned ? 'sm:col-span-2' : undefined}
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
            placeholder={managerPlaceholder}
            disabled={disabled}
          />
        )}
      </ICTransferFormField>
      <ICTransferFormField label={`${CUSTOMER_FIELD_LABEL} *`}>
        <EntitySearchSelect
          options={customerOptions}
          selectedId={customerId}
          onSelectId={id => onCustomerChange(id)}
          placeholder={managerId ? 'Select customer' : 'Pick a manager first'}
          disabled={disabled || !managerId}
        />
      </ICTransferFormField>
    </div>
  );
}

export function resolveManagerDefault(
  customer: ICSupplier | null | undefined,
): string {
  return customer?.homeManagerId || '';
}
