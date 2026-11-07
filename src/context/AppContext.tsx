'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  User,
  Branch,
  ICRegion,
  ICSupplier,
  ICWarehouse,
  ICRateGroup,
  ICRateGroupPricingConfig,
  ICTransferSettings,
  ICPurchase,
  ICSale,
  ICWarehouseTransaction,
} from '@/types';
import type { CounterpartyRole } from '@/lib/counterparties/roles';
import { getCurrentUserAction, logoutAction } from '@/app/actions/auth';
import { fetchAsicInitialDataAction, fetchAsicTransactionalDataAction } from '@/app/actions/asicDataActions';
import { parseAsicPath } from '@/lib/asic/routing';
import { mergeICRateGroupRowPreservingMembers } from '@/lib/icTransferMappers';
import { authSessionSlug } from '@/lib/icTransfer/warehouseSlug';
import {
  dbAddICRegionAction,
  dbAddICSupplierAction,
  dbAddICWarehouseAction,
  dbAddICRateGroupAction,
  dbUpdateICRateGroupAction,
  dbBulkUpdateICRateGroupRatesAction,
  dbUpdateICRateGroupPricingAction,
  dbDeleteICRateGroupAction,
  dbSetICRateGroupCustomersAction,
  dbSetICRateGroupBranchesAction,
  dbAddICPurchaseAction,
  dbAddICSaleAction,
  dbUpdateICRegionAction,
  dbDeleteICRegionAction,
  dbUpdateICSupplierAction,
  dbDeleteICSupplierAction,
  dbUpdateICWarehouseAction,
  dbDeleteICWarehouseAction,
  dbUpdateICPurchaseAction,
  dbDeleteICPurchaseAction,
  dbUpdateICSaleAction,
  dbDeleteICSaleAction,
  branchResubmitICSaleAction,
  branchDeleteICSaleAction,
  branchRequestCancelICSaleAction,
} from '@/app/actions/icTransferActions';
import {
  updateICTransferSalesEnabledAction,
  updateICTransferAutoRateResetAction,
  updateICTransferWarehouseFulfillmentAction,
} from '@/app/actions/icTransferSettingsActions';
import { DEFAULT_IC_TRANSFER_SETTINGS } from '@/lib/icTransfer/settings';
import { isBranchScopedUser, isBranchPortalRole } from '@/lib/rbac';
import {
  getVisibleMainNavItems,
  resolveCompactPortalHome,
  isWarehousePortalRoute,
} from '@/lib/navigation/mainNav';
import { useAutoRefreshData } from '@/hooks/useAutoRefreshData';
import {
  getTransactionalRefetchPauseDepth,
  isTransactionalRefetchPaused,
  subscribeTransactionalRefetchPause,
} from '@/lib/icTransfer/transactionalRefetchPause';
import { useTrackedCallback } from '@/hooks/useTrackedCallback';
import { trackLoading } from '@/lib/loadingBar';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  toasts: Toast[];
  globalBranches: Branch[];
  branches: Branch[];
  isInitialLoading: boolean;
  icRegions: ICRegion[];
  icSuppliers: ICSupplier[];
  icWarehouses: ICWarehouse[];
  icRateGroups: ICRateGroup[];
  icTransferSettings: ICTransferSettings;
  icPurchases: ICPurchase[];
  icSales: ICSale[];
  icWarehouseTransactions: ICWarehouseTransaction[];
}

interface AppContextType extends AppState {
  login: (user: User) => void;
  logout: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
  isICTransferRoute: boolean;
  isICTransferBranchRoute: boolean;
  isWarehouseRoute: boolean;
  compactPortalHome: string;
  refetchData: (userOverride?: User | null, options?: { silent?: boolean }) => Promise<void>;
  registerPageRefresh: (handler: () => void | Promise<void>) => () => void;
  refreshAppData: () => Promise<void>;
  isBranchView: boolean;
  currentSlug: string;
  allBranches: Branch[];
  addICRegion: (name: string, country: string) => Promise<boolean>;
  updateICRegion: (id: string, name: string, country: string) => Promise<boolean>;
  deleteICRegion: (id: string) => Promise<boolean>;
  addICSupplier: (
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    country: string,
    subdivision: string,
    locality: string,
    branchId?: string | null,
    roles?: CounterpartyRole[],
  ) => Promise<boolean>;
  updateICSupplier: (
    id: string,
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    country: string,
    subdivision: string,
    locality: string,
    roles?: CounterpartyRole[],
  ) => Promise<boolean>;
  deleteICSupplier: (id: string) => Promise<boolean>;
  addICWarehouse: (
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    indiaState: string,
    indiaCity: string,
    sendDeliveryProofToCustomer?: boolean,
    branchId?: string | null,
  ) => Promise<boolean>;
  updateICWarehouse: (
    id: string,
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    indiaState: string,
    indiaCity: string,
    sendDeliveryProofToCustomer?: boolean,
  ) => Promise<boolean>;
  deleteICWarehouse: (id: string) => Promise<boolean>;
  addICRateGroup: (
    name: string,
    country: string,
    currency: string,
    saleRate: number,
    conversionRate: number,
    createdByBranchId?: string,
  ) => Promise<string | null>;
  updateICRateGroup: (
    id: string,
    name: string,
    country: string,
    currency: string,
    saleRate: number,
    conversionRate: number,
  ) => Promise<boolean>;
  bulkUpdateICRateGroupRates: (
    groupIds: string[],
    saleRate: number,
    conversionRate: number,
    pricingConfig?: ICRateGroupPricingConfig | null,
  ) => Promise<boolean>;
  updateICRateGroupPricing: (
    groupId: string,
    saleRate: number,
    conversionRate: number,
    pricingConfig: ICRateGroupPricingConfig | null,
  ) => Promise<boolean>;
  deleteICRateGroup: (id: string) => Promise<boolean>;
  setICRateGroupCustomers: (groupId: string, customerIds: string[]) => Promise<boolean>;
  setICRateGroupBranches: (groupId: string, branchIds: string[]) => Promise<boolean>;
  updateICTransferSalesEnabled: (enabled: boolean) => Promise<boolean>;
  updateICTransferAutoRateReset: (enabled: boolean) => Promise<boolean>;
  updateICTransferWarehouseFulfillment: (enabled: boolean) => Promise<boolean>;
  addICPurchase: (purchase: Omit<ICPurchase, 'id' | 'createdAt'>) => Promise<boolean>;
  updateICPurchase: (
    id: string,
    updates: Partial<Omit<ICPurchase, 'id' | 'createdAt'>>,
  ) => Promise<boolean>;
  addICSale: (
    sale: Omit<ICSale, 'id' | 'createdAt' | 'enteredBy' | 'enteredByName' | 'enteredByUserId'>,
  ) => Promise<boolean>;
  updateICSale: (
    id: string,
    updates: Partial<Omit<ICSale, 'id' | 'createdAt'>>,
  ) => Promise<boolean>;
  resubmitICSale: (
    id: string,
    updates: import('@/lib/icTransfer/saleChanges').ICSaleContentFields,
    branchSlug?: string,
  ) => Promise<boolean>;
  branchDeleteICSale: (id: string, branchSlug?: string) => Promise<boolean>;
  branchRequestCancelICSale: (id: string, branchSlug?: string) => Promise<boolean>;
  deleteICPurchase: (id: string) => Promise<boolean>;
  deleteICSale: (id: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | null>(null);

type AsicData = NonNullable<Awaited<ReturnType<typeof fetchAsicInitialDataAction>>['data']>;

const getSlugFromPath = (path: string): string => {
  const parsed = parseAsicPath(path);
  if (parsed.portal === 'admin-root' || !parsed.branchSlug) return 'superadmin';
  return parsed.branchSlug;
};

const resolveViewBranchSlug = (pathname: string, currentSlug: string): string | null => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'funds' && parts[1]) {
    return parts[1];
  }
  if (currentSlug !== 'superadmin') return currentSlug;
  return null;
};

const findBranchBySlug = (branches: Branch[], slug: string) =>
  branches.find(
    b =>
      b.slug === slug ||
      b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug,
  );

function icStateFromAsicData(data: AsicData): Pick<
  AppState,
  | 'globalBranches'
  | 'branches'
  | 'icRegions'
  | 'icSuppliers'
  | 'icWarehouses'
  | 'icRateGroups'
  | 'icTransferSettings'
  | 'icPurchases'
  | 'icSales'
  | 'icWarehouseTransactions'
> {
  return {
    globalBranches: data.globalBranches || data.branches,
    branches: data.branches,
    icRegions: data.icRegions || [],
    icSuppliers: data.icSuppliers || [],
    icWarehouses: data.icWarehouses || [],
    icRateGroups: data.icRateGroups || [],
    icTransferSettings: data.icTransferSettings || { ...DEFAULT_IC_TRANSFER_SETTINGS },
    icPurchases: data.icPurchases || [],
    icSales: data.icSales || [],
    icWarehouseTransactions: data.icWarehouseTransactions || [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentSlug = useMemo(() => getSlugFromPath(pathname), [pathname]);
  const refetchInFlightRef = useRef(false);
  const appRefreshInFlightRef = useRef(false);
  const pageRefreshHandlersRef = useRef(new Set<() => void | Promise<void>>());

  const [state, setState] = useState<AppState>({
    user: null,
    isAuthenticated: false,
    toasts: [],
    globalBranches: [],
    branches: [],
    isInitialLoading: true,
    icRegions: [],
    icSuppliers: [],
    icWarehouses: [],
    icRateGroups: [],
    icTransferSettings: { ...DEFAULT_IC_TRANSFER_SETTINGS },
    icPurchases: [],
    icSales: [],
    icWarehouseTransactions: [],
  });

  const refetchData = useCallback(async (userOverride?: User | null, options?: { silent?: boolean }) => {
    if (options?.silent && isTransactionalRefetchPaused()) return;
    if (refetchInFlightRef.current) return;
    refetchInFlightRef.current = true;
    const run = async () => {
      try {
        const slug = authSessionSlug(currentSlug);
        const dbRes = await fetchAsicTransactionalDataAction(slug, userOverride);
        if (dbRes.success && dbRes.data) {
          setState(s => ({
            ...s,
            globalBranches: dbRes.data!.globalBranches,
            branches: dbRes.data!.branches,
            icPurchases: dbRes.data!.icPurchases,
            icSales: dbRes.data!.icSales,
            icWarehouseTransactions: dbRes.data!.icWarehouseTransactions,
          }));
        }
      } catch (e) {
        console.error('Failed to refetch data:', e);
      } finally {
        refetchInFlightRef.current = false;
      }
    };
    if (options?.silent) {
      await run();
      return;
    }
    await trackLoading(run);
  }, [currentSlug]);

  const registerPageRefresh = useCallback((handler: () => void | Promise<void>) => {
    pageRefreshHandlersRef.current.add(handler);
    return () => {
      pageRefreshHandlersRef.current.delete(handler);
    };
  }, []);

  const refreshAppData = useCallback(async () => {
    if (appRefreshInFlightRef.current) return;
    appRefreshInFlightRef.current = true;
    try {
      const pageHandlers = Array.from(pageRefreshHandlersRef.current);
      await Promise.all([
        refetchData(undefined, { silent: true }),
        ...pageHandlers.map(handler => Promise.resolve(handler())),
      ]);
    } finally {
      appRefreshInFlightRef.current = false;
    }
  }, [refetchData]);

  const transactionalRefetchPauseDepth = useSyncExternalStore(
    subscribeTransactionalRefetchPause,
    getTransactionalRefetchPauseDepth,
    getTransactionalRefetchPauseDepth,
  );

  useAutoRefreshData({
    enabled:
      state.isAuthenticated &&
      !state.isInitialLoading &&
      transactionalRefetchPauseDepth === 0,
    refetch: () => refetchData(undefined, { silent: true }),
  });

  useEffect(() => {
    let cancelled = false;

    setState(s => ({
      ...s,
      user: null,
      isAuthenticated: false,
      isInitialLoading: true,
    }));

    async function initApp() {
      let currentUser: User | null = null;
      let isAuthenticated = false;
      const errorToasts: Toast[] = [];

      const slug = authSessionSlug(currentSlug);

      try {
        const authRes = await getCurrentUserAction(slug);
        if (cancelled) return;
        if (authRes.success && authRes.data) {
          currentUser = authRes.data;
          isAuthenticated = true;
        } else {
          localStorage.removeItem('hedge_session_' + currentSlug);
        }
      } catch (e) {
        console.error('Failed to load session from server', e);
      }

      let icData: AsicData | null = null;
      try {
        const dbRes = await fetchAsicInitialDataAction(slug, currentUser);
        if (cancelled) return;
        if (dbRes.success && dbRes.data) {
          icData = dbRes.data;
        } else {
          const errText =
            typeof dbRes.error === 'string'
              ? dbRes.error
              : 'Failed to fetch initial database data';
          errorToasts.push({ id: `db-init-${Date.now()}`, message: errText, type: 'error' });
        }
      } catch (e) {
        const errText = e instanceof Error ? e.message : 'Failed to fetch database data';
        errorToasts.push({ id: `db-init-${Date.now()}`, message: errText, type: 'error' });
      }

      setState(s => ({
        ...s,
        user: currentUser,
        isAuthenticated,
        ...(icData ? icStateFromAsicData(icData) : {}),
        isInitialLoading: false,
        toasts: errorToasts.length > 0 ? [...s.toasts, ...errorToasts] : s.toasts,
      }));
    }

    void trackLoading(initApp);

    return () => {
      cancelled = true;
    };
  }, [currentSlug]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
    setState(s => ({ ...s, toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => setState(s => ({ ...s, toasts: s.toasts.filter(t => t.id !== id) })), 3500);
  }, []);

  const login = useCallback((user: User) => {
    setState(s => ({ ...s, user, isAuthenticated: true }));
    localStorage.setItem('hedge_session_' + currentSlug, JSON.stringify({ user, isAuthenticated: true }));
  }, [currentSlug]);

  const logout = useTrackedCallback(async () => {
    const slug = authSessionSlug(currentSlug);
    try {
      await logoutAction(slug);
    } catch (e) {
      console.error('Failed to execute logout Server Action:', e);
    }
    localStorage.removeItem('hedge_session_' + currentSlug);
    setState(s => ({ ...s, user: null, isAuthenticated: false }));

    const baseHref = currentSlug === 'superadmin' ? '/' : `/${currentSlug}`;
    window.location.href = baseHref;
  }, [currentSlug]);

  const addICRegion = useTrackedCallback(async (name: string, country: string) => {
    try {
      const res = await dbAddICRegionAction(name, country);
      if (res.success && res.data) {
        setState(s => ({ ...s, icRegions: [...s.icRegions, res.data!] }));
        showToast('Region added successfully');
        return true;
      }
      showToast(res.error || 'Failed to add region', 'error');
      return false;
    } catch {
      showToast('Error adding region', 'error');
      return false;
    }
  }, [showToast]);

  const updateICRegion = useTrackedCallback(async (id: string, name: string, country: string) => {
    try {
      const res = await dbUpdateICRegionAction(id, name, country);
      if (res.success && res.data) {
        setState(s => ({ ...s, icRegions: s.icRegions.map(r => r.id === id ? res.data! : r) }));
        showToast('Region updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update region', 'error');
      return false;
    } catch {
      showToast('Error updating region', 'error');
      return false;
    }
  }, [showToast]);

  const deleteICRegion = useTrackedCallback(async (id: string) => {
    try {
      const res = await dbDeleteICRegionAction(id);
      if (res.success) {
        setState(s => ({ ...s, icRegions: s.icRegions.filter(r => r.id !== id) }));
        showToast('Region deleted successfully');
        return true;
      }
      showToast(res.error || 'Failed to delete region', 'error');
      return false;
    } catch {
      showToast('Error deleting region', 'error');
      return false;
    }
  }, [showToast]);

  const addICSupplier = useTrackedCallback(async (
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    country: string,
    subdivision: string,
    locality: string,
    branchId?: string | null,
    roles?: CounterpartyRole[],
  ) => {
    try {
      const res = await dbAddICSupplierAction(
        name,
        code.trim() || null,
        phone,
        commission,
        regionId,
        email,
        address,
        country,
        subdivision,
        locality,
        branchId,
        branchId ? currentSlug ?? undefined : undefined,
        roles,
      );
      if (res.success && res.data) {
        setState(s => ({ ...s, icSuppliers: [...s.icSuppliers, res.data!] }));
        showToast('Supplier added successfully');
        return true;
      }
      showToast(res.error || 'Failed to add supplier', 'error');
      return false;
    } catch {
      showToast('Error adding supplier', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const updateICSupplier = useTrackedCallback(async (
    id: string,
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    country: string,
    subdivision: string,
    locality: string,
    roles?: CounterpartyRole[],
  ) => {
    try {
      const res = await dbUpdateICSupplierAction(
        id,
        name,
        code.trim() || null,
        phone,
        commission,
        regionId,
        email,
        address,
        country,
        subdivision,
        locality,
        currentSlug ?? undefined,
        roles,
      );
      if (res.success && res.data) {
        setState(s => ({ ...s, icSuppliers: s.icSuppliers.map(sup => sup.id === id ? res.data! : sup) }));
        showToast('Supplier updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update supplier', 'error');
      return false;
    } catch {
      showToast('Error updating supplier', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const deleteICSupplier = useTrackedCallback(async (id: string) => {
    try {
      const res = await dbDeleteICSupplierAction(id, currentSlug ?? undefined);
      if (res.success) {
        setState(s => ({ ...s, icSuppliers: s.icSuppliers.filter(sup => sup.id !== id) }));
        showToast('Supplier deleted successfully');
        return true;
      }
      showToast(res.error || 'Failed to delete supplier', 'error');
      return false;
    } catch {
      showToast('Error deleting supplier', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const addICWarehouse = useTrackedCallback(async (
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    indiaState: string,
    indiaCity: string,
    sendDeliveryProofToCustomer: boolean = true,
    branchId?: string | null,
  ) => {
    try {
      const res = await dbAddICWarehouseAction(
        name,
        code.trim() || null,
        phone,
        commission,
        regionId,
        email,
        address,
        indiaState,
        indiaCity,
        sendDeliveryProofToCustomer,
        branchId,
      );
      if (res.success && res.data) {
        setState(s => ({ ...s, icWarehouses: [...s.icWarehouses, res.data!] }));
        showToast('Warehouse added successfully');
        return true;
      }
      showToast(res.error || 'Failed to add warehouse', 'error');
      return false;
    } catch {
      showToast('Error adding warehouse', 'error');
      return false;
    }
  }, [showToast]);

  const updateICWarehouse = useTrackedCallback(async (
    id: string,
    name: string,
    code: string,
    phone: string,
    commission: number | null,
    regionId: string,
    email: string,
    address: string,
    indiaState: string,
    indiaCity: string,
    sendDeliveryProofToCustomer: boolean = true,
  ) => {
    try {
      const res = await dbUpdateICWarehouseAction(
        id,
        name,
        code.trim() || null,
        phone,
        commission,
        regionId,
        email,
        address,
        indiaState,
        indiaCity,
        sendDeliveryProofToCustomer,
      );
      if (res.success && res.data) {
        setState(s => ({ ...s, icWarehouses: s.icWarehouses.map(w => w.id === id ? res.data! : w) }));
        showToast('Warehouse updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update warehouse', 'error');
      return false;
    } catch {
      showToast('Error updating warehouse', 'error');
      return false;
    }
  }, [showToast]);

  const deleteICWarehouse = useTrackedCallback(async (id: string) => {
    try {
      const res = await dbDeleteICWarehouseAction(id);
      if (res.success) {
        setState(s => ({ ...s, icWarehouses: s.icWarehouses.filter(w => w.id !== id) }));
        showToast('Warehouse deleted successfully');
        return true;
      }
      showToast(res.error || 'Failed to delete warehouse', 'error');
      return false;
    } catch {
      showToast('Error deleting warehouse', 'error');
      return false;
    }
  }, [showToast]);

  const addICRateGroup = useTrackedCallback(async (
    name: string,
    country: string,
    currency: string,
    saleRate: number,
    conversionRate: number,
    createdByBranchId?: string,
  ) => {
    try {
      const res = await dbAddICRateGroupAction(
        name,
        country,
        currency,
        saleRate,
        conversionRate,
        createdByBranchId,
        createdByBranchId ? currentSlug ?? undefined : undefined,
      );
      if (res.success && res.data) {
        setState(s => ({ ...s, icRateGroups: [res.data!, ...s.icRateGroups] }));
        showToast('Rate group added successfully');
        return res.data.id;
      }
      showToast(res.error || 'Failed to add rate group', 'error');
      return null;
    } catch {
      showToast('Error adding rate group', 'error');
      return null;
    }
  }, [showToast, currentSlug]);

  const updateICRateGroup = useTrackedCallback(async (
    id: string,
    name: string,
    country: string,
    currency: string,
    saleRate: number,
    conversionRate: number,
  ) => {
    try {
      const res = await dbUpdateICRateGroupAction(id, name, country, currency, saleRate, conversionRate);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icRateGroups: s.icRateGroups.map(g =>
            g.id === id ? mergeICRateGroupRowPreservingMembers(g, res.data!) : g,
          ),
        }));
        showToast('Rate group updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update rate group', 'error');
      return false;
    } catch {
      showToast('Error updating rate group', 'error');
      return false;
    }
  }, [showToast]);

  const bulkUpdateICRateGroupRates = useTrackedCallback(async (
    groupIds: string[],
    saleRate: number,
    conversionRate: number,
    pricingConfig?: ICRateGroupPricingConfig | null,
  ) => {
    try {
      const res = await dbBulkUpdateICRateGroupRatesAction(groupIds, saleRate, conversionRate, pricingConfig);
      if (res.success && res.data) {
        const updatedMap = new Map(res.data.map(g => [g.id, g]));
        setState(s => ({
          ...s,
          icRateGroups: s.icRateGroups.map(g => {
            const updated = updatedMap.get(g.id);
            return updated ? mergeICRateGroupRowPreservingMembers(g, updated) : g;
          }),
        }));
        showToast(`Updated ${res.data.length} rate group${res.data.length === 1 ? '' : 's'}`);
        return true;
      }
      showToast(res.error || 'Failed to update rate groups', 'error');
      return false;
    } catch {
      showToast('Error updating rate groups', 'error');
      return false;
    }
  }, [showToast]);

  const updateICRateGroupPricing = useTrackedCallback(async (
    groupId: string,
    saleRate: number,
    conversionRate: number,
    pricingConfig: ICRateGroupPricingConfig | null,
  ) => {
    try {
      const res = await dbUpdateICRateGroupPricingAction(groupId, saleRate, conversionRate, pricingConfig);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icRateGroups: s.icRateGroups.map(g =>
            g.id === groupId ? mergeICRateGroupRowPreservingMembers(g, res.data!) : g,
          ),
        }));
        showToast('Rate pricing updated');
        return true;
      }
      showToast(res.error || 'Failed to update rate pricing', 'error');
      return false;
    } catch {
      showToast('Error updating rate pricing', 'error');
      return false;
    }
  }, [showToast]);

  const deleteICRateGroup = useTrackedCallback(async (id: string) => {
    try {
      const res = await dbDeleteICRateGroupAction(id);
      if (res.success) {
        setState(s => ({ ...s, icRateGroups: s.icRateGroups.filter(g => g.id !== id) }));
        showToast('Rate group deleted successfully');
        return true;
      }
      showToast(res.error || 'Failed to delete rate group', 'error');
      return false;
    } catch {
      showToast('Error deleting rate group', 'error');
      return false;
    }
  }, [showToast]);

  const setICRateGroupCustomers = useTrackedCallback(async (groupId: string, customerIds: string[]) => {
    try {
      const res = await dbSetICRateGroupCustomersAction(groupId, customerIds);
      if (res.success) {
        setState(s => ({
          ...s,
          icRateGroups: s.icRateGroups.map(g => g.id === groupId ? { ...g, customerIds } : g),
        }));
        showToast('Rate group customers updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update rate group customers', 'error');
      return false;
    } catch {
      showToast('Error updating rate group customers', 'error');
      return false;
    }
  }, [showToast]);

  const setICRateGroupBranches = useTrackedCallback(async (groupId: string, branchIds: string[]) => {
    try {
      const res = await dbSetICRateGroupBranchesAction(groupId, branchIds);
      if (res.success) {
        setState(s => ({
          ...s,
          icRateGroups: s.icRateGroups.map(g => g.id === groupId ? { ...g, branchIds } : g),
        }));
        showToast('Rate group branches updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update rate group branches', 'error');
      return false;
    } catch {
      showToast('Error updating rate group branches', 'error');
      return false;
    }
  }, [showToast]);

  const updateICTransferSalesEnabled = useTrackedCallback(async (enabled: boolean) => {
    try {
      const res = await updateICTransferSalesEnabledAction(enabled);
      if (res.success && res.data) {
        setState(s => ({ ...s, icTransferSettings: res.data! }));
        showToast(
          enabled
            ? 'Sales activated — new orders can be created'
            : 'Sales paused — new orders are blocked',
        );
        return true;
      }
      showToast(res.error || 'Failed to update sales setting', 'error');
      return false;
    } catch {
      showToast('Error updating sales setting', 'error');
      return false;
    }
  }, [showToast]);

  const updateICTransferAutoRateReset = useTrackedCallback(async (enabled: boolean) => {
    try {
      const res = await updateICTransferAutoRateResetAction(enabled);
      if (res.success && res.data) {
        setState(s => ({ ...s, icTransferSettings: res.data! }));
        if (enabled) {
          showToast('Automatic rate reset enabled — all groups reset to 0 daily at 5:00 PM Dubai time');
        } else {
          showToast('Automatic rate reset disabled');
        }
        return true;
      }
      showToast(res.error || 'Failed to update rate reset setting', 'error');
      return false;
    } catch {
      showToast('Error updating rate reset setting', 'error');
      return false;
    }
  }, [showToast]);

  const updateICTransferWarehouseFulfillment = useTrackedCallback(async (enabled: boolean) => {
    try {
      const res = await updateICTransferWarehouseFulfillmentAction(enabled);
      if (res.success && res.data) {
        setState(s => ({ ...s, icTransferSettings: res.data! }));
        showToast(
          enabled
            ? 'Warehouse portal & delivery workflow enabled'
            : 'Warehouse portal & delivery workflow disabled — sales complete on create',
        );
        return true;
      }
      showToast(res.error || 'Failed to update fulfillment setting', 'error');
      return false;
    } catch {
      showToast('Error updating fulfillment setting', 'error');
      return false;
    }
  }, [showToast]);

  const addICPurchase = useTrackedCallback(async (purchase: Omit<ICPurchase, 'id' | 'createdAt'>) => {
    try {
      const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
      const res = await dbAddICPurchaseAction(purchase, branchSlug);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icPurchases: [res.data!, ...s.icPurchases],
          icWarehouses:
            purchase.warehouseId
              ? s.icWarehouses.map(w => {
                  if (w.id !== purchase.warehouseId) return w;
                  if (purchase.settlementMode === 'metal') {
                    return {
                      ...w,
                      currentMetalG: (w.currentMetalG ?? 0) + (purchase.metalWeightG || 0),
                    };
                  }
                  return { ...w, currentStock: (w.currentStock ?? 0) + purchase.units };
                })
              : s.icWarehouses,
        }));
        showToast('Purchase recorded successfully');
        return true;
      }
      showToast(res.error || 'Failed to record purchase', 'error');
      return false;
    } catch {
      showToast('Error recording purchase', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const addICSale = useTrackedCallback(async (
    sale: Omit<ICSale, 'id' | 'createdAt' | 'enteredBy' | 'enteredByName' | 'enteredByUserId'>,
  ) => {
    try {
      const res = await dbAddICSaleAction(sale, currentSlug);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icSales: [res.data!, ...s.icSales],
          icWarehouses: res.data!.warehouseId
            ? s.icWarehouses.map(w => {
                if (w.id !== res.data!.warehouseId) return w;
                if (res.data!.settlementMode === 'metal') {
                  const grams = res.data!.metalWeightG || 0;
                  const addUnits = Number(res.data!.units) || 0;
                  return {
                    ...w,
                    currentMetalG: (w.currentMetalG ?? 0) - grams,
                    currentStock: (w.currentStock ?? 0) + addUnits,
                  };
                }
                return w;
              })
            : s.icWarehouses,
        }));
        showToast('Sale recorded successfully');
        return true;
      }
      showToast(res.error || 'Failed to record sale', 'error');
      return false;
    } catch {
      showToast('Error recording sale', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const updateICPurchase = useTrackedCallback(async (
    id: string,
    updates: Partial<Omit<ICPurchase, 'id' | 'createdAt'>>,
  ) => {
    try {
      const branchSlug = currentSlug !== 'superadmin' ? currentSlug : undefined;
      const res = await dbUpdateICPurchaseAction(id, updates, branchSlug);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icPurchases: s.icPurchases.map(p => p.id === id ? res.data! : p),
        }));
        showToast('Purchase updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update purchase', 'error');
      return false;
    } catch {
      showToast('Error updating purchase', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const updateICSale = useTrackedCallback(async (
    id: string,
    updates: Partial<Omit<ICSale, 'id' | 'createdAt'>>,
  ) => {
    try {
      const res = await dbUpdateICSaleAction(id, updates);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icSales: s.icSales.map(sItem => sItem.id === id ? res.data! : sItem),
        }));
        showToast('Sale updated successfully');
        return true;
      }
      showToast(res.error || 'Failed to update sale', 'error');
      return false;
    } catch {
      showToast('Error updating sale', 'error');
      return false;
    }
  }, [showToast]);

  const resubmitICSale = useTrackedCallback(async (
    id: string,
    updates: import('@/lib/icTransfer/saleChanges').ICSaleContentFields,
    branchSlug?: string,
  ) => {
    try {
      const slug = branchSlug ?? (currentSlug !== 'superadmin' ? currentSlug : undefined);
      const res = await branchResubmitICSaleAction(id, updates, slug);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icSales: s.icSales.map(sItem => sItem.id === id ? res.data! : sItem),
        }));
        showToast('Order updated and resubmitted for admin review');
        return true;
      }
      showToast(res.error || 'Failed to resubmit order', 'error');
      return false;
    } catch {
      showToast('Error resubmitting order', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const branchDeleteICSale = useTrackedCallback(async (id: string, branchSlug?: string) => {
    try {
      const slug = branchSlug ?? (currentSlug !== 'superadmin' ? currentSlug : undefined);
      const res = await branchDeleteICSaleAction(id, slug);
      if (res.success) {
        setState(s => ({ ...s, icSales: s.icSales.filter(sItem => sItem.id !== id) }));
        showToast('Order deleted successfully');
        return true;
      }
      showToast(res.error || 'Failed to delete order', 'error');
      return false;
    } catch {
      showToast('Error deleting order', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const branchRequestCancelICSale = useTrackedCallback(async (id: string, branchSlug?: string) => {
    try {
      const slug = branchSlug ?? (currentSlug !== 'superadmin' ? currentSlug : undefined);
      const res = await branchRequestCancelICSaleAction(id, slug);
      if (res.success && res.data) {
        setState(s => ({
          ...s,
          icSales: s.icSales.map(sItem => sItem.id === id ? res.data! : sItem),
        }));
        showToast('Cancellation requested — awaiting admin review');
        return true;
      }
      showToast(res.error || 'Failed to request cancellation', 'error');
      return false;
    } catch {
      showToast('Error requesting cancellation', 'error');
      return false;
    }
  }, [showToast, currentSlug]);

  const deleteICPurchase = useTrackedCallback(async (id: string) => {
    try {
      const res = await dbDeleteICPurchaseAction(id);
      if (res.success) {
        setState(s => ({
          ...s,
          icPurchases: s.icPurchases.filter(p => p.id !== id),
        }));
        showToast('Purchase deleted successfully');
        void refetchData();
        return true;
      }
      showToast(res.error || 'Failed to delete purchase', 'error');
      return false;
    } catch {
      showToast('Error deleting purchase', 'error');
      return false;
    }
  }, [showToast, refetchData]);

  const deleteICSale = useTrackedCallback(async (id: string) => {
    try {
      const res = await dbDeleteICSaleAction(id);
      if (res.success) {
        setState(s => {
          const deleted = s.icSales.find(sale => sale.id === id);
          return {
            ...s,
            icSales: s.icSales.filter(sale => sale.id !== id),
            icWarehouses:
              deleted?.settlementMode === 'metal' && deleted.warehouseId
                ? s.icWarehouses.map(w => {
                    if (w.id !== deleted.warehouseId) return w;
                    const restoreG = deleted.metalWeightG || 0;
                    return {
                      ...w,
                      currentMetalG: (w.currentMetalG ?? 0) + restoreG,
                    };
                  })
                : s.icWarehouses,
          };
        });
        showToast('Sale deleted successfully');
        return true;
      }
      showToast(res.error || 'Failed to delete sale', 'error');
      return false;
    } catch {
      showToast('Error deleting sale', 'error');
      return false;
    }
  }, [showToast]);

  const contextValue = useMemo(() => {
    let filteredState = state;
    let filterBranchId: string | undefined;

    if (!state.isInitialLoading && state.user) {
      if (isBranchScopedUser(state.user) && state.user.branchId) {
        filterBranchId = state.user.branchId;
      } else if (state.user.role === 'admin' && currentSlug !== 'superadmin') {
        const matchingBranch = findBranchBySlug(state.branches, currentSlug);
        if (matchingBranch) {
          filterBranchId = matchingBranch.id;
        }
      }

      if (filterBranchId) {
        filteredState = {
          ...state,
          branches: state.branches.filter(b => b.id === filterBranchId),
        };
      }
    }

    const isBranchView = !!filterBranchId || isBranchScopedUser(filteredState.user);
    const isICTransferRoute = pathname.includes('/ic-transfer') && !pathname.includes('/ic-transfer-admin');
    const isICTransferBranchRoute = isICTransferRoute;
    const isWarehouseRoute = isWarehousePortalRoute(pathname);

    const navBranch = filteredState.user && isBranchPortalRole(filteredState.user.role) && filteredState.user.branchId
      ? filteredState.branches.find(b => b.id === filteredState.user!.branchId)
      : currentSlug !== 'superadmin'
        ? findBranchBySlug(filteredState.branches, currentSlug)
        : null;

    const visibleMainNavItems = getVisibleMainNavItems({
      currentSlug,
      user: filteredState.user,
      branch: navBranch,
    });
    const compactPortalHome = isWarehouseRoute
      ? (currentSlug && currentSlug !== 'superadmin' ? `/${currentSlug}/warehouse` : '/warehouse')
      : resolveCompactPortalHome(visibleMainNavItems, currentSlug, filteredState.user);

    const viewBranchSlug = resolveViewBranchSlug(pathname, currentSlug);

    return {
      ...filteredState,
      allBranches: state.globalBranches,
      isBranchView,
      isICTransferRoute,
      isICTransferBranchRoute,
      isWarehouseRoute,
      compactPortalHome,
      currentSlug,
      login,
      logout,
      showToast,
      refetchData,
      registerPageRefresh,
      refreshAppData,
      addICRegion,
      updateICRegion,
      deleteICRegion,
      addICSupplier,
      updateICSupplier,
      deleteICSupplier,
      addICWarehouse,
      updateICWarehouse,
      deleteICWarehouse,
      addICRateGroup,
      updateICRateGroup,
      bulkUpdateICRateGroupRates,
      updateICRateGroupPricing,
      deleteICRateGroup,
      setICRateGroupCustomers,
      setICRateGroupBranches,
      updateICTransferSalesEnabled,
      updateICTransferAutoRateReset,
      updateICTransferWarehouseFulfillment,
      addICPurchase,
      updateICPurchase,
      addICSale,
      updateICSale,
      resubmitICSale,
      branchDeleteICSale,
      branchRequestCancelICSale,
      deleteICPurchase,
      deleteICSale,
    };
  }, [
    state,
    pathname,
    currentSlug,
    login,
    logout,
    showToast,
    refetchData,
    registerPageRefresh,
    refreshAppData,
    addICRegion,
    updateICRegion,
    deleteICRegion,
    addICSupplier,
    updateICSupplier,
    deleteICSupplier,
    addICWarehouse,
    updateICWarehouse,
    deleteICWarehouse,
    addICRateGroup,
    updateICRateGroup,
    bulkUpdateICRateGroupRates,
    updateICRateGroupPricing,
    deleteICRateGroup,
    setICRateGroupCustomers,
    setICRateGroupBranches,
    updateICTransferSalesEnabled,
    updateICTransferAutoRateReset,
    updateICTransferWarehouseFulfillment,
    addICPurchase,
    updateICPurchase,
    addICSale,
    updateICSale,
    resubmitICSale,
    branchDeleteICSale,
    branchRequestCancelICSale,
    deleteICPurchase,
    deleteICSale,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
