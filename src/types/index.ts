// ═══════════════════════════════════════════════════════════
// HEDGE Capital Management — Type Definitions
// ═══════════════════════════════════════════════════════════

import type { ICSaleTransactionType } from '@/lib/icTransfer/transactionTypes';

export type UserRole = 'admin' | 'auditor' | 'staff' | 'delivery' | 'customer' | 'investor' | 'branch_manager' | 'collection_agent';

/** Per-page access for branch staff (none = hidden, read = view-only, write = full). */
export type PageAccessLevel = 'none' | 'read' | 'write';

export type PagePermissionMap = Partial<Record<string, PageAccessLevel>>;

/** Per-deal access for branch staff (read = view only, write = manage). */
export type DealAccessLevel = 'read' | 'write';

export type DealPermissionMap = Record<string, DealAccessLevel>;

export interface User {
  /** Supabase Auth user id. Present after sign-in. */
  id?: string;
  email: string;
  role: UserRole;
  name: string;
  branchId?: string;
  /** Loaded for staff — page-level permissions within their branch. */
  permissions?: PagePermissionMap;
  /** Loaded for staff — deal-level permissions (deal id → access level). */
  dealPermissions?: DealPermissionMap;
  /** Linked customers record — present for customer-role users after sign-in. */
  customerId?: string;
  /** Linked investors record — present for investor-role users after sign-in. */
  investorId?: string;
  /** IC warehouse scope for warehouse_* / delivery_* portal users. */
  warehouseId?: string;
}

export interface Branch {
  id: string;
  slug: string;
  name: string;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  trn?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  location: string;
  managerName: string;
  cashBalance: number;
  goldBalance: number;
  openingGoldBalance: number;
  currentBalance: number;
  openingBalance: number;
  closingBalance: number;
  dailyPL: number;
  status: 'active' | 'inactive';
  lastActivity: string; // ISO timestamp
  createdAt: string;
  /** IANA timezone for business-day boundaries (e.g. Asia/Dubai). */
  timezone: string;
  /** Page IDs hidden from this branch's portal (superadmin-controlled). */
  hiddenPages?: string[];
}

export type TransactionType = string;
export type TransactionStatus = 'completed' | 'pending' | 'failed';

export interface Entity {
  id: string;
  name: string;
  phone?: string;
  branchId?: string;
  createdAt?: string;
}

export interface TransactionTag {
  id: string;
  name: string;
  branchId?: string;
  createdAt?: string;
}

export interface Transaction {
  id: string;
  date: string;
  from: string;
  to: string;
  amount: number;
  type: TransactionType;
  assetType: 'currency' | 'gold';
  status: TransactionStatus;
  notes: string;
  category?: string;
  branchId?: string;
  businessDate?: string;
  /** Email of user who posted the entry. */
  enteredByUsername?: string;
  enteredByName?: string;
  tags?: string[];
  tagIds?: string[];
}

export type ExpenseType = 'capex' | 'opex';
export type ExpensePaymentMethod = 'AED' | 'USDT' | 'IDR';

export interface Expense {
  id: string;
  date: string;
  branchId: string;
  branchName: string;
  type: ExpenseType;
  category: string;
  description: string;
  amount: number;
  paymentMethod?: ExpensePaymentMethod;
}

export interface DailyReport {
  date: string;
  branchId: string;
  branchName: string;
  openingBalance: number;
  profit: number;
  expense: number;
  closingBalance: number;
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue';

export interface Customer {
  id: string;
  branchId: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  balance: number;
  status: 'active' | 'inactive' | string;
  country?: string;
  subdivision?: string;
  locality?: string;
  createdAt?: string;
  /** Supabase Auth user id when this customer has portal login credentials. */
  cognitoUserId?: string;
  /** Net fund-ledger position in USDT (positive = receivable, negative = payable). */
  netUsdt?: number;
}

/** Third-party recipient scoped to a portal customer — no login, used on IC Transfer orders. */
export interface ICSubCustomer {
  id: string;
  parentCustomerId: string;
  name: string;
  contact?: string;
  createdAt?: string;
  hasOrders?: boolean;
}

export interface Invoice {
  id: string;
  clientName: string;
  branchId: string;
  branchName: string;
  amount: number;
  description: string;
  date: string;
  status: InvoiceStatus;
}

export interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
  type: 'transfer' | 'report' | 'alert' | 'info';
}

export type PageId =
  | 'dashboard'
  | 'branches'
  | 'funds'
  | 'finance'
  | 'reports'
  | 'usdt'
  | 'deals'
  | 'investors'
  | 'physical';

export type DateRange = 'today' | 'weekly' | 'monthly';

export type InvestorStatus = 'active' | 'inactive' | 'pending';
export type InvestorRiskProfile = 'conservative' | 'balanced' | 'aggressive';
export type InvestorKycStatus = 'verified' | 'pending' | 'expired';

export interface InvestorDeposit {
  id: string;
  date: string;
  type: 'cash' | 'gold';
  amount: number;
  goldGrams?: number;
  notes?: string;
}

export interface Investor {
  id: string;
  name: string;
  email: string;
  phone: string;
  nationality: string;
  emiratesId?: string;
  passportNo?: string;
  address: string;
  city: string;
  country: string;
  cashDeposit: number;
  goldDeposit: number;
  goldWeightGrams: number;
  status: InvestorStatus;
  riskProfile: InvestorRiskProfile;
  kycStatus: InvestorKycStatus;
  joinedDate: string;
  lastActivity: string;
  assignedBranchId?: string;
  assignedBranchName?: string;
  isGlobal?: boolean; // True if the investor can be added to any branch's deals
  preferredContact: 'email' | 'phone' | 'whatsapp';
  notes?: string;
  depositHistory: InvestorDeposit[];
}

export type DealStatus = 'active' | 'pending' | 'completed' | 'cancelled';

export interface DealInvestor {
  investorId: string;
  investorName: string;
  amount: number;
  isGold: boolean; // True if the amount represents gold grams, false if AED cash
  goldVolume?: number; // Volume of gold in grams (up to 4 decimals)
}

export interface DealStaffAssignment {
  userId: string;
  userName: string;
  accessLevel: DealAccessLevel;
}

export interface Deal {
  id: string;
  name: string;
  groupName: string;
  groupType?: 'gold' | 'currency';
  amount: number;
  investors: DealInvestor[];
  totalInvestment: number;
  balance: number;
  managingBranchId?: string; // The branch that owns/originated the deal
  toBranchId?: string; // Legacy/Display
  toBranchName?: string;
  status: DealStatus;
  date: string;
  totalPL: number;
  expense: number;
  managerShare: number;
  goldVolume?: number;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  leadAddress?: string;
  staffAssignments?: DealStaffAssignment[];
  /** Investor portal — this investor's stake in the group. */
  myInvestmentAmount?: number;
  myIsGold?: boolean;
}

export interface DealTransactionExpense {
  id: string;
  dealTransactionId: string;
  key: string;           // Expense label, e.g. "Freight", "Insurance"
  value: number;         // Amount in AED
  timestamp?: string;    // Date & Time of expense
  createdAt?: string;
}

export interface DealTransactionBuy {
  id: string;
  dealTransactionId: string;
  txnId: string;
  date: string;
  time?: string;
  weight: number;
  purity?: number;
  pureCostAed: number;
  currencyAmount?: number;
  purchaseRate?: number;
  createdAt?: string;
}

export interface DealTransaction {
  id: string;
  date: string;
  time?: string;       // "HH:MM" 24h format, e.g. "14:30"
  deal: string; // Deal sequence number/name (e.g. '1', '2')
  weight: number;
  rate: number;
  pureCostAed: number;
  currencyAmount?: number;
  purchaseRate?: number;
  conversionRate?: number;
  avgPurity?: number;
  liveSellRate: number;        // Renamed from salesValueInr
  sellPremiumDiscount: number; // Renamed from rvRate
  salesAed: number;
  expenses: number;
  grossProfit: number;
  netProfitPerGram: number;    // Renamed from nPPerGr
  managementProfit: number;    // Renamed from mange
  fixOrUnfix: 'fixed' | 'unfixed' | string;
  marginDeposit: number;
  premiumDiscount: number;
  dealId?: string; // Foreign key linking to deals(id)
  /** Populated on list queries without loading full buy rows. */
  buyCount?: number;
  buys?: DealTransactionBuy[];
  payouts?: DealTransactionPayout[]; // Snapshot of investor payouts at settlement
  expensesDetails?: DealTransactionExpense[]; // Snapshot of detailed expenses
  /** Investor portal — this investor's payout on a settled deal txn. */
  myPayoutAmount?: number;
}

export interface DealTransactionPayout {
  id: string;
  dealTransactionId: string;
  investorId: string;
  investorName: string;
  payoutAmount: number;
  createdAt?: string;
}

export interface PhysicalBalance {
  branchId: string;
  initialCapital: number;
  initialVolume: number;
  availableFund: number;
  availableVolume: number;
  createdAt?: string;
  updatedAt?: string;
}

export type PhysicalPaymentMode = 'CASH' | 'BANK_TRANSFER' | 'USDT' | 'MULTI_CURRENCY';

export interface PhysicalBuy {
  id: string;
  branchId: string;
  date: string;
  particulars: string;
  grossWeight: number;
  pureConversion: number;
  pureGram: number;
  idrGram: number;
  idrToUsdt: number;
  idrRate: number;
  total: number;
  buyValue: number;
  remainingWeight: number;
  status: 'active' | 'closed';
  createdAt?: string;
  txnId?: string;
  customerId?: string;
  customerName?: string;
  openingBalance?: number;
  productId?: string;
  item?: string;
  notes?: string;
  purity?: number;
  touchLoss?: number;
  actualPurity?: number;
  marketUsd?: number;
  deal?: number;
  paymentMode?: PhysicalPaymentMode;
  idrAmount?: number;
  usdAmount?: number;
  aedAmount?: number;
  totalWeight?: number;
  tltIdrValue?: number;
  tltAedValue?: number;
  totalUsdt?: number;
  fixOrUnfix?: 'fixed' | 'unfixed';
}

export interface PhysicalSell {
  id: string;
  buyId: string;
  date: string;
  particulars?: string;
  grossWeight: number;
  pureConversion: number;
  pureGram: number;
  idrGram: number;
  idrToUsdt: number;
  idrRate: number;
  total: number;
  sellValue: number;
  profit: number;
  createdAt?: string;
  txnId?: string;
  customerId?: string;
  customerName?: string;
  openingBalance?: number;
  narration?: string;
  notes?: string;
  purity?: number;
  touchLoss?: number;
  actualPurity?: number;
  marketUsd?: number;
  deal?: number;
  paymentMode?: PhysicalPaymentMode;
  idrAmount?: number;
  usdAmount?: number;
  aedAmount?: number;
  totalWeight?: number;
  tltIdrValue?: number;
  tltAedValue?: number;
  totalUsdt?: number;
  costValue?: number;
  margin?: number;
  bulkSellId?: string;
}

export interface PhysicalBulkSell {
  id: string;
  branchId: string;
  date: string;
  particulars?: string;
  grossWeight: number;
  pureConversion: number;
  pureGram: number;
  idrGram: number;
  idrToUsdt: number;
  idrRate: number;
  total: number;
  sellValue: number;
  profit: number;
  createdAt?: string;
  txnId?: string;
  customerId?: string;
  customerName?: string;
  openingBalance?: number;
  narration?: string;
  notes?: string;
  paymentMode?: PhysicalPaymentMode;
  idrAmount?: number;
  usdAmount?: number;
  aedAmount?: number;
  totalWeight?: number;
  tltIdrValue?: number;
  tltAedValue?: number;
  totalUsdt?: number;
}

export interface UsdtBranchSettings {
  branchId: string;
  presetMargin: number;
  updatedAt?: string;
}

export interface UsdtBuy {
  id: string;
  branchId: string;
  date: string;
  txnId?: string;
  customerId?: string;
  customerName?: string;
  walletId?: string;
  openingBalance?: number;
  usdtAmount: number;
  aedRate: number;
  serviceCharge: number;
  aedTotal: number;
  notes?: string;
  enteredByUsername?: string;
  enteredByName?: string;
  enteredByUserId?: string;
  createdAt?: string;
}

export interface UsdtSell {
  id: string;
  branchId: string;
  date: string;
  txnId?: string;
  customerId?: string;
  customerName?: string;
  walletId?: string;
  openingBalance?: number;
  usdtAmount: number;
  cost: number;
  margin: number;
  aedRate: number;
  serviceCharge: number;
  aedTotal: number;
  profit: number;
  notes?: string;
  enteredByUsername?: string;
  enteredByName?: string;
  enteredByUserId?: string;
  createdAt?: string;
}

export interface UsdtIdrConversion {
  id: string;
  branchId: string;
  date: string;
  usdtAmount: number;
  conversionRate: number;
  idrAmount: number;
  enteredBy?: string;
  enteredByName?: string;
  enteredByUserId?: string;
  notes?: string;
  createdAt?: string;
}

export type FundEntryDirection = 'debit' | 'credit';
export type FundReferenceType =
  | 'manual'
  | 'settlement'
  | 'entity_transfer'
  | 'physical_buy'
  | 'physical_sell'
  | 'usdt_buy'
  | 'usdt_sell'
  | 'ic_sale'
  | 'ic_purchase';

export interface FundEntityBalance {
  customerId: string;
  customerName: string;
  /** USDT totals (base currency) */
  totalDebit: number;
  totalCredit: number;
  net: number;
  netUsdt?: number;
  /** Customer-profile currency equivalent of net */
  netCustomer?: number;
  customerCurrency?: string;
}

export interface FundEntityLedgerEntry {
  id: string;
  branchId: string;
  customerId: string;
  entryDate: string;
  description: string;
  /** Always USDT (base currency) */
  debit: number;
  credit: number;
  referenceType: FundReferenceType;
  referenceId?: string;
  /** Entity profile / display currency */
  customerCurrency?: string;
  /** 1 USDT = customerCurrencyRate × customerCurrency */
  customerCurrencyRate?: number;
  settlementCurrency?: string;
  /** Cash amount moved on branch balance (settlement rows) */
  settlementAmount?: number;
  createdBy?: string;
  createdByName?: string;
  createdByUserId?: string;
  createdAt: string;
}

export interface Ledger {
  id: string;
  branchId?: string; // null means global
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  isKpi: boolean;
  kpiInvert?: boolean;
  sortOrder?: number;
  createdAt?: string;
}

/** Frozen KPI values at day open/close (Transaction Beta). */
export interface DayKpiSnapshot {
  branchFund: number;
  gold: number;
  cashInLocker: number;
  ledgerBalances: Record<string, number>;
  totalVolume: number;
  transferCount: number;
  pendingCount: number;
}

export interface BranchDayClose {
  id: string;
  branchId: string;
  businessDate: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  closedBy?: string;
  opening: DayKpiSnapshot;
  closing?: DayKpiSnapshot;
}

export interface DailyCloseContext {
  workingDate: string;
  todayDate: string;
  yesterdayDate: string;
  yesterdayOpen: boolean;
  todayDue: boolean;
  isWorkingDayClosed: boolean;
}


// ═══════════════════════════════════════════════════════════
// IC Transfer Module
// ═══════════════════════════════════════════════════════════

export interface ICRegion {
  id: string;
  name: string;
  country: string;
  createdAt?: string;
}

export interface ICSupplier {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  commission?: number;
  regionId?: string;
  email?: string;
  address?: string;
  country?: string;
  subdivision?: string;
  locality?: string;
  /** When set, supplier is owned by a branch portal (exclusive to that branch). */
  branchId?: string;
  status?: 'active' | 'inactive';
  createdAt?: string;
}

export interface ICWarehouse {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  commission?: number;
  regionId?: string;
  email?: string;
  address?: string;
  indiaState?: string;
  indiaCity?: string;
  currentStock?: number;
  /** Physical metal on hand (grams). Separate from IC unit stock. */
  currentMetalG?: number;
  /** When set, warehouse is owned by a branch portal (exclusive to that branch). */
  branchId?: string;
  /** When true, delivery proof goes straight to customer on agent completion. */
  sendDeliveryProofToCustomer?: boolean;
  createdAt?: string;
}

export type ICRateSlabTier = {
  minUnits: number;
  /** null = unlimited (open-ended top tier) */
  maxUnits: number | null;
  saleRate: number;
  conversionRate: number;
};

export type ICRateTransactionPricing = {
  mode: 'flat' | 'slab';
  saleRate?: number;
  conversionRate?: number;
  slabs?: ICRateSlabTier[];
};

export type ICRateGroupPricingConfig = {
  /** Same flat rate for all types (default) or per transaction type. */
  scope: 'all_types' | 'per_type';
  /** Flat or volume-based slabs. */
  kind: 'flat' | 'slab';
  /** When scope=all_types and kind=slab. */
  common?: ICRateTransactionPricing;
  /** When scope=per_type. */
  byTransactionType?: Partial<
    Record<ICSaleTransactionType, ICRateTransactionPricing>
  >;
};

export interface ICRateGroup {
  id: string;
  name: string;
  country: string;
  saleRate: number;
  customerIds?: string[];
  branchIds?: string[];
  pricingConfig?: ICRateGroupPricingConfig;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICTransferSettings {
  salesEnabled: boolean;
  autoRateResetEnabled: boolean;
  /** When true, sales go through warehouse / delivery workflow; when false, sales complete on create. */
  warehouseFulfillmentEnabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ICPurchase {
  id: string;
  /** Unified trading partner (same id on sales). */
  counterpartyId?: string;
  supplierId?: string;
  locationId?: string;
  warehouseId?: string;
  settlementMode?: 'cash' | 'metal';
  unitRate: number;
  units: number;
  metalWeightG?: number | null;
  metalRateInrPerG?: number | null;
  metalRateAedPerG?: number | null;
  inrTotal?: number | null;
  paymentMethod?: string;
  notes?: string;
  convertedTotal?: number;
  aedTotal?: number;
  paymentStatus?: 'pending' | 'paid';
  createdAt?: string;
}

export type ICOrderStatus =
  | 'pending'
  | 'accepted'
  | 'admin_rejected'
  | 'wh_rejected'
  | 'wh_processing'
  | 'da_rejected'
  | 'delivery_pending_admin'
  | 'cancellation_pending'
  | 'cancelled'
  | 'completed'
  | 'unknown';

export interface ICSale {
  id: string;
  /** Owning branch name — used for branch association/filtering. */
  customerName: string;
  /** End-customer chosen by the branch manager (falls back to customerName when absent). */
  orderCustomerName?: string;
  orderCustomerId?: string;
  /** Unified trading partner (same id on purchases). */
  counterpartyId?: string;
  /** Portal customer's third-party recipient (customer portal only). */
  subCustomerId?: string;
  subCustomerName?: string;
  warehouseId?: string;
  settlementMode?: 'cash' | 'metal';
  transactionType?: ICSaleTransactionType;
  units: number;
  unitRate: number;
  metalWeightG?: number | null;
  metalRateInrPerG?: number | null;
  metalRateAedPerG?: number | null;
  inrTotal?: number | null;
  /** Metal sale: which purchase lot this sale closes (partial sells later). */
  metalPurchaseId?: string | null;
  metalPaymentMethod?: 'INR' | 'AED' | null;
  aedAmount?: number;
  enteredBy?: string;
  enteredByName?: string;
  enteredByUserId?: string;
  paymentStatus?: 'pending' | 'paid' | 'partial';
  orderStatus?: ICOrderStatus;
  rejectionRemarks?: string;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
  address?: string;
  location?: string;
  district?: string;
  imageUrl?: string;
  serviceCharge?: number;
  bank?: string;
  deliveryAgentId?: string;
  deliveryAgentName?: string;
  collectedUnits?: number;
  derivedFromSaleId?: string;
  priority?: 'High' | 'Normal' | 'Low';
  fulfillmentHandler?: 'hq_admin';
  deliveryImageUrl?: string;
  createdAt?: string;
}

export interface ICWarehouseTransaction {
  id: string;
  warehouseId: string;
  transactionType: string;
  units: number;
  referenceType?: string;
  referenceId?: string;
  createdAt?: string;
}

export type ICFundAccountType =
  | 'bank'
  | 'personal'
  | 'income'
  | 'profit'
  | 'expense'
  | 'd_expense';
export type ICFundAccountStatus = 'active' | 'inactive';
export type ICFundVoucherType = 'payment' | 'receipt' | 'journal' | 'contra';
export type ICFundVoucherStatus = 'active' | 'pending' | 'void';

export interface ICFundAccount {
  id: string;
  branchId: string;
  branchName?: string;
  branchSlug?: string;
  name: string;
  accountType: ICFundAccountType;
  status: ICFundAccountStatus;
  openingBalance: number;
  notes: string;
  createdAt: string;
  balance: number;
  pendingBalance?: number;
  customerId?: string;
  email?: string;
  phone?: string;
  hasPortalLogin?: boolean;
  sourceType?: string;
  sourceId?: string;
}

export interface ICFundVoucher {
  id: string;
  branchId: string;
  voucherNo: number;
  voucherType: ICFundVoucherType;
  voucherDate: string;
  debitAccountId: string;
  creditAccountId: string;
  debitAccountName: string;
  creditAccountName: string;
  debitAccountType: ICFundAccountType;
  creditAccountType: ICFundAccountType;
  amount: number;
  notes: string;
  createdBy?: string;
  createdByName?: string;
  createdByUserId?: string;
  createdAt: string;
  status: ICFundVoucherStatus;
  voidedAt?: string;
  voidedByName?: string;
  referenceType?: string;
  referenceId?: string;
}

export interface ICFundTrialBalanceLine {
  accountId: string;
  accountName: string;
  accountType: ICFundAccountType;
  /** Closing debit (posted) */
  debit: number;
  /** Closing credit (posted) */
  credit: number;
  pendingDebit?: number;
  pendingCredit?: number;
  openingDebit?: number;
  openingCredit?: number;
  periodDebit?: number;
  periodCredit?: number;
  closingDebit?: number;
  closingCredit?: number;
}

export interface ICFundStatementLine {
  date: string;
  voucherNo: number;
  voucherType: ICFundVoucherType;
  particulars: string;
  /** Counterparty IC Funds account for voucher lines (enables statement links). */
  counterpartyAccountId?: string;
  debit: number;
  credit: number;
  balance: number;
  notes: string;
  userName?: string;
  userAt?: string;
  status?: ICFundVoucherStatus;
  referenceType?: string;
  referenceId?: string;
  /** Foreign currency units per 1 AED (sale-time rate when known). */
  fxRate?: number | null;
  /** Exact foreign debit when ledger AED ≠ customer-currency amount (e.g. sale converted_amount). */
  foreignDebit?: number | null;
  /** Exact foreign credit when ledger AED ≠ customer-currency amount (e.g. wallet paid_foreign). */
  foreignCredit?: number | null;
  /** Margin / COGS lines hidden from customer-facing export. */
  internalOnly?: boolean;
}
