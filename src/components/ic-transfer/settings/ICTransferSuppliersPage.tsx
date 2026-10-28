'use client';

import React, { useMemo, useState } from 'react';
import ICTransferSettingsUsersPage from '@/components/ic-transfer/settings/ICTransferSettingsUsersPage';
import { AddButton } from '@/components/ic-transfer/ui';
import AddUserModal from '@/components/ic-transfer/settings/AddUserModal';
import { useApp } from '@/context/AppContext';
import type { ICSupplier } from '@/types';
import {
  filterSuppliersForAdminPortal,
  filterSuppliersForBranchPortal,
  type ICTransferPortalMode,
} from '@/lib/icTransfer/branchPortalScope';

type Props = {
  portalMode?: ICTransferPortalMode;
  branchId?: string;
};

export default function ICTransferSuppliersPage({ portalMode = 'admin', branchId }: Props) {
  const isBranchPortal = portalMode === 'branch' && !!branchId;
  const { icRegions, icSuppliers, addICSupplier, updateICSupplier, deleteICSupplier } = useApp();
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ICSupplier | null>(null);

  const scopedSuppliers = useMemo(() => {
    if (isBranchPortal) return filterSuppliersForBranchPortal(icSuppliers, branchId!);
    return filterSuppliersForAdminPortal(icSuppliers);
  }, [icSuppliers, isBranchPortal, branchId]);

  const handleSaveSupplier = async (data: {
    id?: string;
    name: string;
    phone: string;
    commission: number | null;
    regionId: string;
    email: string;
    address: string;
  }) => {
    if (data.id) {
      await updateICSupplier(
        data.id,
        data.name,
        data.phone,
        data.commission,
        data.regionId,
        data.email,
        data.address,
      );
    } else {
      await addICSupplier(
        data.name,
        data.phone,
        data.commission,
        data.regionId,
        data.email,
        data.address,
        isBranchPortal ? branchId : undefined,
      );
    }
    setSupplierModalOpen(false);
    setEditingSupplier(null);
  };

  const handleDeleteSupplier = async (id: string) => {
    await deleteICSupplier(id);
  };

  const openEdit = (supplier: ICSupplier) => {
    setEditingSupplier(supplier);
    setSupplierModalOpen(true);
  };

  const openAdd = () => {
    setEditingSupplier(null);
    setSupplierModalOpen(true);
  };

  return (
    <ICTransferSettingsUsersPage
      title="Suppliers"
      data={scopedSuppliers}
      onEditItem={openEdit}
      onDeleteItem={handleDeleteSupplier}
      actions={<AddButton label="Add supplier" onClick={openAdd} />}
      showCommission={false}
      showRate={false}
    >
      <AddUserModal
        open={supplierModalOpen}
        onClose={() => {
          setSupplierModalOpen(false);
          setEditingSupplier(null);
        }}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        regions={icRegions}
        showCommission={false}
        showRate={false}
        showPassword={false}
        initialData={editingSupplier}
        onAdd={handleSaveSupplier}
      />
    </ICTransferSettingsUsersPage>
  );
}
