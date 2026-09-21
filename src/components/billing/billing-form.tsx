
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { useScannerBridge } from '@/hooks/use-scanner-bridge';
import { ScannerBridgeStatus } from '@/components/common/ScannerBridgeStatus';
import { BillingHeader } from './billing-header';
import { BillingProductSelector } from './billing-product-selector';
import { BillingItemsTable } from './billing-items-table';
import { BillingSummary } from './billing-summary';
import { calculateItemTax, calculateBillTotals } from './billing-utils';
import { ProductSearchSuggestion } from './product-search-input';
import { BillSaveAnimation } from './bill-save-animation';
import { EmployeePasskeyDialog } from './employee-passkey-dialog';
import { NewProductDialog } from './new-product-dialog';
import { UnifiedScannerModal } from '@/components/common/UnifiedScannerModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { generatePrintContent, triggerPrint } from '@/lib/print-utils';
import { Printer } from 'lucide-react';
import type { Product, BillItem, BillMode, ProductSKU, Store, Staff, Bill, PendingBillPayload } from '@/types';
import { SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import { format } from 'date-fns';
import { getReturnableQuantity, computeReturnRefundAmount } from '@/lib/return-utils';

interface BillingFormProps {
  storeId?: string;
  allowedModes?: BillMode[];
  initialModeProp?: BillMode | null;
  isAdminContext?: boolean;
  preselectedStoreId?: string | null;
  companyId?: string | null;
  redirectBasePath?: string;
}

export function BillingForm({
  storeId: storeIdFromProp,
  allowedModes,
  initialModeProp,
  isAdminContext = false,
  preselectedStoreId,
  companyId: companyIdFromProp,
  redirectBasePath,
}: BillingFormProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();
  const pathname = usePathname();
  const { toast } = useToast();

  const {
    addBill, searchProducts, getProductById, getAllStores,
    findOrCreateProductSKU, getSkuDetails,
    getActiveSubscriptionPlan, userProfile, products: allProductsStoreHook,
    updateProduct: updateProductInStore,
    draftBill, setDraftBill, clearDraftBill,
    bills: allBills
  } = useInventoryStore();

  const companyId = companyIdFromProp || localStorage.getItem('companyId') || "comp_default_001";
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [activePlan, setActivePlan] = useState<ReturnType<typeof getActiveSubscriptionPlan>>(undefined);
  const [hasMounted, setHasMounted] = useState(false);

  // Bill State
  const [mode, setMode] = useState<BillMode>('sell');
  const [isEstimateMode, setIsEstimateMode] = useState(false);
  const [taxType, setTaxType] = useState<'intra-state' | 'inter-state'>('intra-state');
  const [billDate, setBillDate] = useState<Date | undefined>(new Date());

  const [selectedStoreIdForAdmin, setSelectedStoreIdForAdmin] = useState<string | undefined>(undefined);

  // Customer / Vendor Details
  const [customerVendorName, setCustomerVendorName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [notes, setNotes] = useState('');
  const [isPaid, setIsPaid] = useState(true);

  // Product Selection State
  const [productNameQuery, setProductNameQuery] = useState('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [costPrice, setCostPrice] = useState<number | string>('');
  const [sellPrice, setSellPrice] = useState<number | string>('');

  const [currentProductForSelection, setCurrentProductForSelection] = useState<Product | null>(null);
  const [currentSkuStock, setCurrentSkuStock] = useState<number | null>(null);
  const [currentSkuSellPrice, setCurrentSkuSellPrice] = useState<number | null>(null);
  const [isDisplayingLayerStock, setIsDisplayingLayerStock] = useState(false);
  const [selectedVariantOptions, setSelectedVariantOptions] = useState<Record<string, string>>({});

  const [returnItemIsDefective, setReturnItemIsDefective] = useState(false);
  // Optional source sale bill this return/exchange settles against.
  const [returnSourceBillId, setReturnSourceBillId] = useState<string>('');
  const [productNotFoundHint, setProductNotFoundHint] = useState('');
  const [isLoadingProductSearch, setIsLoadingProductSearch] = useState(false);

  // Items State
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);

  // Pending stock deductions (for real-time display before bill is saved)
  const pendingStockDeductions = useMemo(() => {
    const deductions: Record<string, number> = {};
    if (mode === 'sell' && !isEstimateMode) {
      currentBillItems.forEach(item => {
        if (!item.isAdditionalCharge && !item.productId.startsWith('SERVICE_ITEM_')) {
          const key = `${item.productId}_${JSON.stringify(item.selectedVariantOptions || {})}`;
          deductions[key] = (deductions[key] || 0) + item.quantity;
        }
      });
    }
    return deductions;
  }, [currentBillItems, mode, isEstimateMode]);

  // Dialogs & Process State
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAnimationVisible, setIsSavingAnimationVisible] = useState(false);
  const [lastSavedBillMode, setLastSavedBillMode] = useState<BillMode | null>(null);
  const [lastSavedBillIsEstimate, setLastSavedBillIsEstimate] = useState<boolean>(false);

  const [isVerifyEmployeeDialogOpen, setIsVerifyEmployeeDialogOpen] = useState(false);
  const [pendingBillPayload, setPendingBillPayload] = useState<PendingBillPayload | null>(null);

  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false);
  const [newProductDialogInitialValues, setNewProductDialogInitialValues] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [billToPotentiallyPrint, setBillToPotentiallyPrint] = useState<Bill | null>(null);
  const [isPrintConfirmDialogOpen, setIsPrintConfirmDialogOpen] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerPurpose, setScannerPurpose] = useState<'addItem' | 'updateProductSku' | null>(null);
  const [productToUpdateSkuFor, setProductToUpdateSkuFor] = useState<Product | null>(null);

  // Track product IDs created during this billing session
  const newlyCreatedProductIdsRef = useRef<Set<string>>(new Set());

  // Refs
  const productNameInputRef = useRef<HTMLInputElement>(null);

  // Initialization
  useEffect(() => {
    setHasMounted(true);
    setAllStores(getAllStores());
    setActivePlan(getActiveSubscriptionPlan());
  }, [getAllStores, getActiveSubscriptionPlan]);

  // Initialize mode from initialModeProp if provided and allowed
  useEffect(() => {
    if (initialModeProp) {
      if (!allowedModes || allowedModes.includes(initialModeProp)) {
        setMode(initialModeProp);
      }
    }
  }, [initialModeProp, allowedModes]);

  // Initialize admin store selection from preselectedStoreId
  useEffect(() => {
    if (isAdminContext && preselectedStoreId) {
      setSelectedStoreIdForAdmin(preselectedStoreId);
    }
  }, [isAdminContext, preselectedStoreId]);

  const finalStoreIdForSkuDetails = useMemo(() => {
    return isAdminContext ? selectedStoreIdForAdmin : storeIdFromProp;
  }, [isAdminContext, selectedStoreIdForAdmin, storeIdFromProp]);

  // Sale bills the current return/exchange can be settled against: only real,
  // company-matched sales for this store that still have returnable quantity.
  const returnableSaleBills = useMemo(() => {
    if (mode !== 'return') return [];
    return allBills.filter(b =>
      b.type === 'sell' && !b.isEstimate && b.companyId === companyId &&
      (!finalStoreIdForSkuDetails || finalStoreIdForSkuDetails === 'all' || b.storeId === finalStoreIdForSkuDetails) &&
      b.items.some(i => (!i.productId.startsWith('SERVICE_ITEM_') && !i.productId.startsWith('CHARGE_ITEM_')) && getReturnableQuantity(i) > 0)
    );
  }, [mode, allBills, companyId, finalStoreIdForSkuDetails]);

  const returnSourceBill = useMemo(
    () => returnSourceBillId ? allBills.find(b => b.id === returnSourceBillId) || null : null,
    [returnSourceBillId, allBills]
  );

  // How much of an item line is still returnable against the selected source bill.
  const getReturnableLimitFor = useCallback((item: BillItem): number => {
    if (mode !== 'return' || item.isAdditionalCharge || item.productId.startsWith('SERVICE_ITEM_')) return 0;
    if (!returnSourceBill) return Infinity;
    const originalItem = returnSourceBill.items.find(i => i.productId === item.productId &&
      JSON.stringify(i.selectedVariantOptions || {}) === JSON.stringify(item.selectedVariantOptions || {}));
    return originalItem ? getReturnableQuantity(originalItem) : 0;
  }, [mode, returnSourceBill]);

  const returnRefundPreview = useMemo(() => {
    if (mode !== 'return' || currentBillItems.length === 0) return 0;
    return computeReturnRefundAmount(currentBillItems);
  }, [mode, currentBillItems]);

  // Pre-select the original sale bill when arriving via ?mode=return&returnBillId=...
  useEffect(() => {
    if (mode === 'return') {
      const billIdFromQuery = searchParamsHook.get('returnBillId');
      if (billIdFromQuery) setReturnSourceBillId(billIdFromQuery);
    }
  }, [mode, searchParamsHook]);

  // Totals Calculation
  const billTotals = useMemo(() => {
    return calculateBillTotals(currentBillItems, mode, isEstimateMode, taxType);
  }, [currentBillItems, mode, isEstimateMode, taxType]);

  // Helper: recalculate tax amounts & discount for a single bill item
  const recalculateItemTaxes = useCallback((item: BillItem): BillItem => {
    if (mode === 'buy' || item.isAdditionalCharge || item.productId.startsWith('SERVICE_ITEM_')) {
      return item;
    }
    const product = getProductById(item.productId);
    const { sgst, cgst, igst, discountAmount } = calculateItemTax(
      item,
      item.quantity,
      item.sellPrice,
      item.discountValue || 0,
      item.discountType || 'amount',
      taxType,
      product
    );
    return {
      ...item,
      sgstAmount: sgst,
      cgstAmount: cgst,
      igstAmount: igst,
      discountAmount,
    };
  }, [mode, taxType, getProductById]);

  // Recalculate all items when taxType changes (e.g. toggling IGST on/off)
  useEffect(() => {
    if (mode !== 'sell') return;
    setCurrentBillItems(prev => prev.map(item => recalculateItemTaxes(item)));
  }, [taxType, mode, recalculateItemTaxes]);

  // Product Selection Helpers
  const updateSkuDisplayInfo = useCallback((skuToUse?: ProductSKU, productForSku?: Product | null) => {
    const productForDisplay = productForSku ?? currentProductForSelection;
    if (skuToUse && productForDisplay) {
      const details = getSkuDetails(skuToUse, finalStoreIdForSkuDetails);
      setCurrentSkuStock(productForDisplay.trackQuantity ? details.totalStock : null);
      setIsDisplayingLayerStock(false);
      setCurrentSkuSellPrice(details.currentSellPrice);
      if (mode === 'sell' || mode === 'return') {
        setSellPrice(details.currentSellPrice !== null ? details.currentSellPrice.toString() : '');
      } else if (mode === 'buy') {
        setCostPrice('');
        setSellPrice(details.currentSellPrice !== null ? details.currentSellPrice.toString() : '');
      }
    } else {
      // Logic for no SKU or cleared selection
      setCurrentSkuStock(null);
      setIsDisplayingLayerStock(false);
      setCurrentSkuSellPrice(null);
      setSellPrice('');
      if (mode === 'buy') setCostPrice('');
    }
  }, [getSkuDetails, mode, currentProductForSelection, finalStoreIdForSkuDetails]);

  const handleProductSelectFromSearch = useCallback((suggestion: ProductSearchSuggestion) => {
    const { product, sku, layer } = suggestion;
    setCurrentProductForSelection(product);

    if (sku) {
      const skuDetailsToUse = getSkuDetails(sku, finalStoreIdForSkuDetails);
      setProductNameQuery(skuDetailsToUse.skuIdentifier || product.name);
      setSelectedVariantOptions(sku.optionValues || {});

      if (mode === 'sell' && product.trackQuantity && layer && typeof layer.quantity === 'number') {
        setCurrentSkuStock(layer.quantity);
        setIsDisplayingLayerStock(true);
        setCurrentSkuSellPrice(layer.sellPrice);
        setSellPrice(layer.sellPrice.toString());
      } else {
        updateSkuDisplayInfo(sku, product);
      }
    } else {
      setProductNameQuery(product.name);
      setSelectedVariantOptions({});
      updateSkuDisplayInfo(undefined, product);
    }
    setProductNotFoundHint('');
    // Focus logic can be handled inside the selector component or here if complex
  }, [getSkuDetails, mode, finalStoreIdForSkuDetails, updateSkuDisplayInfo]);

  const handleAddNewItem = () => {
    const currentQ = typeof quantity === 'string' ? parseFloat(quantity) || 1 : quantity;
    if (!currentProductForSelection) {
      toast({ variant: "destructive", title: "Select Product", description: "Please select a product first." });
      return;
    }

    // Detailed validation logic from original file...
    const product = currentProductForSelection;
    const selectedOpts = (product.variants && product.variants.length > 0) ? selectedVariantOptions : {};
    const targetSkuFromStore = findOrCreateProductSKU(product.id, selectedOpts);

    // Stock validation for sell mode
    if (mode === 'sell' && product.trackQuantity && currentSkuStock !== null) {
      const pendingKey = `${product.id}_${JSON.stringify(selectedOpts)}`;
      const pendingQty = pendingStockDeductions[pendingKey] || 0;
      const remaining = currentSkuStock - pendingQty;
      if (currentQ > remaining) {
        toast({ variant: "destructive", title: "Insufficient Stock", description: `Only ${remaining} units available (stock: ${currentSkuStock}, already in bill: ${pendingQty}).` });
        return;
      }
    }

    // Return/exchange mode: the item must exist on the selected sale bill and the
    // quantity must not exceed what is still returnable there.
    if (mode === 'return') {
      if (!returnSourceBill) {
        toast({ variant: "destructive", title: "Select Sale Bill", description: "Pick the original sale bill you are returning against." });
        return;
      }
      const originalItem = returnSourceBill.items.find(i => i.productId === product.id &&
        JSON.stringify(i.selectedVariantOptions || {}) === JSON.stringify(selectedOpts));
      if (!originalItem) {
        toast({ variant: "destructive", title: "Not on Bill", description: `"${product.name}" is not on the selected sale bill (${returnSourceBill.invoiceNumber || returnSourceBill.id}).` });
        return;
      }
      const remaining = getReturnableQuantity(originalItem);
      if (currentQ > remaining) {
        toast({ variant: "destructive", title: "Over Return", description: `Only ${remaining} of "${product.name}" left to return/exchange (already handled ${(originalItem.quantity || 0) - remaining}).` });
        return;
      }
    }

    let itemCostPrice = parseFloat(costPrice.toString()) || 0;
    let itemSellPrice = parseFloat(sellPrice.toString()) || currentSkuSellPrice || 0;

    const newItem: BillItem = {
      id: uuidv4(),
      productId: product.id,
      productName: targetSkuFromStore?.skuIdentifier || product.name,
      quantity: currentQ,
      costPrice: itemCostPrice,
      sellPrice: itemSellPrice,
      isDefective: mode === 'return' ? returnItemIsDefective : undefined,
      isExchange: mode === 'return' ? false : undefined,
      selectedVariantOptions: selectedOpts,
      isAdditionalCharge: false
    };

    setCurrentBillItems(prev => [...prev, recalculateItemTaxes(newItem)]);

    // Reset fields
    setProductNameQuery('');
    setQuantity(1);
    setCostPrice('');
    setSellPrice('');
    setCurrentProductForSelection(null);
    setSelectedVariantOptions({});
    productNameInputRef.current?.focus();
  };

  const handleSaveBill = async () => {
    // Save logic similar to original, constructing payload
    if (currentBillItems.length === 0) {
      toast({ variant: "destructive", title: "Empty Bill", description: "Add items first." });
      return;
    }

    const payload: PendingBillPayload = {
      billType: mode,
      items: currentBillItems,
      vendorOrCustomerName: customerVendorName,
      customerPhone: customerPhone,
      notes: notes,
      isEstimate: isEstimateMode,
      taxType: taxType,
      date: billDate?.toISOString(),
      storeIdForBill: isAdminContext ? selectedStoreIdForAdmin : storeIdFromProp,
      paymentStatus: isPaid ? 'paid' : 'unpaid',
      originalBillId: mode === 'return' ? (returnSourceBillId || undefined) : undefined,
      skipStockProductIds: newlyCreatedProductIdsRef.current.size > 0
        ? Array.from(newlyCreatedProductIdsRef.current)
        : undefined,
      // gstin: gstin // TODO: Add to payload type if needed for backend
    };

    if (!isAdminContext && storeIdFromProp) {
      setPendingBillPayload(payload);
      setIsVerifyEmployeeDialogOpen(true);
    } else {
      // Admin save
      // ...
      await startSaveProcess('admin_self', payload);
    }
  };

  const startSaveProcess = async (staffId: string, payload: PendingBillPayload) => {
    setIsSaving(true);
    try {
      const savedBill = await addBill({
        ...payload,
        type: payload.billType,
        storeId: payload.storeIdForBill,
        companyId: companyId,
        billedByStaffId: staffId
      } as any, payload.items); // Type assertions/conversions as needed

      if (savedBill) {
        setBillToPotentiallyPrint(savedBill);
        setIsPrintConfirmDialogOpen(true);
        setLastSavedBillMode(savedBill.type);
        setIsSavingAnimationVisible(true);
        resetFullForm();
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save bill." });
    } finally {
      setIsSaving(false);
    }
  };

  const resetFullForm = () => {
    setCurrentBillItems([]);
    setCustomerVendorName('');
    setCustomerPhone('');
    setGstin('');
    setNotes('');
    setIsPaid(true);
    setProductNameQuery('');
    setQuantity(1);
    setCostPrice('');
    setSellPrice('');
    setCurrentProductForSelection(null);
    setCurrentSkuStock(null);
    setCurrentSkuSellPrice(null);
    setIsDisplayingLayerStock(false);
    setSelectedVariantOptions({});
    setReturnItemIsDefective(false);
    setReturnSourceBillId('');
    setProductNotFoundHint('');
    newlyCreatedProductIdsRef.current.clear();
  };

  const handleProductNameSubmit = (val: string) => {
    const trimmedValue = val.trim();
    if (!trimmedValue) {
      return;
    }

    setNewProductDialogInitialValues({
      name: trimmedValue,
      quantity: quantity ? String(quantity) : undefined,
      costPrice: costPrice !== '' ? String(costPrice) : undefined,
      sellPrice: sellPrice !== '' ? String(sellPrice) : undefined,
    });
    setProductNotFoundHint('');
    setIsNewProductDialogOpen(true);
  };

  // Auto-add a product when the desktop scanner bridge pushes a barcode/QR scan.
  // Exact SKU match is preferred; otherwise the first search hit is used. If no
  // product matches, the scanned code is offered as a new product (SKU) instead.
  const handleBridgeScannedCode = useCallback((code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase();
    const matches = searchProducts(trimmed);
    const exactMatch = matches.find(p =>
      (p.sku || '').toLowerCase() === lower ||
      p.productSKUs.some(s => (s.skuIdentifier || '').toLowerCase() === lower)
    );
    const candidate = exactMatch || matches[0];

    if (!candidate) {
      setNewProductDialogInitialValues({
        name: trimmed,
        quantity: quantity ? String(quantity) : undefined,
        costPrice: costPrice !== '' ? String(costPrice) : undefined,
        sellPrice: sellPrice !== '' ? String(sellPrice) : undefined,
      });
      setProductNotFoundHint(trimmed);
      setIsNewProductDialogOpen(true);
      setProductNameQuery(trimmed);
      toast({ variant: "destructive", title: "No Product for Barcode", description: `No product found for "${trimmed}". Create it, or generate/link a barcode from the scanner bridge portal.` });
      return;
    }

    const sku = findOrCreateProductSKU(candidate.id, {});
    const skuDetails = getSkuDetails(sku, finalStoreIdForSkuDetails);
    const sell = skuDetails.currentSellPrice;

    if (mode === 'sell' && candidate.trackQuantity && skuDetails.totalStock !== null && skuDetails.totalStock <= 0) {
      toast({ variant: "destructive", title: "Out of Stock", description: `${candidate.name} has no stock available.` });
      return;
    }

    const newItem: BillItem = {
      id: uuidv4(),
      productId: candidate.id,
      productName: sku?.skuIdentifier || candidate.name,
      quantity: 1,
      costPrice: skuDetails.averageCostPrice ?? 0,
      sellPrice: sell ?? 0,
      selectedVariantOptions: {},
      isAdditionalCharge: false,
    };

    setCurrentProductForSelection(candidate);
    setProductNameQuery(sku?.skuIdentifier || candidate.name);
    setSelectedVariantOptions({});
    setCurrentSkuSellPrice(sell);
    setCurrentSkuStock(candidate.trackQuantity ? skuDetails.totalStock : null);
    if (sell !== null) setSellPrice(String(sell));

    setCurrentBillItems(prev => [...prev, recalculateItemTaxes(newItem)]);

    setProductNameQuery('');
    setQuantity(1);
    setCostPrice('');
    setSellPrice('');
    setCurrentProductForSelection(null);
    setSelectedVariantOptions({});
    productNameInputRef.current?.focus();
    toast({ title: "Barcode Added", description: `${candidate.name} added to bill (Qty: 1).` });
  }, [searchProducts, findOrCreateProductSKU, getSkuDetails, finalStoreIdForSkuDetails, mode, recalculateItemTaxes, quantity, costPrice, sellPrice, toast]);

  useScannerBridge(handleBridgeScannedCode);

  const handleQuickProductAdded = (newProduct: Product) => {
    // Track that this product was created during this billing session
    // so addBill won't create duplicate stock layers
    newlyCreatedProductIdsRef.current.add(newProduct.id);

    const defaultSku = newProduct.productSKUs?.[0] || {
      id: `${newProduct.id}_defaultSKU`,
      optionValues: {},
      stockLayers: [],
      skuIdentifier: newProduct.name,
    };
    const skuDetails = getSkuDetails(defaultSku, finalStoreIdForSkuDetails);

    setCurrentProductForSelection(newProduct);
    setProductNameQuery(defaultSku.skuIdentifier || newProduct.name);
    setSelectedVariantOptions(defaultSku.optionValues || {});
    setCurrentSkuStock(newProduct.trackQuantity ? (skuDetails.totalStock ?? 0) : null);
    setIsDisplayingLayerStock(false);
    setCurrentSkuSellPrice(skuDetails.currentSellPrice);
    if (skuDetails.currentSellPrice !== null) {
      setSellPrice(String(skuDetails.currentSellPrice));
    }
    setProductNotFoundHint('');
  };

  return (
    <div className="flex flex-col gap-6">
      <BillSaveAnimation
        show={isSavingAnimationVisible}
        billMode={lastSavedBillMode}
        isEstimate={lastSavedBillIsEstimate}
        onClose={() => setIsSavingAnimationVisible(false)}
      />

      {/* Dialogs */}
      <AlertDialog open={isPrintConfirmDialogOpen} onOpenChange={setIsPrintConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Print Bill?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsPrintConfirmDialogOpen(false)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIsPrintConfirmDialogOpen(false);
              if (billToPotentiallyPrint) {
                const content = generatePrintContent(billToPotentiallyPrint, userProfile, allProductsStoreHook);
                triggerPrint(content);
              }
            }}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(!isAdminContext && storeIdFromProp) && (
        <EmployeePasskeyDialog
          isOpen={isVerifyEmployeeDialogOpen}
          onOpenChange={setIsVerifyEmployeeDialogOpen}
          storeId={storeIdFromProp}
          companyId={companyId}
          onAuthenticated={(staff) => {
            if (pendingBillPayload) startSaveProcess(staff.id, pendingBillPayload);
            setIsVerifyEmployeeDialogOpen(false);
          }}
        />
      )}

      <NewProductDialog
        isOpen={isNewProductDialogOpen}
        onOpenChange={(open) => {
          setIsNewProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        initialValues={newProductDialogInitialValues}
        onProductAdded={handleQuickProductAdded}
        editingProduct={editingProduct}
      />

      {/* Scanner bridge status */}
      <div className="flex justify-end">
        <ScannerBridgeStatus />
      </div>

      {/* Main UI */}
      <BillingHeader
        mode={mode} setMode={setMode}
        allowedModes={allowedModes}
        customerVendorName={customerVendorName} setCustomerVendorName={setCustomerVendorName}
        customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
        gstin={gstin} setGstin={setGstin}
        billDate={billDate} setBillDate={setBillDate}
        isAdminContext={isAdminContext} allStores={allStores} activePlan={activePlan}
        selectedStoreIdForAdmin={selectedStoreIdForAdmin} setSelectedStoreIdForAdmin={setSelectedStoreIdForAdmin as any}
        isEstimateMode={isEstimateMode} setIsEstimateMode={setIsEstimateMode}
        taxType={taxType} setTaxType={setTaxType}
      />

      <div className="flex flex-col border shadow-sm rounded-lg bg-card p-4">
        {mode === 'return' && (
          <div className="mb-3 space-y-2 border rounded-md p-3 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="returnSourceBill" className="text-sm font-medium">
                  Return / Exchange Against (Original Sale Bill)
                </Label>
                <Select value={returnSourceBillId} onValueChange={setReturnSourceBillId}>
                  <SelectTrigger id="returnSourceBill">
                    <SelectValue placeholder="Select the original sale bill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {returnableSaleBills.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No sale bills available to return against.</div>
                    )}
                    {returnableSaleBills.map(bill => (
                      <SelectItem key={bill.id} value={bill.id}>
                        #{bill.invoiceNumber || bill.id} · {bill.vendorOrCustomerName || 'Walk-in Customer'} · {format(new Date(bill.date), 'dd MMM yyyy')} · ₹{bill.totalAmount.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {returnSourceBill && (
                <div className="space-y-1.5 text-sm">
                  {returnSourceBill.items.some(i => getReturnableQuantity(i) > 0) ? (
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {returnSourceBill.items.filter(i => getReturnableQuantity(i) > 0).map(i => (
                        <span key={i.id}>{i.productName} — {getReturnableQuantity(i)} left</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600">All items on this bill are already fully returned/exchanged.</div>
                  )}
                  <div className="text-sm">
                    {currentBillItems.length > 0 && (
                      <>
                        <span className="text-muted-foreground">Refund credited back to customer: </span>
                        <span className="font-semibold text-primary">₹{returnRefundPreview.toFixed(2)}</span>
                        {currentBillItems.some(i => i.isExchange) && (
                          <span className="text-muted-foreground">
                            {' '}(exchanged lines — no money back)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <BillingProductSelector
          mode={mode}
          productNameQuery={productNameQuery} setProductNameQuery={setProductNameQuery}
          isLoadingProductSearch={isLoadingProductSearch}
          currentProductForSelection={currentProductForSelection} setCurrentProductForSelection={setCurrentProductForSelection}
          selectedVariantOptions={selectedVariantOptions} setSelectedVariantOptions={setSelectedVariantOptions}
          quantity={quantity} setQuantity={setQuantity}
          costPrice={costPrice} setCostPrice={setCostPrice}
          sellPrice={sellPrice} setSellPrice={setSellPrice}
          currentSkuStock={currentSkuStock} currentSkuSellPrice={currentSkuSellPrice} isDisplayingLayerStock={isDisplayingLayerStock}
          pendingStockDeductions={pendingStockDeductions}
          onAddProduct={handleAddNewItem}
          onScannerClick={() => setIsScannerOpen(true)}
          onEditProductClick={() => {
            if (currentProductForSelection) {
              setEditingProduct(currentProductForSelection);
              setIsNewProductDialogOpen(true);
            }
          }}
          productNotFoundHint={productNotFoundHint}
          handleProductSelectFromSearch={handleProductSelectFromSearch}
          handleProductNameSubmit={handleProductNameSubmit}
          finalStoreIdForSkuDetails={finalStoreIdForSkuDetails}
          returnItemIsDefective={returnItemIsDefective} setReturnItemIsDefective={setReturnItemIsDefective}
          productNameInputRef={productNameInputRef}
        />

        <BillingItemsTable
          items={currentBillItems}
          mode={mode}
          isEstimateMode={isEstimateMode}
          taxType={taxType}
          updateQuantity={(id, qty) => {
            setCurrentBillItems(prev => prev.map(item => {
              if (item.id !== id) return item;
              const limit = getReturnableLimitFor(item);
              const safeQty = Number.isFinite(limit) ? Math.max(0.01, Math.min(qty || 0, limit)) : Math.max(0.01, qty || 0);
              return recalculateItemTaxes({ ...item, quantity: safeQty });
            }));
          }}
          updatePrice={(id, price, type) => {
            setCurrentBillItems(prev => prev.map(item => {
              if (item.id !== id) return item;
              const updated = type === 'cost'
                ? { ...item, costPrice: price }
                : { ...item, sellPrice: price };
              return recalculateItemTaxes(updated);
            }));
          }}
          updateDiscount={(id, val, type) => {
            setCurrentBillItems(prev => prev.map(item => {
              if (item.id !== id) return item;
              return recalculateItemTaxes({
                ...item,
                discountValue: val || 0,
                discountType: type,
              });
            }));
          }}
          updateItemFlag={(id, flag) => {
            setCurrentBillItems(prev => prev.map(item => {
              if (item.id !== id) return item;
              if (flag === 'isExchange') return recalculateItemTaxes({ ...item, isExchange: !item.isExchange });
              return item;
            }));
          }}
          removeItem={(id) => setCurrentBillItems(prev => prev.filter(i => i.id !== id))}
          onEnterPress={() => productNameInputRef.current?.focus()}
        />

        <BillingSummary
          totals={billTotals}
          mode={mode}
          notes={notes} setNotes={setNotes}
          onSave={handleSaveBill}
          isSaving={isSaving}
        />
      </div>
    </div>
  );
}
