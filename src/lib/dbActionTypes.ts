import type {
  Branch,
  ICRegion,
  ICSupplier,
  ICWarehouse,
  ICBranch,
  ICRateGroup,
  ICTransferSettings,
  ICPurchase,
  ICSale,
  ICWarehouseTransaction,
} from '@/types';

export interface DbActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InitialDataPayload {
  globalBranches: Branch[];
  branches: Branch[];
  icRegions: ICRegion[];
  icSuppliers: ICSupplier[];
  icWarehouses: ICWarehouse[];
  icBranches: ICBranch[];
  icRateGroups: ICRateGroup[];
  icTransferSettings: ICTransferSettings;
  icPurchases: ICPurchase[];
  icSales: ICSale[];
  icWarehouseTransactions: ICWarehouseTransaction[];
}

/** Lightweight poll payload — sales, purchases, warehouse tx, branch balances only. */
export interface TransactionalDataPayload {
  globalBranches: Branch[];
  branches: Branch[];
  icPurchases: ICPurchase[];
  icSales: ICSale[];
  icWarehouseTransactions: ICWarehouseTransaction[];
}
