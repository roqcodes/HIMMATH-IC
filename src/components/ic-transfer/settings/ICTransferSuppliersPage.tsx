'use client';

import React, { useMemo, useState } from 'react';
import ICTransferSettingsUsersPage from '@/components/ic-transfer/settings/ICTransferSettingsUsersPage';
import { AddButton } from '@/components/ic-transfer/ui';
import SupplierModal from '@/components/ic-transfer/settings/SupplierModal';
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
  const { icSuppliers, deleteICSupplier } = useApp();
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<ICSupplier | null>(null);

  const scopedSuppliers = useMemo(() => {
    if (isBranchPortal) return filterSuppliersForBranchPortal(icSuppliers, branchId!);
    return filterSuppliersForAdminPortal(icSuppliers);
  }, [icSuppliers, isBranchPortal, branchId]);

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

  const closeModal = () => {
    setSupplierModalOpen(false);
    setEditingSupplier(null);
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
      showCountryColumn
      showSubdivisionColumn
      showLocalityColumn
    >
      <SupplierModal
        open={supplierModalOpen}
        supplier={editingSupplier}
        branchId={isBranchPortal ? branchId : undefined}
        onClose={closeModal}
        onSaved={closeModal}
      />
    </ICTransferSettingsUsersPage>
  );
}
