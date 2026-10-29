'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import { asicBtnOutline, asicBtnPrimary } from '@/components/asic/ui';
import type { ICRateGroup } from '@/types';
import type { Branch } from '@/types';
import { formatRateGroupUpdatedAt, isRateGroupUpdatedToday } from '@/lib/icTransfer/rateGroupUtils';
import { formatAmount } from '@/lib/icTransfer/rateCalculations';
import RateGroupPricingStructure from './RateGroupPricingStructure';
import {
  ModalDetailRow,
  modalCounterpartyPanelClass,
} from '../shared/modalDetailUi';

type CustomerOption = { id: string; name: string };

type Props = {
  group: ICRateGroup | null;
  branches: Branch[];
  customers: CustomerOption[];
  onClose: () => void;
  onEdit: (group: ICRateGroup) => void;
  hideAedRate?: boolean;
  hideBranches?: boolean;
};

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <span className="text-sm font-medium text-slate-400">{emptyLabel}</span>;
  }
  return (
    <div className="mt-0.5 flex flex-wrap gap-1.5">
      {items.map(item => (
        <span
          key={item}
          className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function RateGroupViewModal({
  group,
  customers,
  onClose,
  onEdit,
  hideAedRate = false,
}: Props) {
  if (!group) return null;

  const customerNames = (group.customerIds ?? [])
    .map(id => customers.find(c => c.id === id)?.name || id);
  const stale = !isRateGroupUpdatedToday(group.updatedAt);

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={group.name}
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <button type="button" className={asicBtnOutline} onClick={onClose}>
            Close
          </button>
          <button type="button" className={asicBtnPrimary} onClick={() => onEdit(group)}>
            Edit group
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className={modalCounterpartyPanelClass}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <ModalDetailRow label="Country" value={group.country} />
            <ModalDetailRow
              label="Sale rate (AED)"
              value={<span className="tabular-nums">{formatAmount(group.saleRate)}</span>}
            />
            <ModalDetailRow
              label="Last updated"
              value={
                <span className={stale ? 'font-medium text-orange-700' : undefined}>
                  {formatRateGroupUpdatedAt(group.updatedAt)}
                  {stale ? (
                    <span className="mt-0.5 block text-[11px] font-medium text-orange-600">
                      Not updated today
                    </span>
                  ) : null}
                </span>
              }
            />
          </div>
        </div>

        <RateGroupPricingStructure group={group} convertedRateOnly={hideAedRate} />

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customers</p>
          <ChipList items={customerNames} emptyLabel="No customers assigned" />
        </div>
      </div>
    </Modal>
  );
}
