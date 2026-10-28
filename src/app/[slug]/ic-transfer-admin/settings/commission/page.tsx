import ICTransferSettingsUsersPage from '@/components/ic-transfer/settings/ICTransferSettingsUsersPage';

export default function CommissionManagementPage() {
  return (
    <ICTransferSettingsUsersPage
      title="Commission Rates"
      addButtonLabel="Add Agent"
      modalTitle="Add User"
      showCommission
      showRate={false}
    />
  );
}
