
"use client";

import { create } from 'zustand';
import { persist, createJSONStorage, type PersistOptions } from 'zustand/middleware';
import type { Product, Bill, BillItem, Category, User, Store, UserProfile, SubscriptionPlan, ProductSKU, ProductVariant, ChatMessage, Company, Customer, DateRangeReportSummary, ProductAnalytics, AccountsReceivableSummary, AccountsPayableSummary, MonthlyProductFinancials, CashFlowSummary, BalanceSheetSummary, TimePeriod, ProductRevenueData, Staff, FinancialSummary, TodaysFinancialSummary, ProductLedgerEntry, StockLayer, BillMode, ManualEntry } from '@/types';
import { getDailyLedgers, type DailyLedger } from '@/lib/ledger';
import { v4 as uuidv4 } from 'uuid';
import { format, subDays, startOfDay, endOfDay, isToday, isThisWeek, isThisMonth, isThisYear, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { DEFAULT_CATEGORIES, SUBSCRIPTION_PLANS, SUBSCRIPTION_PLAN_IDS, DEFAULT_COMPANY_NAME, DEFAULT_CURRENCY_CODE, LOW_STOCK_THRESHOLD } from '@/lib/constants';
import { roundMoney, roundQuantity } from '@/lib/units';
import { toast } from './use-toast';

// Re-export types for convenience in other files
export type { Product, Bill, BillItem, Category, User, Store, UserProfile, SubscriptionPlan, ProductSKU, BillMode, ChatMessage, StockLayer, ProductOption, FinancialSummary, TodaysFinancialSummary, ProductLedgerEntry, Company, Customer, DateRangeReportSummary, ProductAnalytics, AccountsReceivableSummary, AccountsPayableSummary, MonthlyProductFinancials, CashFlowSummary, BalanceSheetSummary, TimePeriod, ProductRevenueData, Staff, ManualEntry } from '@/types';
export type { DailyLedger } from '@/lib/ledger';


// #region Types and Interfaces
interface ExpenseBillWithCoverage extends Bill {
  totalCost: number;
  potentialRevenue: number;
  coverageStatus: 'Covered' | 'Uncovered';
}

interface ExpenseSummary {
  totalCoveredExpenseValue: number;
  totalUncoveredExpenseValue: number;
  totalPotentialProfitOnCoveredExpenses: number;
  totalOutstandingCostOnUncoveredExpenses: number;
  coveredBillCount: number;
  uncoveredBillCount: number;
}

interface InventoryState {
  // Core Data Stores
  products: Product[];
  bills: Bill[];
  categories: Category[];
  customers: Customer[];
  staffs: User[];
  stores: Store[];
  userProfile: UserProfile;
  messagesByStore: Record<string, ChatMessage[]>;

  // Manual Accounting Entries (additional income / expenses / opening balances)
  manualEntries: ManualEntry[];

  // Manual Entry Actions
  fetchManualEntries: (companyId: string) => Promise<void>;
  addManualEntry: (entryData: Omit<ManualEntry, 'id' | 'companyId' | 'createdAt'>, companyId: string) => Promise<ManualEntry | null>;
  updateManualEntry: (entryId: string, entryData: Partial<Omit<ManualEntry, 'id' | 'companyId' | 'createdAt'>>, companyId: string) => Promise<ManualEntry | null>;
  deleteManualEntry: (entryId: string, companyId: string) => Promise<boolean>;

  // Product Actions
  fetchProducts: (companyId: string) => Promise<void>;
  addProduct: (productData: Omit<Product, 'id' | 'imageUrl' | 'productSKUs' | 'companyId'> & { costPriceForNonTracked?: number, sellPriceForNonTracked?: number }, companyId: string) => Promise<Product | null>;
  updateProduct: (productId: string, productData: Partial<Omit<Product, 'id' | 'imageUrl' | 'productSKUs' | 'companyId'>> & { costPriceForNonTracked?: number, sellPriceForNonTracked?: number }, companyId: string) => Promise<Product | null>;
  archiveProduct: (productId: string, companyId: string) => Promise<boolean>;
  unarchiveProduct: (productId: string, companyId: string) => Promise<boolean>;

  // Draft Bill Actions
  draftBill: {
    mode: BillMode;
    items: BillItem[];
    customerName: string;
    customerPhone: string;
    notes: string;
    isEstimate: boolean;
    taxType: 'intra-state' | 'inter-state';
  } | null;
  setDraftBill: (draft: InventoryState['draftBill']) => void;
  clearDraftBill: () => void;

  // Bill Actions
  fetchBills: (companyId: string) => Promise<void>;
  addBill: (billData: any, itemsData: any) => Promise<Bill | null>;
  deleteBill: (billId: string, companyId: string) => Promise<boolean>;
  updateBillNonCriticalDetails: (billId: string, details: { paymentStatus?: Bill['paymentStatus'], notes?: string }, companyId: string) => Promise<Bill | null>;

  // Category Actions
  fetchCategories: (companyId: string) => Promise<void>;
  addCategory: (categoryName: string, companyId: string) => Promise<Category | null>;

  // Customer Actions
  fetchCustomers: (companyId: string) => Promise<void>;

  // Staff Actions
  fetchStaff: (companyId: string) => Promise<void>;
  addStaff: (staffData: Omit<User, 'id' | 'role' | 'companyId' | 'password'> & { password: string }, companyId: string) => Promise<User | null>;
  updateStaff: (staffId: string, staffData: Partial<Omit<User, 'id' | 'role' | 'companyId'>>, companyId: string) => Promise<User | null>;
  deleteStaff: (staffId: string, companyId: string) => Promise<boolean>;

  // Store Actions
  fetchStores: (companyId: string) => Promise<void>;
  addStore: (storeData: Omit<Store, 'id' | 'companyId'>, companyId: string) => Promise<Store | null>;
  updateStore: (storeId: string, storeData: Partial<Omit<Store, 'id' | 'companyId'>>, companyId: string) => Promise<Store | null>;
  deleteStore: (storeId: string, companyId: string) => Promise<boolean>;

  // Company Profile Actions
  fetchCompanyProfile: (companyId: string) => Promise<Company | null>;
  updateUserProfileFields: (data: Partial<Omit<Company, 'id' | 'token'>>, companyId: string) => Promise<Company | null>;

  // Chat Actions
  fetchMessagesForStore: (storeId: string, companyId: string) => Promise<void>;
  addChatMessage: (storeId: string, senderId: 'admin' | string, senderName: string, text: string, companyId: string) => Promise<void>;
  clearChatForStore: (storeId: string, companyId: string) => Promise<boolean>;

  // Simple Getters (Client-side helpers)
  getProductById: (productId: string) => Product | undefined;
  getBillById: (billId: string) => Bill | undefined;
  getStoreById: (storeId: string) => Store | undefined;
  getStaffById: (staffId: string) => User | undefined;
  getCustomerById: (customerId: string) => Customer | undefined;
  getAllStores: () => Store[];
  getAllStaff: () => User[];
  getAllCustomers: (companyId?: string) => Customer[];
  getSkuIdentifier: (productName: string, optionValues: Record<string, string>) => string;
  getSkuDetails: (sku: ProductSKU | undefined, targetStoreId?: string) => { totalStock: number | null; currentSellPrice: number | null; averageCostPrice: number | null; skuIdentifier?: string; };
  findOrCreateProductSKU: (productId: string, optionValues: Record<string, string>) => ProductSKU | undefined;
  searchProducts: (searchTerm: string) => Product[];
  searchCategories: (searchTerm: string) => string[];
  getMessagesForStore: (storeId: string) => ChatMessage[];
  getStaffDetailsByIds: (staffIds: string[]) => User[];

  // Subscription & Permission Getters
  getActiveSubscriptionPlan: () => SubscriptionPlan | undefined;
  canAddStore: () => boolean;
  canAddStaff: () => boolean;

  // Analytics & Reporting Getters (Client-side calculations)
  getLowStockProductCount: (threshold: number, companyId?: string) => number;
  getRecentBills: (limit: number, companyId?: string) => Bill[];
  getBillsForProduct: (productId: string) => Bill[];
  getDailySalesAndExpenses: (period: TimePeriod, companyId?: string) => Array<{ date: string; sales: number; expenses: number }>;
  getTopSellingProductsByRevenue: (limit: number, period: TimePeriod, companyId?: string) => Array<{ name: string; revenue: number; quantity: number; }>;
  getRecentExpenseBillsWithPotentialCoverage: (limit: number, companyId?: string) => ExpenseBillWithCoverage[];
  getExpenseSummaryStats: (companyId?: string) => ExpenseSummary;
  getOverallFinancialSummary: (period: TimePeriod, companyId?: string) => FinancialSummary;
  getPeriodFinancialSummary: (period: TimePeriod, companyId?: string) => TodaysFinancialSummary;
  getTopProfitableProducts: (limit: number, period: TimePeriod, companyId?: string) => ProductRevenueData[];
  getProductAnalytics: (productId: string) => ProductAnalytics;
  getProductLedgerSummary: (params: { companyId?: string, startDate?: Date, endDate?: Date }) => ProductLedgerEntry[];
  getProductFinancialsByMonth: (productId: string) => MonthlyProductFinancials[];
  getReportSummaryByDateRange: (startDate?: Date, endDate?: Date, companyId?: string, storeId?: string) => DateRangeReportSummary;
  getSalesBillsByDateRange: (startDate?: Date, endDate?: Date, companyId?: string) => Bill[];
  getExpenseBillsByDateRange: (startDate?: Date, endDate?: Date, companyId?: string) => Bill[];
  getAccountsReceivableSummary: (companyId?: string, storeId?: string) => AccountsReceivableSummary;
  getAccountsPayableSummary: (companyId?: string, storeId?: string) => AccountsPayableSummary;
  getCashFlowSummaryByDateRange: (startDate?: Date, endDate?: Date, companyId?: string, storeId?: string) => CashFlowSummary;
  getDailyLedger: (date: Date | string, companyId?: string, storeId?: string) => DailyLedger | undefined;
  getDailyLedgersByDateRange: (startDate?: Date | string, endDate?: Date | string, companyId?: string, storeId?: string) => DailyLedger[];
  getBalanceSheetSummary: (companyId?: string, storeId?: string) => BalanceSheetSummary;
}

const defaultUserProfile: UserProfile = {
  companyName: DEFAULT_COMPANY_NAME, companyLogoUrl: '', companySlogan: '', companyPhone: '', companyAddress: '', companyGstNo: '',
  activeSubscriptionId: SUBSCRIPTION_PLAN_IDS.STARTER,
  defaultBillNotes: 'Thank you for your business!',
  defaultSalesPaymentStatus: 'paid', defaultPurchasePaymentStatus: 'paid',
  companyCurrency: DEFAULT_CURRENCY_CODE,
  dataMode: 'local',
  paymentStatus: 'pending',
  subscriptionExpiryDate: null,
};

const storeInitialState = {
  products: [],
  bills: [],
  categories: [],
  customers: [],
  staffs: [],
  stores: [],
  userProfile: { ...defaultUserProfile },
  messagesByStore: {},
  draftBill: null,
  manualEntries: [],
};
// #endregion

const LOCAL_COMPANY_ID = 'comp_local_default';
const LOCAL_STORE_ID = 'store_local_main';
const LOCAL_ADMIN_ID = 'user_local_admin';
const isLocalCompany = (companyId?: string | null) => companyId === LOCAL_COMPANY_ID || companyId?.startsWith('comp_local_');

const createLocalCompany = (profile: UserProfile): Company => ({
  id: LOCAL_COMPANY_ID,
  name: profile.companyName || DEFAULT_COMPANY_NAME,
  token: 'LOCAL_ONLY_TOKEN',
  activeSubscriptionId: profile.activeSubscriptionId || SUBSCRIPTION_PLAN_IDS.PRO,
  logoUrl: profile.companyLogoUrl || '',
  slogan: profile.companySlogan || '',
  phone: profile.companyPhone || '',
  address: profile.companyAddress || '',
  gstNo: profile.companyGstNo || '',
  defaultBillNotes: profile.defaultBillNotes,
  defaultSalesPaymentStatus: profile.defaultSalesPaymentStatus,
  defaultPurchasePaymentStatus: profile.defaultPurchasePaymentStatus,
  currency: profile.companyCurrency || DEFAULT_CURRENCY_CODE,
  subscriptionType: 'monthly',
  paymentStatus: 'paid',
  creationDate: new Date().toISOString(),
  subscriptionStartDate: new Date().toISOString(),
  subscriptionExpiryDate: null,
});

const createLocalStore = (): Store => ({
  id: LOCAL_STORE_ID,
  companyId: LOCAL_COMPANY_ID,
  name: 'Main Store',
  username: 'local-main-store',
  location: 'Local',
  phone: '0000000000',
  email: 'local-store@ecbills.in',
  accessCode: 'LOCAL',
  passkey: '123456',
  allowedStaffIds: [],
  allowedOperations: ['buy', 'sell', 'return'],
});

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      ...storeInitialState,

      // #region API-Driven Actions
      // --- Product Actions ---
      fetchProducts: async (companyId) => {
        if (!companyId) return console.warn("fetchProducts: companyId is required");
        if (isLocalCompany(companyId)) {
          set((state) => ({ products: state.products.filter(product => product.companyId === companyId) }));
          return;
        }
        try {
          const response = await fetch(`/api/products?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch products: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) set({ products: result.data || [] });
          else { console.error("Failed to fetch products or data format incorrect:", result.message); }
        } catch (error) {
          console.error("Error in fetchProducts:", error);
        }
      },
      addProduct: async (productData, companyId) => {
        if (isLocalCompany(companyId)) {
          const now = new Date();
          const newProductId = uuidv4();
          const newProduct: Product = {
            ...(productData as any),
            id: newProductId,
            companyId,
            imageUrl: (productData as any).imageUrl || null,
            productSKUs: [],
          };

          const makeLayer = (quantity: number, costPrice: number, sellPrice: number): StockLayer[] => {
            if (!newProduct.trackQuantity || quantity <= 0) return [];
            return [{
              id: uuidv4(),
              purchaseBillId: `LOCAL_INIT_${newProductId.slice(0, 8)}`,
              purchaseDate: now.toISOString(),
              initialQuantity: quantity,
              quantity,
              costPrice,
              sellPrice,
              storeId: LOCAL_STORE_ID,
            }];
          };

          if (!newProduct.variants || newProduct.variants.length === 0) {
            const initialStock = Number((productData as any).initialStock || 0);
            const costPrice = Number((productData as any).costPrice || (productData as any).costPriceForNonTracked || 0);
            const sellPrice = Number((productData as any).sellPrice || (productData as any).sellPriceForNonTracked || 0);
            newProduct.productSKUs = [{
              id: uuidv4(),
              optionValues: {},
              skuIdentifier: newProduct.name,
              stockLayers: makeLayer(initialStock, costPrice, sellPrice),
            }];
          } else {
            const buildCombinations = (variants: ProductVariant[]): Array<{ optionValues: Record<string, string>; option: any }> => {
              if (variants.length === 0) return [{ optionValues: {}, option: {} }];
              const [first, ...rest] = variants;
              const restCombinations = buildCombinations(rest);
              return first.options.flatMap((option: any) =>
                restCombinations.map((combo) => ({
                  optionValues: { [first.name]: option.value, ...combo.optionValues },
                  option: { ...combo.option, ...option },
                }))
              );
            };

            newProduct.productSKUs = buildCombinations(newProduct.variants).map(({ optionValues, option }) => {
              const costPrice = Number(option.costPrice ?? (productData as any).costPrice ?? 0);
              const sellPrice = Number(option.sellPrice ?? (productData as any).sellPrice ?? 0);
              const initialStock = Number(option.initialStock ?? 0);
              return {
                id: uuidv4(),
                optionValues,
                skuIdentifier: `${newProduct.name} (${Object.values(optionValues).join(' - ')})`,
                stockLayers: makeLayer(initialStock, costPrice, sellPrice),
              };
            });
          }

          set((state) => ({
            products: [...state.products.filter(product => product.companyId !== companyId || product.id !== newProduct.id), newProduct],
            categories: productData.category && !state.categories.some(category => category.companyId === companyId && category.name.toLowerCase() === productData.category?.toLowerCase())
              ? [...state.categories, { id: uuidv4(), name: productData.category, companyId }]
              : state.categories,
          }));
          return newProduct;
        }

        try {
          const response = await fetch('/api/products', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productData, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set((state) => ({ products: [...state.products, result.data] }));
          if (productData.category) get().fetchCategories(companyId);
          return result.data;
        } catch (error) {
          console.error("Error adding product:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not add product.` });
          return null;
        }
      },
      updateProduct: async (productId, productData, companyId) => {
        if (isLocalCompany(companyId)) {
          let updatedProduct: Product | null = null;
          set((state) => ({
            products: state.products.map(product => {
              if (product.id !== productId || product.companyId !== companyId) return product;
              const next: Product = { ...product, ...(productData as any), id: product.id, companyId: product.companyId };
              updatedProduct = next;
              return next;
            }),
          }));
          return updatedProduct;
        }

        try {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productData, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set((state) => ({ products: state.products.map(p => p.id === productId ? result.data : p) }));
          if (productData.category) get().fetchCategories(companyId);
          return result.data;
        } catch (error) {
          console.error("Error updating product:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not update product.` });
          return null;
        }
      },
      archiveProduct: async (productId, companyId) => {
        if (isLocalCompany(companyId)) {
          set((state) => ({ products: state.products.map(product => product.id === productId && product.companyId === companyId ? { ...product, isArchived: true } : product) }));
          return true;
        }

        try {
          const response = await fetch(`/api/products/${productId}?companyId=${companyId}`, { method: 'DELETE' });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set((state) => ({ products: state.products.map(p => p.id === productId ? { ...p, isArchived: true } : p) }));
          return true;
        } catch (error) {
          console.error("Error archiving product:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not archive product.` });
          return false;
        }
      },
      unarchiveProduct: async (productId, companyId) => {
        if (isLocalCompany(companyId)) {
          set((state) => ({ products: state.products.map(product => product.id === productId && product.companyId === companyId ? { ...product, isArchived: false } : product) }));
          return true;
        }

        try {
          const response = await fetch(`/api/products/${productId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productData: { isArchived: false }, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set((state) => ({ products: state.products.map(p => p.id === productId ? result.data : p) }));
          return true;
        } catch (error) {
          console.error("Error unarchiving product:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not unarchive product.` });
          return false;
        }
      },
      // Draft Bill Actions
      setDraftBill: (draft) => set({ draftBill: draft }),
      clearDraftBill: () => set({ draftBill: null }),

      // --- Bill Actions ---
      fetchBills: async (companyId) => {
        if (!companyId) return console.warn("fetchBills: companyId is required");
        if (isLocalCompany(companyId)) {
          set((state) => ({ bills: state.bills.filter(bill => bill.companyId === companyId).sort((a, b) => b.timestamp - a.timestamp) }));
          return;
        }

        try {
          const response = await fetch(`/api/bills?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch bills: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            const serverBills = result.data as Bill[];
            const serverIds = new Set(serverBills.map(b => b.id));
            const localOnly = get().bills.filter(b => b.companyId === companyId && !serverIds.has(b.id));
            set({ bills: [...localOnly, ...serverBills].sort((a: Bill, b: Bill) => b.timestamp - a.timestamp) });
          }
          else { console.error("Failed to fetch bills or data format incorrect:", result.message); }
        } catch (error) {
          console.error("Error in fetchBills:", error);
        }
      },
      addBill: async (billData, itemsData) => {
        if (isLocalCompany(billData?.companyId)) {
          const companyId = billData.companyId;
          const localBillType = (billData.billType || billData.type || 'sell') as BillMode;
          const localStoreId = billData.storeIdForBill || billData.storeId || LOCAL_STORE_ID;
          const skipStockProductIds = new Set(billData.skipStockProductIds || []);

          if (!['sell', 'buy', 'return'].includes(localBillType)) {
            throw new Error(`Invalid local bill type: ${localBillType}`);
          }

          const currentDate = billData.date ? new Date(billData.date) : new Date();
          const newBillId = `LOCAL_${currentDate.getTime()}_${Math.random().toString(36).slice(2, 6)}`;
          let billSubTotal = 0;
          let totalSGST = 0;
          let totalCGST = 0;
          let totalIGST = 0;
          let totalDiscount = 0;

          const productsToUpdate = get().products.map(product => ({ ...product, productSKUs: product.productSKUs.map(sku => ({ ...sku, stockLayers: [...sku.stockLayers] })) }));
          const processedItems: BillItem[] = itemsData.map((item: any) => {
            const product = productsToUpdate.find(p => p.id === item.productId && p.companyId === companyId);
            const sku = product?.productSKUs.find(s => JSON.stringify(Object.entries(s.optionValues || {}).sort()) === JSON.stringify(Object.entries(item.selectedVariantOptions || {}).sort())) || product?.productSKUs[0];
            let costPrice = Number(item.costPrice || 0);
            const sellPrice = Number(item.sellPrice || 0);

            if (product && sku && product.trackQuantity) {
              if (localBillType === 'buy' && !skipStockProductIds.has(item.productId)) {
                sku.stockLayers.push({
                  id: uuidv4(),
                  purchaseBillId: newBillId,
                  purchaseDate: currentDate.toISOString(),
                  initialQuantity: item.quantity,
                  quantity: item.quantity,
                  costPrice,
                  sellPrice,
                  storeId: localStoreId,
                });
              } else if (localBillType === 'sell' && !billData.isEstimate) {
                let quantityToSell = item.quantity;
                let cogs = 0;
                let layers = sku.stockLayers.filter(layer => layer.quantity > 0 && (layer.storeId === localStoreId || !layer.storeId)).sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
                let available = layers.reduce((sum, layer) => sum + layer.quantity, 0);
                // Fallback: if filtering by storeId yielded nothing, try without storeId filter
                if (available < quantityToSell) {
                  layers = sku.stockLayers.filter(layer => layer.quantity > 0).sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
                  available = layers.reduce((sum, layer) => sum + layer.quantity, 0);
                }
                if (available < quantityToSell) throw new Error(`Insufficient stock for ${sku.skuIdentifier || product.name}.`);
                for (const layer of layers) {
                  const sold = Math.min(quantityToSell, layer.quantity);
                  cogs += sold * layer.costPrice;
                  layer.quantity = roundQuantity(layer.quantity - sold);
                  quantityToSell = roundQuantity(quantityToSell - sold);
                  if (quantityToSell <= 0) break;
                }
                costPrice = item.quantity > 0 ? cogs / item.quantity : 0;
              } else if (localBillType === 'return' && !item.isDefective && !skipStockProductIds.has(item.productId)) {
                sku.stockLayers.push({
                  id: uuidv4(),
                  purchaseBillId: newBillId,
                  purchaseDate: currentDate.toISOString(),
                  initialQuantity: item.quantity,
                  quantity: item.quantity,
                  costPrice,
                  sellPrice,
                  storeId: localStoreId,
                });
              }
            }

            const lineTotal = (localBillType === 'buy' ? costPrice : sellPrice) * item.quantity;
            const discountAmount = item.discountValue
              ? item.discountType === 'percentage' ? roundMoney((lineTotal * item.discountValue) / 100) : roundMoney(item.discountValue * item.quantity)
              : 0;
            const taxableValue = Math.max(0, lineTotal - discountAmount);
            const sgstAmount = billData.taxType === 'inter-state' ? 0 : roundMoney((taxableValue * (product?.sgstRate || 0)) / 100);
            const cgstAmount = billData.taxType === 'inter-state' ? 0 : roundMoney((taxableValue * (product?.cgstRate || 0)) / 100);
            const igstAmount = billData.taxType === 'inter-state' ? roundMoney((taxableValue * (product?.igstRate || 0)) / 100) : 0;

            billSubTotal += lineTotal;
            totalDiscount += discountAmount;
            totalSGST += sgstAmount;
            totalCGST += cgstAmount;
            totalIGST += igstAmount;

            return {
              ...item,
              id: uuidv4(),
              productName: sku?.skuIdentifier || item.productName || product?.name || 'Service/Charge',
              costPrice,
              sellPrice,
              sgstAmount,
              cgstAmount,
              igstAmount,
              discountAmount,
            };
          });

          const store = get().stores.find(s => s.id === localStoreId) || createLocalStore();
          const newBill: Bill = {
            id: newBillId,
            type: localBillType,
            date: currentDate.toISOString(),
            timestamp: currentDate.getTime(),
            vendorOrCustomerName: billData.vendorOrCustomerName,
            customerPhone: billData.customerPhone,
            items: processedItems,
            subTotal: roundMoney(billSubTotal),
            totalSGST: roundMoney(totalSGST),
            totalCGST: roundMoney(totalCGST),
            totalIGST: roundMoney(totalIGST),
            totalDiscount: roundMoney(totalDiscount),
            totalAmount: billData.isEstimate ? roundMoney(billSubTotal - totalDiscount) : roundMoney(billSubTotal - totalDiscount + totalSGST + totalCGST + totalIGST),
            isEstimate: !!billData.isEstimate,
            notes: billData.notes || get().userProfile.defaultBillNotes,
            paymentStatus: billData.paymentStatus,
            storeId: store.id,
            storeName: store.name,
            companyId,
            taxType: billData.taxType,
          };

          set((state) => ({
            products: productsToUpdate,
            bills: [newBill, ...state.bills.filter(bill => bill.companyId !== companyId || bill.id !== newBill.id)].sort((a, b) => b.timestamp - a.timestamp),
          }));
          return newBill;
        }

        try {
          const response = await fetch('/api/bills', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billData: { ...billData, skipStockProductIds: billData.skipStockProductIds }, itemsData }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          const newBill = result.data as Bill;
          set((state) => ({ bills: [newBill, ...state.bills].sort((a, b) => b.timestamp - a.timestamp) }));
          set({ products: [] });
          get().fetchProducts(billData.companyId);
          return newBill;
        } catch (error: any) {
          console.error("Error adding bill:", error);
          toast({ variant: "destructive", title: "Bill Save Failed", description: error.message || "An unknown error occurred." });
          return null;
        }
      },
      deleteBill: async (billId, companyId) => {
        if (isLocalCompany(companyId)) {
          set((state) => ({ bills: state.bills.filter(bill => !(bill.id === billId && bill.companyId === companyId)) }));
          return true;
        }

        try {
          const response = await fetch(`/api/bills/${billId}?companyId=${companyId}`, { method: 'DELETE' });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set((state) => ({ bills: state.bills.filter(b => b.id !== billId) }));
          set((state) => ({ bills: state.bills.filter(b => b.id !== billId) }));
          // get().fetchProducts(companyId); // See above
          return true;
        } catch (error) {
          console.error("Error deleting bill:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not delete bill.` });
          return false;
        }
      },
      updateBillNonCriticalDetails: async (billId, details, companyId) => {
        if (isLocalCompany(companyId)) {
          let updatedBill: Bill | null = null;
          set((state) => ({
            bills: state.bills.map(bill => {
              if (bill.id !== billId || bill.companyId !== companyId) return bill;
              updatedBill = { ...bill, ...details };
              return updatedBill;
            }),
          }));
          return updatedBill;
        }

        try {
          const response = await fetch(`/api/bills/${billId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...details, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set((state) => ({ bills: state.bills.map(b => b.id === billId ? result.data : b) }));
          return result.data;
        } catch (error) {
          console.error("Error updating bill details:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not update bill details.` });
          return null;
        }
      },

      // --- Other Fetch & CUD Actions (Staff, Stores, etc.) ---
      fetchCategories: async (companyId) => {
        if (!companyId) return console.warn("fetchCategories: companyId is required");
        if (isLocalCompany(companyId)) {
          set((state) => ({ categories: state.categories.filter(category => category.companyId === companyId) }));
          return;
        }
        const cachedCategories = get().categories;
        if (cachedCategories.length > 0 && cachedCategories.every(category => category.companyId === companyId)) return;

        try {
          const response = await fetch(`/api/categories?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) set({ categories: result.data || [] });
          else { console.error("Failed to fetch categories or data format incorrect:", result.message); set({ categories: [] }); }
        } catch (error) {
          console.error("Error in fetchCategories:", error);
          set({ categories: [] });
        }
      },
      addCategory: async (categoryName, companyId) => {
        if (isLocalCompany(companyId)) {
          const trimmedName = categoryName.trim();
          if (!trimmedName) return null;
          const existing = get().categories.find(category => category.companyId === companyId && category.name.toLowerCase() === trimmedName.toLowerCase());
          if (existing) return existing;
          const newCategory: Category = { id: uuidv4(), name: trimmedName, companyId };
          set((state) => ({ categories: [...state.categories, newCategory].sort((a, b) => a.name.localeCompare(b.name)) }));
          return newCategory;
        }

        try {
          const response = await fetch('/api/categories', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: categoryName, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ categories: [...state.categories, result.data].sort((a, b) => a.name.localeCompare(b.name)) }));
          return result.data;
        } catch (error) {
          console.error("Error adding category:", error);
          toast({ variant: "destructive", title: "Error", description: `Could not add category.` });
          return null;
        }
      },
      fetchCustomers: async (companyId) => {
        if (!companyId) return console.warn("fetchCustomers: companyId is required");
        if (isLocalCompany(companyId)) {
          const customersByPhone = new Map<string, Customer>();
          get().bills
            .filter(bill => bill.companyId === companyId && bill.customerPhone)
            .forEach((bill) => {
              const phone = bill.customerPhone || '';
              const existing = customersByPhone.get(phone);
              customersByPhone.set(phone, {
                id: existing?.id || `cust_local_${phone}`,
                companyId,
                name: bill.vendorOrCustomerName || existing?.name || 'Walk-in Customer',
                phone,
                firstSeen: existing?.firstSeen || bill.date,
                lastSeen: bill.date,
              });
            });
          set({ customers: Array.from(customersByPhone.values()) });
          return;
        }
        const cachedCustomers = get().customers;
        if (cachedCustomers.length > 0 && cachedCustomers.every(customer => customer.companyId === companyId)) return;

        try {
          const response = await fetch(`/api/customers?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch customers: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) set({ customers: result.data || [] });
          else { console.error("Failed to fetch customers or data format incorrect:", result.message); set({ customers: [] }); }
        } catch (error) {
          console.error("Error in fetchCustomers:", error);
          set({ customers: [] });
        }
      },
      // --- Manual Entry Actions ---
      fetchManualEntries: async (companyId) => {
        if (!companyId) return console.warn("fetchManualEntries: companyId is required");
        if (isLocalCompany(companyId)) {
          set((state) => ({ manualEntries: state.manualEntries.filter(entry => entry.companyId === companyId) }));
          return;
        }
        try {
          const response = await fetch(`/api/manual-entries?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch manual entries: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            set({ manualEntries: result.data || [] });
          } else {
            console.error("Failed to fetch manual entries or data format incorrect:", result.message);
            set({ manualEntries: [] });
          }
        } catch (error) {
          console.error("Error in fetchManualEntries:", error);
          set({ manualEntries: [] });
        }
      },
      addManualEntry: async (entryData, companyId) => {
        if (!companyId || !entryData) return null;
        if (isLocalCompany(companyId)) {
          const newEntry: ManualEntry = {
            id: `entry_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            companyId,
            storeId: entryData.storeId || null,
            date: entryData.date,
            entryType: entryData.entryType,
            category: entryData.category,
            amount: Number(entryData.amount) || 0,
            note: entryData.note,
            createdAt: new Date().toISOString(),
          };
          set((state) => ({ manualEntries: [newEntry, ...state.manualEntries] }));
          return newEntry;
        }
        try {
          const response = await fetch('/api/manual-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...entryData, companyId }),
          });
          const result = await response.json();
          if (!result.success || !result.data) throw new Error(result.message || 'Failed to add manual entry.');
          const newEntry = result.data as ManualEntry;
          set((state) => ({ manualEntries: [newEntry, ...state.manualEntries] }));
          return newEntry;
        } catch (error) {
          console.error("Error in addManualEntry:", error);
          return null;
        }
      },
      updateManualEntry: async (entryId, entryData, companyId) => {
        if (!entryId || !companyId) return null;
        if (isLocalCompany(companyId)) {
          let updated: ManualEntry | null = null;
          set((state) => ({
            manualEntries: state.manualEntries.map(item => {
              if (item.id === entryId) {
                updated = { ...item, ...entryData };
                return updated;
              }
              return item;
            }),
          }));
          return updated;
        }
        try {
          const response = await fetch(`/api/manual-entries/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...entryData, companyId }),
          });
          const result = await response.json();
          if (!result.success || !result.data) throw new Error(result.message || 'Failed to update manual entry.');
          const updatedEntry = result.data as ManualEntry;
          set((state) => ({ manualEntries: state.manualEntries.map(item => item.id === entryId ? updatedEntry : item) }));
          return updatedEntry;
        } catch (error) {
          console.error("Error in updateManualEntry:", error);
          return null;
        }
      },
      deleteManualEntry: async (entryId, companyId) => {
        if (!entryId || !companyId) return false;
        if (isLocalCompany(companyId)) {
          set((state) => ({ manualEntries: state.manualEntries.filter(item => item.id !== entryId) }));
          return true;
        }
        try {
          const response = await fetch(`/api/manual-entries/${entryId}?companyId=${companyId}`, { method: 'DELETE' });
          const result = await response.json();
          if (!result.success) throw new Error(result.message || 'Failed to delete manual entry.');
          set((state) => ({ manualEntries: state.manualEntries.filter(item => item.id !== entryId) }));
          return true;
        } catch (error) {
          console.error("Error in deleteManualEntry:", error);
          return false;
        }
      },
      fetchStaff: async (companyId) => {
        if (!companyId) return console.warn("fetchStaff: companyId is required");
        if (isLocalCompany(companyId)) {
          set({
            staffs: [{
              id: LOCAL_ADMIN_ID,
              companyId,
              name: 'Local Admin',
              role: 'employee',
              employeeId: 'local-admin',
              assignedStoreIds: [LOCAL_STORE_ID],
            }],
          });
          return;
        }
        // Removed cache check to ensure we get fresh data (passwords) when revisiting the page
        // if (get().staffs.length > 0) return; 

        try {
          const response = await fetch(`/api/staff?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch staff: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) set({ staffs: result.data || [] });
          else { console.error("Failed to fetch staff or data format incorrect:", result.message); set({ staffs: [] }); }
        } catch (error) {
          console.error("Error in fetchStaff:", error);
          set({ staffs: [] });
        }
      },
      addStaff: async (staffData, companyId) => {
        try {
          const response = await fetch('/api/staff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffData, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ staffs: [...state.staffs, result.data] }));
          return result.data;
        } catch (error) {
          console.error("Error adding staff:", error);
          toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Could not add staff member." });
          return null;
        }
      },
      updateStaff: async (staffId, staffData, companyId) => {
        try {
          const response = await fetch(`/api/staff/${staffId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffData, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ staffs: state.staffs.map(s => s.id === staffId ? result.data : s) }));
          return result.data;
        } catch (error) {
          console.error("Error updating staff:", error);
          toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Could not update staff member." });
          return null;
        }
      },
      deleteStaff: async (staffId, companyId) => {
        try {
          const response = await fetch(`/api/staff/${staffId}?companyId=${companyId}`, { method: 'DELETE' });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ staffs: state.staffs.filter(s => s.id !== staffId) }));
          return true;
        } catch (error) {
          console.error("Error deleting staff:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not delete staff member." });
          return false;
        }
      },
      fetchStores: async (companyId) => {
        if (!companyId) return console.warn("fetchStores: companyId is required");
        if (isLocalCompany(companyId)) {
          set((state) => ({
            stores: state.stores.some(store => store.companyId === companyId)
              ? state.stores.filter(store => store.companyId === companyId)
              : [createLocalStore()],
          }));
          return;
        }
        const cachedStores = get().stores;
        if (cachedStores.length > 0 && cachedStores.every(store => store.companyId === companyId)) return;

        try {
          const response = await fetch(`/api/stores?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch stores: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) set({ stores: result.data || [] });
          else { console.error("Failed to fetch stores or data format incorrect:", result.message); set({ stores: [] }); }
        } catch (error) {
          console.error("Error in fetchStores:", error);
          set({ stores: [] });
        }
      },
      addStore: async (storeData, companyId) => {
        if (isLocalCompany(companyId)) {
          const newStore: Store = {
            ...storeData,
            id: uuidv4(),
            companyId,
            accessCode: (storeData as any).accessCode || 'LOCAL',
            allowedOperations: storeData.allowedOperations || ['buy', 'sell', 'return'],
            allowedStaffIds: storeData.allowedStaffIds || [],
          };
          set((state) => ({ stores: [...state.stores.filter(store => store.companyId !== companyId || store.id !== newStore.id), newStore] }));
          return newStore;
        }

        try {
          const response = await fetch('/api/stores', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeData, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ stores: [...state.stores, result.data] }));
          return result.data;
        } catch (error) {
          console.error("Error adding store:", error);
          toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Could not add store." });
          return null;
        }
      },
      updateStore: async (storeId, storeData, companyId) => {
        if (isLocalCompany(companyId)) {
          let updatedStore: Store | null = null;
          set((state) => ({
            stores: state.stores.map(store => {
              if (store.id !== storeId || store.companyId !== companyId) return store;
              updatedStore = { ...store, ...storeData, id: store.id, companyId: store.companyId };
              return updatedStore;
            }),
          }));
          return updatedStore;
        }

        try {
          const response = await fetch(`/api/stores/${storeId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeData, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ stores: state.stores.map(s => s.id === storeId ? result.data : s) }));
          return result.data;
        } catch (error) {
          console.error("Error updating store:", error);
          toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Could not update store." });
          return null;
        }
      },
      deleteStore: async (storeId, companyId) => {
        if (isLocalCompany(companyId)) {
          if (storeId === LOCAL_STORE_ID) return false;
          set((state) => ({ stores: state.stores.filter(store => !(store.id === storeId && store.companyId === companyId)) }));
          return true;
        }

        try {
          const response = await fetch(`/api/stores/${storeId}?companyId=${companyId}`, { method: 'DELETE' });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ stores: state.stores.filter(s => s.id !== storeId) }));
          return true;
        } catch (error) {
          console.error("Error deleting store:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not delete store." });
          return false;
        }
      },
      fetchCompanyProfile: async (companyId) => {
        if (!companyId) {
          console.warn("fetchCompanyProfile called without companyId.");
          set({ userProfile: { ...defaultUserProfile, dataMode: 'local' } });
          return null;
        }
        if (isLocalCompany(companyId)) {
          let localCompany: Company;
          set((state) => {
            const nextProfile: UserProfile = {
              ...state.userProfile,
              companyName: !state.userProfile.companyName || state.userProfile.companyName === DEFAULT_COMPANY_NAME
                ? 'My Local Company'
                : state.userProfile.companyName,
              activeSubscriptionId: SUBSCRIPTION_PLAN_IDS.PRO,
              dataMode: 'local',
              paymentStatus: 'paid',
              subscriptionExpiryDate: null,
            };
            localCompany = createLocalCompany(nextProfile);
            return {
              userProfile: nextProfile,
              stores: state.stores.some(store => store.companyId === companyId) ? state.stores : [createLocalStore()],
            };
          });
          return localCompany!;
        }
        try {
          const response = await fetch(`/api/companies/${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch company profile: ${response.statusText}`);
          const result = await response.json();
          if (result.success && result.data) {
            const companyData = result.data as Company;
            set((state) => ({
              userProfile: {
                ...state.userProfile,
                companyName: companyData.name, companyLogoUrl: companyData.logoUrl, companySlogan: companyData.slogan,
                companyPhone: companyData.phone, companyAddress: companyData.address, companyGstNo: companyData.gstNo,
                activeSubscriptionId: companyData.activeSubscriptionId, defaultBillNotes: companyData.defaultBillNotes,
                defaultSalesPaymentStatus: companyData.defaultSalesPaymentStatus, defaultPurchasePaymentStatus: companyData.defaultPurchasePaymentStatus,
                companyCurrency: companyData.currency || DEFAULT_CURRENCY_CODE, paymentStatus: companyData.paymentStatus,
                subscriptionExpiryDate: companyData.subscriptionExpiryDate, pendingSubscriptionId: companyData.pendingSubscriptionId, dataMode: 'global', creationDate: companyData.creationDate,
              }
            }));
            return companyData;
          } else {
            throw new Error(result.message || "API returned success: false.");
          }
        } catch (error) {
          console.error("Critical error in fetchCompanyProfile:", error);
          set({ userProfile: { ...defaultUserProfile, dataMode: 'local' } });
          return null; // Explicitly return null on failure
        }
      },
      updateUserProfileFields: async (data, companyId) => {
        if (isLocalCompany(companyId)) {
          let updatedCompany: Company;
          set((state) => {
            const nextProfile: UserProfile = {
              ...state.userProfile,
              companyName: data.name ?? state.userProfile.companyName,
              companyLogoUrl: data.logoUrl ?? state.userProfile.companyLogoUrl,
              companySlogan: data.slogan ?? state.userProfile.companySlogan,
              companyPhone: data.phone ?? state.userProfile.companyPhone,
              companyAddress: data.address ?? state.userProfile.companyAddress,
              companyGstNo: data.gstNo ?? state.userProfile.companyGstNo,
              activeSubscriptionId: data.activeSubscriptionId ?? state.userProfile.activeSubscriptionId,
              defaultBillNotes: data.defaultBillNotes ?? state.userProfile.defaultBillNotes,
              defaultSalesPaymentStatus: data.defaultSalesPaymentStatus ?? state.userProfile.defaultSalesPaymentStatus,
              defaultPurchasePaymentStatus: data.defaultPurchasePaymentStatus ?? state.userProfile.defaultPurchasePaymentStatus,
              companyCurrency: data.currency ?? state.userProfile.companyCurrency,
              dataMode: 'local',
              paymentStatus: 'paid',
            };
            updatedCompany = createLocalCompany(nextProfile);
            return { userProfile: nextProfile };
          });
          return updatedCompany!;
        }

        try {
          const response = await fetch(`/api/companies/${companyId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          get().fetchCompanyProfile(companyId); // Re-fetch to ensure full consistency
          return result.data;
        } catch (error) {
          console.error("Error updating company profile:", error);
          toast({ variant: "destructive", title: "Error", description: (error as Error).message || "Could not update profile." });
          return null;
        }
      },

      fetchMessagesForStore: async (storeId, companyId) => {
        if (isLocalCompany(companyId)) {
          set((state) => ({ messagesByStore: { ...state.messagesByStore, [storeId]: state.messagesByStore[storeId] || [] } }));
          return;
        }

        try {
          const response = await fetch(`/api/chat/${storeId}?companyId=${companyId}`);
          if (!response.ok) throw new Error(`Failed to fetch messages: ${response.statusText}`);
          const result = await response.json();
          if (result.success && Array.isArray(result.data)) {
            set(state => ({ messagesByStore: { ...state.messagesByStore, [storeId]: result.data } }));
          } else {
            throw new Error(result.message || 'Failed to fetch messages');
          }
        } catch (error) {
          console.error(`Error fetching messages for store ${storeId}:`, error);
          set(state => ({ messagesByStore: { ...state.messagesByStore, [storeId]: [] } }));
        }
      },
      addChatMessage: async (storeId, senderId, senderName, text, companyId) => {
        if (isLocalCompany(companyId)) {
          const newMessage: ChatMessage = {
            id: uuidv4(),
            storeId,
            companyId,
            senderId,
            senderName,
            text,
            timestamp: Date.now(),
          };
          set((state) => ({ messagesByStore: { ...state.messagesByStore, [storeId]: [...(state.messagesByStore[storeId] || []), newMessage] } }));
          return;
        }

        try {
          const response = await fetch(`/api/chat/${storeId}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId, senderName, text, companyId }),
          });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({
            messagesByStore: { ...state.messagesByStore, [storeId]: [...(state.messagesByStore[storeId] || []), result.data] }
          }));
        } catch (error) {
          console.error("Error adding chat message:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not send message." });
        }
      },
      clearChatForStore: async (storeId, companyId) => {
        if (isLocalCompany(companyId)) {
          set((state) => ({ messagesByStore: { ...state.messagesByStore, [storeId]: [] } }));
          return true;
        }

        try {
          const response = await fetch(`/api/chat/${storeId}?companyId=${companyId}`, { method: 'DELETE' });
          const result = await response.json();
          if (!result.success) throw new Error(result.message);
          set(state => ({ messagesByStore: { ...state.messagesByStore, [storeId]: [] } }));
          return true;
        } catch (error) {
          console.error("Error clearing chat:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not clear chat." });
          return false;
        }
      },
      // #endregion

      // #region Getters and Client-Side Helpers
      getProductById: (productId) => get().products.find(p => p.id === productId),
      getBillById: (billId) => get().bills.find(b => b.id === billId),
      getStoreById: (storeId) => get().stores.find(s => s.id === storeId),
      getStaffById: (staffId) => get().staffs.find(s => s.id === staffId),
      getCustomerById: (customerId) => get().customers.find(c => c.id === customerId),
      getAllStores: () => get().stores,
      getAllStaff: () => get().staffs,
      getAllCustomers: (companyId) => {
        const state = get();
        return companyId ? state.customers.filter(c => c.companyId === companyId) : state.customers;
      },
      getSkuIdentifier: (productName, optionValues) => {
        if (!optionValues || Object.keys(optionValues).length === 0) return productName;
        const sortedOptions = Object.entries(optionValues).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([, value]) => value).join(' - ');
        return `${productName} (${sortedOptions})`;
      },
      getSkuDetails: (sku, targetStoreId) => {
        const { products, getSkuIdentifier } = get();
        const product = products.find(p => p.productSKUs.some(s => s.id === sku?.id));
        const skuIdentifier = sku?.skuIdentifier || (sku && product ? getSkuIdentifier(product.name, sku.optionValues) : undefined);

        if (!sku || !product) return { totalStock: 0, currentSellPrice: null, averageCostPrice: null, skuIdentifier };

        let relevantLayers = targetStoreId ? sku.stockLayers.filter(layer => layer.storeId === targetStoreId) : sku.stockLayers;

        const storeScopedStock = relevantLayers.reduce((sum, layer) => sum + layer.quantity, 0);
        if (targetStoreId && storeScopedStock === 0) {
          relevantLayers = sku.stockLayers;
        }

        if (!product.trackQuantity) {
          // Fallback to product-level non-tracked prices if stock layers are missing
          // Accessing the product directly as Any because these fields might not be in the strict Product interface yet, 
          // or we assume they are populated by the backend.
          const pAny = product as any;
          const fallbackSell = pAny.sellPriceForNonTracked ?? null;
          const fallbackCost = pAny.costPriceForNonTracked ?? null;

          const priceLayer = relevantLayers.length > 0 ? relevantLayers[0] : sku.stockLayers[0];

          return {
            totalStock: null,
            currentSellPrice: priceLayer?.sellPrice ?? fallbackSell,
            averageCostPrice: priceLayer?.costPrice ?? fallbackCost,
            skuIdentifier
          };
        }

        const totalStock = relevantLayers.reduce((sum, layer) => sum + layer.quantity, 0);

        const getPrice = (layers: StockLayer[], priceType: 'sellPrice' | 'costPrice') => {
          if (totalStock > 0) {
            const oldestLayer = [...layers].filter(l => l.quantity > 0).sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())[0];
            return oldestLayer?.[priceType] ?? null;
          }
          if (layers.length > 0) {
            const newestLayer = [...layers].sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
            return newestLayer?.[priceType] ?? null;
          }
          return null;
        }

        const getAverageCostPrice = () => {
          if (totalStock > 0) {
            const totalValue = relevantLayers.reduce((sum, layer) => sum + (layer.costPrice * layer.quantity), 0);
            return totalValue / totalStock;
          }
          if (relevantLayers.length > 0) {
            const totalInitialValue = relevantLayers.reduce((sum, layer) => sum + (layer.costPrice * layer.initialQuantity), 0);
            const totalInitialQty = relevantLayers.reduce((sum, layer) => sum + layer.initialQuantity, 0);
            return totalInitialQty > 0 ? totalInitialValue / totalInitialQty : null;
          }
          return null;
        }

        return {
          totalStock,
          currentSellPrice: getPrice(relevantLayers, 'sellPrice'),
          averageCostPrice: getAverageCostPrice(),
          skuIdentifier
        };
      },
      findOrCreateProductSKU(productId, optionValues) {
        const state = get();
        const product = state.products.find(p => p.id === productId);
        if (!product) return undefined;

        const stringifiedTargetOptions = JSON.stringify(Object.entries(optionValues).sort());

        let sku = product.productSKUs.find(s => {
          const stringifiedSkuOptions = JSON.stringify(Object.entries(s.optionValues || {}).sort());
          return stringifiedSkuOptions === stringifiedTargetOptions;
        });

        if (!sku) {
          const newSku: ProductSKU = {
            id: uuidv4(),
            optionValues: optionValues,
            stockLayers: [],
          };
          const updatedProduct = { ...product, productSKUs: [...product.productSKUs, newSku] };
          set({ products: state.products.map(p => p.id === productId ? updatedProduct : p) });
          return newSku;
        }
        return sku;
      },
      searchProducts: (searchTerm) => {
        if (!searchTerm) return [];
        const lowerSearchTerm = searchTerm.toLowerCase();
        return get().products.filter(p => !p.isArchived && (
          p.name.toLowerCase().includes(lowerSearchTerm) ||
          (p.category || '').toLowerCase().includes(lowerSearchTerm) ||
          (p.sku || '').toLowerCase().includes(lowerSearchTerm) ||
          p.productSKUs.some(sku => sku.skuIdentifier?.toLowerCase().includes(lowerSearchTerm))
        ));
      },
      searchCategories: (searchTerm: string) => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        return get().categories.filter(c => c.name.toLowerCase().includes(lowerSearchTerm)).map(c => c.name).sort();
      },
      getMessagesForStore: (storeId) => (get().messagesByStore[storeId] || []).sort((a, b) => a.timestamp - b.timestamp),
      getStaffDetailsByIds: (staffIds) => staffIds.map(id => get().staffs.find(s => s.id === id)).filter((s): s is User => !!s),

      // --- Subscription & Permission Getters ---
      getActiveSubscriptionPlan: () => {
        const { userProfile } = get();
        return SUBSCRIPTION_PLANS.find(p => p.id === userProfile.activeSubscriptionId) || SUBSCRIPTION_PLANS.find(p => p.id === SUBSCRIPTION_PLAN_IDS.STARTER);
      },
      canAddStore: () => {
        const plan = get().getActiveSubscriptionPlan();
        return plan ? get().stores.length < plan.maxStores : false;
      },
      canAddStaff: () => {
        const plan = get().getActiveSubscriptionPlan();
        return plan ? get().staffs.length < plan.maxEmployees : false;
      },

      // --- Analytics & Reporting Getters ---
      getLowStockProductCount: (threshold, companyId) => {
        const products = companyId ? get().products.filter(p => p.companyId === companyId) : get().products;
        return products.reduce((count, p) => {
          if (p.trackQuantity && !p.isArchived) {
            const stock = p.productSKUs.reduce((sum, sku) => sum + (get().getSkuDetails(sku).totalStock ?? 0), 0);
            if (stock > 0 && stock <= threshold) return count + 1;
          }
          return count;
        }, 0);
      },
      getRecentBills: (limit, companyId) => {
        const bills = companyId ? get().bills.filter(bill => bill.companyId === companyId) : get().bills;
        return [...bills].slice(0, limit);
      },
      getBillsForProduct: (productId) => get().bills.filter(b => b.items.some(i => i.productId === productId)),
      // All other complex getters (`getDailySalesAndExpenses`, `getTopSellingProductsByRevenue`, etc.) are left as is,
      // as they now operate on server-fetched, reliable data. Their internal logic remains the same.
      // A future optimization would be to move these aggregations to dedicated API endpoints.
      getDailySalesAndExpenses: (period, companyId) => {
        let billsToConsider = get().bills;
        if (companyId) {
          billsToConsider = billsToConsider.filter(bill => bill.companyId === companyId);
        }
        const dailyDataMap: Record<string, { sales: number; expenses: number }> = {};
        const now = new Date();

        let daysToIterate: number;
        let formatStr: string;
        let groupBy: 'day' | 'week' | 'month' = 'day';

        switch (period) {
          case 'daily': daysToIterate = 7; formatStr = 'MMM d'; groupBy = 'day'; break;
          case 'weekly': daysToIterate = 28; formatStr = 'MMM d'; groupBy = 'day'; break;
          case 'monthly': daysToIterate = 365; formatStr = 'MMM yyyy'; groupBy = 'month'; break;
          case 'yearly': daysToIterate = 365; formatStr = 'MMM yyyy'; groupBy = 'month'; break;
          default: daysToIterate = 7; formatStr = 'MMM d'; groupBy = 'day';
        }

        const cutoffDate = subDays(now, daysToIterate);

        billsToConsider.forEach(bill => {
          const billDate = new Date(bill.date);
          if (billDate >= cutoffDate) {
            let dateKey: string;
            if (groupBy === 'day') {
              dateKey = format(billDate, formatStr);
            } else { // month
              dateKey = format(startOfMonth(billDate), formatStr);
            }

            if (!dailyDataMap[dateKey]) dailyDataMap[dateKey] = { sales: 0, expenses: 0 };

            if (bill.type === 'sell' && !bill.isEstimate) {
              dailyDataMap[dateKey].sales += bill.totalAmount;
            } else if (bill.type === 'buy') {
              dailyDataMap[dateKey].expenses += bill.totalAmount;
            }
          }
        });

        return Object.entries(dailyDataMap).map(([date, data]) => ({ date, ...data })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      },
      getTopSellingProductsByRevenue: (limit, period, companyId) => {
        let billsToConsider = get().bills;
        if (companyId) {
          billsToConsider = billsToConsider.filter(bill => bill.companyId === companyId);
        }
        const filterBillsByPeriod = (bills: Bill[], period: TimePeriod): Bill[] => {
          const now = new Date();
          switch (period) {
            case 'daily': return bills.filter(bill => isToday(new Date(bill.date)));
            case 'weekly': return bills.filter(bill => isThisWeek(new Date(bill.date), { weekStartsOn: 1 }));
            case 'monthly': return bills.filter(bill => isThisMonth(new Date(bill.date)));
            case 'yearly': return bills.filter(bill => isThisYear(new Date(bill.date)));
            default: return bills.filter(bill => isToday(new Date(bill.date)));
          }
        };
        const periodFilteredBills = filterBillsByPeriod(billsToConsider, period);

        const productRevenue: Record<string, { name: string; revenue: number; quantity: number }> = {};

        periodFilteredBills.forEach(bill => {
          if (bill.type === 'sell' && !bill.isEstimate) {
            bill.items.forEach(item => {
              if (item.productId.startsWith('SERVICE_ITEM_') || item.isAdditionalCharge) return;
              const productNameForItem = item.productName || 'Unknown Product';
              if (!productRevenue[productNameForItem]) {
                productRevenue[productNameForItem] = { name: productNameForItem, revenue: 0, quantity: 0 };
              }
              productRevenue[productNameForItem].revenue += (item.sellPrice ?? 0) * item.quantity;
              productRevenue[productNameForItem].quantity += item.quantity;
            });
          }
        });
        return Object.values(productRevenue)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limit);
      },
      getRecentExpenseBillsWithPotentialCoverage: (limit: number, companyId?: string) => {
        let billsToConsider = get().bills;
        if (companyId) {
          billsToConsider = billsToConsider.filter(bill => bill.companyId === companyId);
        }
        const expenseBills = billsToConsider.filter(bill => bill.type === 'buy')
          .sort((a, b) => b.timestamp - a.timestamp);
        return expenseBills.slice(0, limit).map(bill => {
          const totalCost = bill.totalAmount;
          const potentialRevenue = bill.items.reduce((acc, item) => {
            const product = get().getProductById(item.productId);
            if (product && product.trackQuantity === false) {
              const defaultSku = product.productSKUs.find(s => Object.keys(s.optionValues).length === 0);
              const skuDetails = get().getSkuDetails(defaultSku, bill.storeId);
              return acc + ((skuDetails.currentSellPrice ?? 0) * item.quantity);
            }
            return acc + ((item.sellPrice ?? 0) * item.quantity);
          }, 0);
          const coverageStatus = potentialRevenue >= totalCost ? 'Covered' : 'Uncovered';
          return { ...bill, totalCost, potentialRevenue, coverageStatus };
        });
      },
      getExpenseSummaryStats: (companyId): ExpenseSummary => {
        let billsToConsider = get().bills;
        if (companyId) {
          billsToConsider = billsToConsider.filter(bill => bill.companyId === companyId);
        }
        const expenseBills = billsToConsider.filter(bill => bill.type === 'buy');
        let totalCoveredExpenseValue = 0;
        let totalUncoveredExpenseValue = 0;
        let totalPotentialProfitOnCoveredExpenses = 0;
        let totalOutstandingCostOnUncoveredExpenses = 0;
        let coveredBillCount = 0;
        let uncoveredBillCount = 0;

        expenseBills.forEach(bill => {
          const totalCost = bill.totalAmount;
          const potentialRevenue = bill.items.reduce((acc, item) => {
            const product = get().getProductById(item.productId);
            if (product && product.trackQuantity === false) {
              const defaultSku = product.productSKUs.find(s => Object.keys(s.optionValues).length === 0);
              const skuDetails = get().getSkuDetails(defaultSku, bill.storeId);
              return acc + ((skuDetails.currentSellPrice ?? 0) * item.quantity);
            }
            return acc + ((item.sellPrice ?? 0) * item.quantity);
          }, 0);
          if (potentialRevenue >= totalCost) {
            totalCoveredExpenseValue += totalCost;
            totalPotentialProfitOnCoveredExpenses += (potentialRevenue - totalCost);
            coveredBillCount++;
          } else {
            totalUncoveredExpenseValue += totalCost;
            totalOutstandingCostOnUncoveredExpenses += (totalCost - potentialRevenue);
            uncoveredBillCount++;
          }
        });
        return {
          totalCoveredExpenseValue, totalUncoveredExpenseValue,
          totalPotentialProfitOnCoveredExpenses, totalOutstandingCostOnUncoveredExpenses,
          coveredBillCount, uncoveredBillCount,
        };
      },
      getOverallFinancialSummary: (period: TimePeriod, companyId?: string): FinancialSummary => {
        let billsToConsider = get().bills;
        if (companyId) {
          billsToConsider = billsToConsider.filter(bill => bill.companyId === companyId);
        }
        const filterBillsByPeriod = (bills: Bill[], period: TimePeriod): Bill[] => {
          const now = new Date();
          switch (period) {
            case 'daily': return bills.filter(bill => isToday(new Date(bill.date)));
            case 'weekly': return bills.filter(bill => isThisWeek(new Date(bill.date), { weekStartsOn: 1 }));
            case 'monthly': return bills.filter(bill => isThisMonth(new Date(bill.date)));
            case 'yearly': return bills.filter(bill => isThisYear(new Date(bill.date)));
            default: return bills;
          }
        };

        const filteredBills = filterBillsByPeriod(billsToConsider, period);

        let totalRevenue = 0;
        let totalCOGS = 0;
        let totalExpenses = 0;

        filteredBills.forEach(bill => {
          if (bill.type === 'sell' && !bill.isEstimate) {
            totalRevenue += bill.subTotal ?? bill.totalAmount;
            bill.items.forEach(item => {
              if (item.productId.startsWith('SERVICE_ITEM_') || item.isAdditionalCharge) return;
              const costForItem = (item.costPrice || 0);
              totalCOGS += costForItem * item.quantity;
            });
          } else if (bill.type === 'buy') {
            totalExpenses += bill.totalAmount;
          }
        });
        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;
        return { totalRevenue, totalCOGS, grossProfit, totalExpenses, netProfit };
      },
      getPeriodFinancialSummary: (period, companyId) => {
        const filterBillsByPeriod = (bills: Bill[], p: TimePeriod) => {
          const now = new Date();
          switch (p) {
            case 'daily': return bills.filter(b => isToday(new Date(b.date)));
            case 'weekly': return bills.filter(b => isThisWeek(new Date(b.date), { weekStartsOn: 1 }));
            case 'monthly': return bills.filter(b => isThisMonth(new Date(b.date)));
            case 'yearly': return bills.filter(b => isThisYear(new Date(b.date)));
            default: return bills;
          }
        };
        const bills = get().bills.filter(b => !companyId || b.companyId === companyId);
        const filteredBills = filterBillsByPeriod(bills, period);

        let totalRevenue = 0, totalCOGS = 0, totalExpenses = 0, transactionsToday = 0, defectivesToday = 0;
        filteredBills.forEach(bill => {
          transactionsToday++;
          if (bill.type === 'sell' && !bill.isEstimate) {
            totalRevenue += bill.subTotal ?? 0;
            bill.items.forEach(item => { if (!item.isAdditionalCharge && !item.productId.startsWith('SERVICE_ITEM_')) totalCOGS += (item.costPrice || 0) * item.quantity; });
          } else if (bill.type === 'buy') {
            totalExpenses += bill.totalAmount;
          } else if (bill.type === 'return') {
            bill.items.forEach(item => { if (item.isDefective) defectivesToday += item.quantity; });
          }
        });
        return { totalRevenue, totalCOGS, grossProfit: totalRevenue - totalCOGS, totalExpenses, transactionsToday, defectivesToday };
      },
      getTopProfitableProducts: (limit, period, companyId) => {
        let billsToConsider = get().bills;
        if (companyId) {
          billsToConsider = billsToConsider.filter(bill => bill.companyId === companyId);
        }
        const filterBillsByPeriod = (bills: Bill[], p: TimePeriod) => {
          const now = new Date();
          switch (p) {
            case 'daily': return bills.filter(b => isToday(new Date(b.date)));
            case 'weekly': return bills.filter(b => isThisWeek(new Date(b.date), { weekStartsOn: 1 }));
            case 'monthly': return bills.filter(b => isThisMonth(new Date(b.date)));
            case 'yearly': return bills.filter(b => isThisYear(new Date(b.date)));
            default: return bills;
          }
        };

        const periodFilteredBills = filterBillsByPeriod(billsToConsider, period);

        const productFinancials: Record<string, { name: string; revenue: number; cogs: number; profit: number; quantity: number }> = {};
        periodFilteredBills.forEach(bill => {
          if (bill.type === 'sell' && !bill.isEstimate) {
            bill.items.forEach(item => {
              if (item.productId.startsWith('SERVICE_ITEM_') || item.isAdditionalCharge) return;
              const skuIdentifier = item.productName;
              if (skuIdentifier && typeof skuIdentifier === 'string') {
                if (!productFinancials[skuIdentifier]) {
                  productFinancials[skuIdentifier] = { name: skuIdentifier, revenue: 0, cogs: 0, profit: 0, quantity: 0 };
                }
                const itemRevenue = (item.sellPrice || 0) * item.quantity;
                const itemCogs = (item.costPrice || 0) * item.quantity;

                productFinancials[skuIdentifier].revenue += itemRevenue;
                productFinancials[skuIdentifier].cogs += itemCogs;
                productFinancials[skuIdentifier].profit += (itemRevenue - itemCogs);
                productFinancials[skuIdentifier].quantity += item.quantity;
              }
            });
          }
        });
        return Object.values(productFinancials)
          .sort((a, b) => b.profit - a.profit)
          .slice(0, limit);
      },
      getProductAnalytics: (productId) => {
        const productBills = get().bills.filter(b => b.items.some(i => i.productId === productId));
        let totalPurchased = 0, totalSold = 0, totalReturned = 0, totalRevenue = 0, totalCostOfGoodsSold = 0;
        productBills.forEach(bill => {
          bill.items.forEach(item => {
            if (item.productId !== productId) return;
            if (bill.type === 'buy') totalPurchased += item.quantity;
            else if (bill.type === 'sell' && !bill.isEstimate) {
              totalSold += item.quantity;
              totalRevenue += item.sellPrice * item.quantity;
              totalCostOfGoodsSold += (item.costPrice || 0) * item.quantity;
            } else if (bill.type === 'return') totalReturned += item.quantity;
          });
        });
        return {
          totalPurchased, totalSold, totalReturned, totalRevenue, totalCostOfGoodsSold,
          grossProfit: totalRevenue - totalCostOfGoodsSold,
          averageSellPrice: totalSold > 0 ? totalRevenue / totalSold : null,
          averageCostPrice: totalSold > 0 ? totalCostOfGoodsSold / totalSold : null,
        };
      },
      getProductLedgerSummary: (params = {}) => {
        const { companyId, startDate, endDate } = params;
        let productsToConsider = get().products.filter(p => !p.isArchived);
        if (companyId) productsToConsider = productsToConsider.filter(p => p.companyId === companyId);

        let billsToConsider = get().bills;
        if (companyId) billsToConsider = billsToConsider.filter(b => b.companyId === companyId);
        if (startDate) billsToConsider = billsToConsider.filter(b => new Date(b.date) >= startDate);
        if (endDate) billsToConsider = billsToConsider.filter(b => new Date(b.date) <= endDate);

        const ledger: ProductLedgerEntry[] = productsToConsider.map(p => {
          let totalPurchased = 0, totalSold = 0, totalRestockedReturns = 0, totalDefectiveReturns = 0;

          billsToConsider.forEach(bill => {
            bill.items.forEach(item => {
              if (item.productId === p.id) {
                if (bill.type === 'buy') totalPurchased += item.quantity;
                else if (bill.type === 'sell' && !bill.isEstimate) totalSold += item.quantity;
                else if (bill.type === 'return') {
                  if (item.isDefective) totalDefectiveReturns += item.quantity;
                  else totalRestockedReturns += item.quantity;
                }
              }
            });
          });
          const currentStock = p.trackQuantity ? p.productSKUs.reduce((sum, sku) => sum + (get().getSkuDetails(sku).totalStock ?? 0), 0) : 'N/A';
          return {
            productId: p.id, productName: p.name, category: p.category,
            totalPurchased, totalSold, totalRestockedReturns, totalDefectiveReturns,
            currentStock,
          };
        });
        return ledger;
      },
      getProductFinancialsByMonth: (productId) => {
        const productBills = get().bills.filter(b => b.items.some(i => i.productId === productId));
        const monthlyData: Record<string, { revenue: number; cogs: number }> = {};
        productBills.forEach(bill => {
          if (bill.type !== 'sell' || bill.isEstimate) return;
          const monthKey = format(new Date(bill.date), 'MMM yyyy');
          if (!monthlyData[monthKey]) monthlyData[monthKey] = { revenue: 0, cogs: 0 };
          bill.items.forEach(item => {
            if (item.productId === productId) {
              monthlyData[monthKey].revenue += item.sellPrice * item.quantity;
              monthlyData[monthKey].cogs += (item.costPrice || 0) * item.quantity;
            }
          });
        });
        const sortedKeys = Object.keys(monthlyData).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        return sortedKeys.map(key => ({ month: key, revenue: monthlyData[key].revenue, cogs: monthlyData[key].cogs, profit: monthlyData[key].revenue - monthlyData[key].cogs }));
      },
      getReportSummaryByDateRange: (startDate, endDate, companyId, storeId) => {
        const bills = get().bills.filter(b => (!companyId || b.companyId === companyId) && (!storeId || storeId === 'all' || b.storeId === storeId) && (!startDate || new Date(b.date) >= startDate) && (!endDate || new Date(b.date) <= endDate));
        let totalRevenue = 0, totalCOGS = 0, totalExpenses = 0, totalItemsSold = 0, totalSGST = 0, totalCGST = 0, totalAdditionalCharges = 0;
        bills.forEach(bill => {
          if (bill.type === 'sell' && !bill.isEstimate) {
            totalRevenue += bill.subTotal ?? 0;
            totalSGST += bill.totalSGST ?? 0;
            totalCGST += bill.totalCGST ?? 0;
            bill.items.forEach(item => {
              if (!item.isAdditionalCharge) {
                totalCOGS += (item.costPrice || 0) * item.quantity;
                totalItemsSold += item.quantity;
              } else {
                totalAdditionalCharges += (item.sellPrice || 0) * item.quantity;
              }
            });
          } else if (bill.type === 'buy') totalExpenses += bill.totalAmount;
        });
        return {
          totalRevenue, totalCOGS, grossProfit: totalRevenue - totalCOGS, totalExpenses,
          netProfit: totalRevenue - totalCOGS - totalExpenses, totalBills: bills.length,
          totalItemsSold, totalSGST, totalCGST, totalTax: totalSGST + totalCGST,
          totalAdditionalCharges
        };
      },
      getSalesBillsByDateRange: (startDate, endDate, companyId) => {
        return get().bills.filter(b => b.type === 'sell' && !b.isEstimate && (!companyId || b.companyId === companyId) && (!startDate || new Date(b.date) >= startDate) && (!endDate || new Date(b.date) <= endDate));
      },
      getExpenseBillsByDateRange: (startDate, endDate, companyId) => {
        return get().bills.filter(b => b.type === 'buy' && (!companyId || b.companyId === companyId) && (!startDate || new Date(b.date) >= startDate) && (!endDate || new Date(b.date) <= endDate));
      },
      getAccountsReceivableSummary: (companyId, storeId) => {
        const unpaidInvoices = get().bills.filter(b => b.type === 'sell' && !b.isEstimate && b.paymentStatus === 'unpaid' && (!companyId || b.companyId === companyId) && (!storeId || storeId === 'all' || b.storeId === storeId));
        return { totalReceivable: unpaidInvoices.reduce((sum, b) => sum + b.totalAmount, 0), unpaidInvoices };
      },
      getAccountsPayableSummary: (companyId, storeId) => {
        const unpaidBills = get().bills.filter(b => b.type === 'buy' && b.paymentStatus === 'unpaid' && (!companyId || b.companyId === companyId) && (!storeId || storeId === 'all' || b.storeId === storeId));
        return { totalPayable: unpaidBills.reduce((sum, b) => sum + b.totalAmount, 0), unpaidBills };
      },
      getCashFlowSummaryByDateRange: (startDate, endDate, companyId, storeId) => {
        const bills = get().bills.filter(b => (!companyId || b.companyId === companyId) && (!storeId || storeId === 'all' || b.storeId === storeId) && (!startDate || new Date(b.date) >= startDate) && (!endDate || new Date(b.date) <= endDate));
        const cashInflows = bills.filter(b => b.type === 'sell' && !b.isEstimate && b.paymentStatus === 'paid').reduce((sum, b) => sum + b.totalAmount, 0);
        const cashOutflows = bills.filter(b => b.type === 'buy' && b.paymentStatus === 'paid').reduce((sum, b) => sum + b.totalAmount, 0);
        return { cashInflows, cashOutflows, netCashFlow: cashInflows - cashOutflows };
      },
      getDailyLedger: (date, companyId, storeId) => {
        const { bills, manualEntries } = get();
        const dateKey = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
        const ledgers = getDailyLedgers(bills, manualEntries, dateKey, dateKey, { companyId, storeId });
        return ledgers[0];
      },
      getDailyLedgersByDateRange: (startDate, endDate, companyId, storeId) => {
        const { bills, manualEntries } = get();
        const fromKey = startDate ? (typeof startDate === 'string' ? startDate : format(startDate, 'yyyy-MM-dd')) : format(new Date(0), 'yyyy-MM-dd');
        const toKey = endDate ? (typeof endDate === 'string' ? endDate : format(endDate, 'yyyy-MM-dd')) : format(new Date(), 'yyyy-MM-dd');
        return getDailyLedgers(bills, manualEntries, fromKey, toKey, { companyId, storeId });
      },
      getBalanceSheetSummary: (companyId, storeId) => {
        const { products, getAccountsReceivableSummary, getAccountsPayableSummary, getReportSummaryByDateRange } = get();
        const prods = companyId ? products.filter(p => p.companyId === companyId) : products;
        const inventoryValue = prods.reduce((total, p) => {
          if (!p.trackQuantity) return total;
          return total + p.productSKUs.reduce((skuSum, sku) => {
            const layers = (!storeId || storeId === 'all') ? sku.stockLayers : sku.stockLayers.filter(l => l.storeId === storeId);
            return skuSum + layers.reduce((layerSum, l) => layerSum + (l.quantity * l.costPrice), 0);
          }, 0);
        }, 0);
        const { totalReceivable } = getAccountsReceivableSummary(companyId, storeId);
        const { totalPayable } = getAccountsPayableSummary(companyId, storeId);
        const { netProfit: retainedEarnings } = getReportSummaryByDateRange(undefined, undefined, companyId, storeId);
        return { inventoryValue, accountsReceivable: totalReceivable, accountsPayable: totalPayable, retainedEarnings };
      },
      // #endregion
    }),
    {
      name: 'stockflow-app-storage',
      storage: createJSONStorage(() => localStorage),
      version: 3, // Incremented version to handle state changes
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3) {
          // If the stored version is old, discard it and return the initial state.
          // This will prevent any migration errors for users with an outdated storage format.
          console.warn("Zustand store version mismatch. Discarding old state.");
          return storeInitialState;
        }
        return persistedState as InventoryState;
      },
    }
  )
);
