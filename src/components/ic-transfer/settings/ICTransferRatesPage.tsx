'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader, PageShell, SectionCard, AddButton, SearchInput, IconManageUsers, IconAddGroup } from '../ui';
import { useApp } from '@/context/AppContext';
import { getAllCustomers, getCustomersBySlug } from '@/app/actions/customerActions';
import { portalMobileToolbarClass } from '@/lib/icTransfer/layoutConstants';
import AsicKpiStrip from '@/components/asic/AsicKpiStrip';
import { isRateGroupUpdatedToday, sortRateGroupsForTable } from '@/lib/icTransfer/rateGroupUtils';
import {
  mergeBranchPortalCustomerAssignments,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';
import {
  getBranchManageableRateGroups,
  filterRateGroupsForAdminPortal,
} from '@/lib/icTransfer/branchRateScope';
import { hasAdvancedPricing, remapPricingConfigToConversion } from '@/lib/icTransfer/ratePricing';
import RateGroupsTable from './RateGroupsTable';
import RateGroupBulkUpdateBar from './RateGroupBulkUpdateBar';
import RateGroupFormModal, { type RateGroupFormValues } from './RateGroupFormModal';
import RateGroupManageUsersModal, { type RateGroupMembersPayload } from './RateGroupManageUsersModal';
import RateGroupViewModal from './RateGroupViewModal';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import { canManageICTransferGlobalSettings } from '@/lib/icTransfer/settings';
import type { ICRateGroup, ICRateGroupPricingConfig } from '@/types';

type Props = {
  portalMode?: ICTransferPortalMode;
  branchId?: string;
};

export default function ICTransferRatesPage({ portalMode = 'admin', branchId }: Props) {
  const {
    icRateGroups,
    addICRateGroup,
    updateICRateGroup,
    deleteICRateGroup,
    bulkUpdateICRateGroupRates,
    updateICRateGroupPricing,
    setICRateGroupCustomers,
    setICRateGroupBranches,
    allBranches,
    showToast,
    currentSlug,
    user,
    icTransferSettings,
    updateICTransferAutoRateReset,
  } = useApp();

  const isBranchPortal = portalMode === 'branch' && !!branchId;
  const canManageGlobalSettings = canManageICTransferGlobalSettings(user);
  const [isTogglingAutoReset, setIsTogglingAutoReset] = useState(false);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingGroup, setEditingGroup] = useState<ICRateGroup | null>(null);
  const [viewGroup, setViewGroup] = useState<ICRateGroup | null>(null);
  const [manageUsersOpen, setManageUsersOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isManagingUsers, setIsManagingUsers] = useState(false);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [savingPricingGroupId, setSavingPricingGroupId] = useState<string | null>(null);
  const [branchCustomers, setBranchCustomers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const res = isBranchPortal
        ? await getCustomersBySlug(currentSlug)
        : await getAllCustomers();
      if (res.success && res.customers) {
        setBranchCustomers(res.customers.map(c => ({ id: c.id, name: c.name })));
      }
    };
    if (isBranchPortal && !currentSlug) return;
    void fetchCustomers();
  }, [currentSlug, isBranchPortal]);

  const branchCustomerIdSet = useMemo(
    () => new Set(branchCustomers.map(c => c.id)),
    [branchCustomers],
  );

  const branchCustomerRateGroups = useMemo(() => {
    if (isBranchPortal && branchId) {
      return getBranchManageableRateGroups(icRateGroups, branchId, branchCustomerIdSet);
    }
    return filterRateGroupsForAdminPortal(icRateGroups);
  }, [icRateGroups, isBranchPortal, branchId, branchCustomerIdSet]);

  const scopedRateGroups = branchCustomerRateGroups;

  const rateKpi = useMemo(() => {
    const customers = new Set(scopedRateGroups.flatMap(g => g.customerIds ?? []));
    const stale = scopedRateGroups.filter(g => !isRateGroupUpdatedToday(g.updatedAt)).length;
    return {
      groups: scopedRateGroups.length,
      customers: customers.size,
      stale,
    };
  }, [scopedRateGroups]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? scopedRateGroups.filter(group =>
          group.name.toLowerCase().includes(q) ||
          group.country.toLowerCase().includes(q),
        )
      : scopedRateGroups;
    return sortRateGroupsForTable(base);
  }, [scopedRateGroups, search]);

  const handleBulkSave = async (
    groupIds: string[],
    saleRate: number,
    conversionRate: number,
    pricingConfig: ICRateGroupPricingConfig | null,
    convertedRateExact?: number | null,
  ) => {
    setIsBulkSaving(true);
    try {
      const allowedIds = isBranchPortal
        ? groupIds.filter(id => scopedRateGroups.some(g => g.id === id))
        : groupIds;

      if (allowedIds.length === 0) {
        showToast('Select at least one rate group you can manage.', 'error');
        return false;
      }

      let success = false;

      if (isBranchPortal) {
        const advanced = hasAdvancedPricing(pricingConfig);
        // Simple flat: prefer the exact local rate typed in the editor.
        // Advanced: derive from seeded AED×conversion (per-type/slab config is remapped separately).
        const targetConverted =
          !advanced && convertedRateExact != null && convertedRateExact > 0
            ? convertedRateExact
            : saleRate * conversionRate;
        const results = await Promise.all(
          allowedIds.map(async id => {
            const group = scopedRateGroups.find(g => g.id === id);
            const conv = 1;
            const derivedSale = conv > 0 ? targetConverted / conv : saleRate;
            // Rebase any advanced per-type / slab rates onto this group's conversion.
            const remappedConfig = remapPricingConfigToConversion(pricingConfig, conv);
            return updateICRateGroupPricing(id, derivedSale, conv, remappedConfig);
          }),
        );
        success = results.every(Boolean);
        if (!success) {
          showToast('Some rate groups failed to update.', 'error');
        }
      } else {
        success = await bulkUpdateICRateGroupRates(
          allowedIds,
          saleRate,
          conversionRate,
          pricingConfig,
        );
      }

      return success;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to apply rates', 'error');
      return false;
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleSaveGroupPricing = async (
    groupId: string,
    saleRate: number,
    conversionRate: number,
    pricingConfig: ICRateGroupPricingConfig | null,
  ) => {
    if (isBranchPortal && !scopedRateGroups.some(g => g.id === groupId)) return false;
    setSavingPricingGroupId(groupId);
    const group = scopedRateGroups.find(g => g.id === groupId);
    let finalSale = saleRate;
    const finalConv = conversionRate > 0 ? conversionRate : 1;

    if (isBranchPortal && group) {
      const convertedRate = saleRate * conversionRate;
      finalSale = finalConv > 0 ? convertedRate / finalConv : saleRate;
    }

    const remappedConfig = isBranchPortal
      ? remapPricingConfigToConversion(pricingConfig, finalConv)
      : pricingConfig;

    const success = await updateICRateGroupPricing(groupId, finalSale, finalConv, remappedConfig);
    setSavingPricingGroupId(null);
    return success;
  };

  const openCreateModal = () => {
    setFormMode('create');
    setEditingGroup(null);
    setFormOpen(true);
  };

  const openEditModal = (group: ICRateGroup) => {
    setViewGroup(null);
    setFormMode('edit');
    setEditingGroup(group);
    setFormOpen(true);
  };

  const openViewModal = (group: ICRateGroup) => {
    setViewGroup(group);
  };

  const handleDelete = async (group: ICRateGroup) => {
    if (!confirm(`Delete rate group "${group.name}"?`)) return;
    await deleteICRateGroup(group.id);
  };

  const handleSave = async (values: RateGroupFormValues) => {
    const { name, country } = values;

    if (!name || !country) return;

    setIsSaving(true);
    let success = false;

    if (editingGroup) {
      success = await updateICRateGroup(
        editingGroup.id,
        name,
        country,
        'AED',
        editingGroup.saleRate,
        1,
      );
    } else {
      const newGroupId = await addICRateGroup(
        name,
        country,
        'AED',
        0,
        1,
        isBranchPortal ? branchId : undefined,
      );
      success = !!newGroupId;
    }

    setIsSaving(false);
    if (success) {
      setFormOpen(false);
      setEditingGroup(null);
    }
  };

  const handleManageUsersSave = async ({ groupId, branchIds, customerIds }: RateGroupMembersPayload) => {
    setIsManagingUsers(true);

    let finalBranchIds = branchIds;
    let finalCustomerIds = customerIds;

    if (isBranchPortal && branchId) {
      const group = icRateGroups.find(g => g.id === groupId);
      finalBranchIds = [];
      finalCustomerIds = mergeBranchPortalCustomerAssignments(
        group?.customerIds,
        branchCustomerIdSet,
        customerIds,
      );
    }

    const resBranch = await setICRateGroupBranches(groupId, finalBranchIds);
    const resCust = await setICRateGroupCustomers(groupId, finalCustomerIds);
    setIsManagingUsers(false);
    if (resBranch && resCust) {
      setManageUsersOpen(false);
    }
  };

  const currentBranch = isBranchPortal
    ? allBranches.find(b => b.id === branchId)
    : undefined;

  const handleAutoRateResetToggle = async (next: boolean) => {
    setIsTogglingAutoReset(true);
    await updateICTransferAutoRateReset(next);
    setIsTogglingAutoReset(false);
  };

  return (
    <PageShell>
      <PageHeader
        title="Rates"
        actions={
          <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:max-w-sm [&>button]:min-w-0 [&>button]:w-full">
            <AddButton
              label="Manage Users"
              icon={<IconManageUsers />}
              onClick={() => setManageUsersOpen(true)}
            />
            <AddButton
              label="Create Group"
              icon={<IconAddGroup />}
              onClick={openCreateModal}
            />
          </div>
        }
      />

      <AsicKpiStrip
        metrics={[
          { label: 'Rate groups', value: rateKpi.groups.toLocaleString(), hint: isBranchPortal ? 'Your groups' : 'All groups' },
          { label: 'Customers', value: rateKpi.customers.toLocaleString(), hint: 'Assigned', tone: 'indigo' },
          {
            label: 'Stale today',
            value: rateKpi.stale.toLocaleString(),
            hint: 'Not updated today',
            tone: rateKpi.stale > 0 ? 'amber' as const : 'emerald' as const,
          },
        ]}
        columns={3}
      />

      {canManageGlobalSettings ? (
        <SectionCard className="mb-5">
          <div className="px-4 py-4 md:px-6">
            <ToggleSwitch
              checked={icTransferSettings.autoRateResetEnabled}
              onChange={handleAutoRateResetToggle}
              disabled={isTogglingAutoReset}
              tone="amber"
              label="Automatic rate reset at 5:00 PM Dubai time"
              hint="When enabled, every rate group's sale rate and pricing config resets to 0 daily at 5:00 PM GST (13:00 UTC). Customer and branch assignments are kept."
            />
          </div>
        </SectionCard>
      ) : null}

      <SectionCard className="mb-5">
        <RateGroupBulkUpdateBar
          groups={scopedRateGroups}
          isSaving={isBulkSaving}
          convertedRateOnly={isBranchPortal}
          standalone
          onSave={handleBulkSave}
        />
      </SectionCard>

      <SectionCard>
        <div className={`${portalMobileToolbarClass} md:border-b md:border-slate-100 md:px-6 md:py-4 md:pb-3`}>
          <h3 className="shrink-0 text-base font-bold text-slate-900 sm:text-lg">
            {isBranchPortal ? 'Your customer rate groups' : 'All Groups'}
          </h3>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search groups…"
            className="min-w-0 max-sm:w-full flex-1"
          />
        </div>
        <div className="p-0 pb-3 md:pb-5">
          <RateGroupsTable
            groups={filteredGroups}
            onView={openViewModal}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onSavePricing={handleSaveGroupPricing}
            savingGroupId={savingPricingGroupId}
            hideBranchColumn={isBranchPortal}
            convertedRateOnly={isBranchPortal}
          />
        </div>
      </SectionCard>

      <RateGroupFormModal
        open={formOpen}
        mode={formMode}
        initialGroup={editingGroup}
        isSaving={isSaving}
        onClose={() => {
          setFormOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleSave}
      />

      <RateGroupManageUsersModal
        open={manageUsersOpen}
        groups={scopedRateGroups}
        allBranches={isBranchPortal && currentBranch ? [currentBranch] : allBranches}
        branchCustomers={branchCustomers}
        customersOnly={isBranchPortal}
        isSaving={isManagingUsers}
        onClose={() => setManageUsersOpen(false)}
        onSave={handleManageUsersSave}
      />

      <RateGroupViewModal
        group={viewGroup}
        branches={isBranchPortal && currentBranch ? [currentBranch] : allBranches}
        customers={branchCustomers}
        onClose={() => setViewGroup(null)}
        onEdit={openEditModal}
        hideAedRate={isBranchPortal}
        hideBranches={isBranchPortal}
      />
    </PageShell>
  );
}
