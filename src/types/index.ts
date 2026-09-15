
export interface ProductOption {
  id: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: ProductOption[];
}

export interface StockLayer {
  id: string;
  purchaseBillId: string;
  purchaseDate: string;
  initialQuantity: number;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  storeId?: string;
}

export interface ProductSKU {
  id: string;
  optionValues: Record<string, string>;
  skuIdentifier?: string;
  stockLayers: StockLayer[];
}

export interface AdditionalChargeDefinition {
  id: string;
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  trackQuantity: boolean;
  unit?: string | null;
  sku?: string;
  hsnCode?: string;
  expiryDate?: string;
  imageUrl?: string | null;
  description?: string;
  variants?: ProductVariant[];
  productSKUs: ProductSKU[];
  companyId: string;
  sgstRate?: number;
  cgstRate?: number;
  igstRate?: number;
  additionalChargeDefinitions?: AdditionalChargeDefinition[];
  isArchived?: boolean;
}

export type BillMode = 'buy' | 'sell' | 'return';

export interface BillItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  costPrice: number;
  sellPrice: number;
  isDefective?: boolean;
  selectedVariantOptions?: Record<string, string>;
  sgstAmount?: number;
  cgstAmount?: number;
  igstAmount?: number;
  discountValue?: number;
  discountType?: 'amount' | 'percentage';
  discountAmount?: number;
  isAdditionalCharge?: boolean;
  sourceChargeDefinitionId?: string;
}

export interface Bill {
  id: string;
  invoiceNumber?: string; // Human readable invoice number (e.g., FY24-25/001)
  type: BillMode;
  date: string;
  timestamp: number;
  vendorOrCustomerName?: string;
  customerPhone?: string;
  items: BillItem[];
  subTotal?: number;
  totalSGST?: number;
  totalCGST?: number;
  totalIGST?: number;
  totalDiscount?: number;
  taxType?: 'intra-state' | 'inter-state';
  gstin?: string;
  placeOfSupply?: string;
  billingAddress?: string;
  shippingAddress?: string;
  totalAmount: number;
  isEstimate?: boolean;
  notes?: string;
  paymentStatus?: 'paid' | 'unpaid';
  billedByStaffId?: string;
  billedByStaffName?: string;
  storeId?: string;
  storeName?: string;
  companyId: string;
}

export interface Category {
  id: string;
  name: string;
  companyId: string;
}

export type SubscriptionType = 'monthly' | 'yearly';
export type PaymentStatus = 'pending' | 'paid';

export type ManualEntryType = 'income' | 'expense' | 'opening_balance';

export interface ManualEntry {
  id: string;
  companyId: string;
  storeId?: string | null;
  date: string; // ISO date (YYYY-MM-DD)
  entryType: ManualEntryType;
  category?: string;
  amount: number;
  note?: string;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  token: string;
  activeSubscriptionId: string;
  logoUrl?: string | null;
  slogan?: string;
  phone?: string;
  address?: string;
  gstNo?: string;
  defaultBillNotes?: string;
  defaultSalesPaymentStatus?: 'paid' | 'unpaid';
  defaultPurchasePaymentStatus?: 'paid' | 'unpaid';
  currency?: string;
  subscriptionType?: SubscriptionType;
  paymentStatus?: PaymentStatus;
  creationDate?: string;
  subscriptionStartDate?: string | null;
  subscriptionExpiryDate?: string | null;
  pendingSubscriptionId?: string | null;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email?: string;
  employeeId?: string;
  password?: string;
  role: 'admin' | 'employee';
  assignedStoreIds?: string[];
  phone?: string;
}

export interface Store {
  id: string;
  companyId: string;
  name: string;
  username: string; // Unique username for login
  location: string;
  phone: string;
  email: string;
  accessCode: string;
  passkey: string;
  allowedStaffIds: string[];
  allowedOperations: BillMode[];
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  priceSuffix: string;
  features: string[];
  maxStores: number;
  maxEmployees: number;
  isPopular?: boolean;
}

export interface UserProfile {
  companyName: string;
  companyLogoUrl?: string | null;
  companySlogan?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyGstNo?: string;
  activeSubscriptionId: string;
  dataMode: 'local' | 'global';
  defaultBillNotes?: string;
  defaultSalesPaymentStatus?: 'paid' | 'unpaid';
  defaultPurchasePaymentStatus?: 'paid' | 'unpaid';
  companyCurrency?: string;
  paymentStatus?: PaymentStatus;
  subscriptionExpiryDate?: string | null;
  pendingSubscriptionId?: string | null;
}

export interface ChatMessage {
  id: string;
  storeId: string;
  companyId: string;
  senderId: 'admin' | string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
}

export interface TodaysFinancialSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  transactionsToday: number;
  defectivesToday: number;
}

export interface ProductLedgerEntry {
  productId: string;
  productName: string;
  category?: string;
  totalPurchased: number;
  totalSold: number;
  totalRestockedReturns: number;
  totalDefectiveReturns: number;
  currentStock: number | 'N/A';
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

// Payload for pending bills (before saving)
export interface PendingBillPayload {
  billType: BillMode;
  items: BillItem[];
  vendorOrCustomerName?: string;
  customerPhone?: string;
  notes?: string;
  isEstimate?: boolean;
  taxType?: 'intra-state' | 'inter-state';
  date?: string;
  storeIdForBill?: string;
  paymentStatus?: 'paid' | 'unpaid';
  gstin?: string; // Added for GST compliance
  placeOfSupply?: string; // Added for GST compliance
  billingAddress?: string; // Added for GST compliance
  shippingAddress?: string; // Added for GST compliance
  skipStockProductIds?: string[]; // Product IDs whose stock layers should not be created (used when product was just created)
}

export interface Customer {
  id: string;
  companyId: string;
  name?: string;
  phone?: string;
  gstin?: string;
  billingAddress?: string;
  shippingAddress?: string;
  placeOfSupply?: string;
  email?: string;
  address?: string;
  firstSeen: string;
  lastSeen: string;
}

export interface DateRangeReportSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  totalBills: number;
  totalItemsSold: number;
  totalSGST: number;
  totalCGST: number;
  totalTax: number;
  totalAdditionalCharges: number;
}

export interface ProductAnalytics {
  totalPurchased: number;
  totalSold: number;
  totalReturned: number;
  totalRevenue: number;
  totalCostOfGoodsSold: number;
  grossProfit: number;
  averageSellPrice: number | null;
  averageCostPrice: number | null;
}

export interface AccountsReceivableSummary {
  totalReceivable: number;
  unpaidInvoices: Bill[];
}

export interface AccountsPayableSummary {
  totalPayable: number;
  unpaidBills: Bill[];
}

export interface MonthlyProductFinancials {
  month: string;
  revenue: number;
  cogs: number;
  profit: number;
}

export interface ExpenseBillWithCoverage extends Bill {
  totalCost: number;
  potentialRevenue: number;
  coverageStatus: 'Covered' | 'Uncovered';
}

export interface ExpenseSummary {
  totalCoveredExpenseValue: number;
  totalUncoveredExpenseValue: number;
  totalPotentialProfitOnCoveredExpenses: number;
  totalOutstandingCostOnUncoveredExpenses: number;
  coveredBillCount: number;
  uncoveredBillCount: number;
}

export interface CashFlowSummary {
  cashInflows: number;
  cashOutflows: number;
  netCashFlow: number;
}

export interface BalanceSheetSummary {
  inventoryValue: number;
  accountsReceivable: number;
  accountsPayable: number;
  retainedEarnings: number;
}

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ProductRevenueData {
  name: string;
  revenue: number;
  quantity: number;
  cogs?: number;
  profit?: number;
}

// Ensure Staff type is defined for clarity, although it's a subset of User
export type Staff = User & { role: 'employee' };
