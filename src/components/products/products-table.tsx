
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MoreHorizontal, Edit3, Trash2, PlusCircle, ArrowUpDown, PackageSearch, ExternalLink, Archive, ArchiveRestore } from 'lucide-react';
import type { Product, ProductSKU } from '@/types';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { formatQuantity } from '@/lib/units';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import { getCurrencySymbol } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type SortableColumns = 'name' | 'category' | 'stock' | 'costPrice' | 'sellPrice' | 'sku' | 'expiryDate';

export function ProductsTable() {
  const { 
    products, 
    archiveProduct,
    unarchiveProduct, 
    getSkuDetails,
    getActiveSubscriptionPlan,
    userProfile 
  } = useInventoryStore(
    (state) => ({
      products: state.products,
      archiveProduct: state.archiveProduct,
      unarchiveProduct: state.unarchiveProduct,
      getSkuDetails: state.getSkuDetails,
      getActiveSubscriptionPlan: state.getActiveSubscriptionPlan,
      userProfile: state.userProfile,
    })
  );
  const { toast } = useToast();
  const { ensureLoaded } = useAppData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumns; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
  const [isLoading, setIsLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [activePlan, setActivePlan] = useState<ReturnType<typeof getActiveSubscriptionPlan>>(undefined);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    setCurrencySymbol(getCurrencySymbol(userProfile.companyCurrency));
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedCompanyId) {
      setCompanyId(storedCompanyId);
    } else {
      console.error("Company ID not found for fetching products.");
      setIsLoading(false);
    }
  }, [userProfile.companyCurrency]);

  useEffect(() => {
    if (hasMounted) {
       setActivePlan(getActiveSubscriptionPlan());
    }
  }, [hasMounted, getActiveSubscriptionPlan]);

  useEffect(() => {
    if (hasMounted && companyId) {
      setIsLoading(true);
      ensureLoaded(['products']).finally(() => setIsLoading(false));
    }
  }, [hasMounted, companyId, ensureLoaded]);


  const filteredAndSortedProducts = useMemo(() => {
    let visibleProducts = showArchived ? products : products.filter(p => !p.isArchived);

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();

      visibleProducts = visibleProducts.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(lowerSearchTerm);
        const categoryMatch = product.category && product.category.toLowerCase().includes(lowerSearchTerm);
        const descriptionMatch = product.description && product.description.toLowerCase().includes(lowerSearchTerm);
        const skuMatch = (product.sku && product.sku.toLowerCase().includes(lowerSearchTerm)) ||
                         product.productSKUs.some(sku => sku.skuIdentifier?.toLowerCase().includes(lowerSearchTerm));

        if (nameMatch || categoryMatch || descriptionMatch || skuMatch) {
          return true;
        }
        
        // Numeric searches for stock and price
        if (product.trackQuantity) {
          const totalStock = product.productSKUs.reduce((sum, sku) => sum + (getSkuDetails(sku).totalStock ?? 0), 0);
          if (totalStock.toString().includes(lowerSearchTerm)) {
            return true;
          }
        }
        
        const prices = product.productSKUs
          .map(sku => getSkuDetails(sku).currentSellPrice)
          .filter(price => typeof price === 'number') as number[];
        
        if (prices.some(price => price.toString().includes(lowerSearchTerm))) {
          return true;
        }

        return false;
      });
    }

    if (sortConfig !== null) {
      visibleProducts.sort((a, b) => {
        let valA, valB;
        if (sortConfig.key === 'stock') {
            valA = a.trackQuantity ? a.productSKUs.reduce((sum, sku) => sum + (getSkuDetails(sku).totalStock ?? 0), 0) : -1; 
            valB = b.trackQuantity ? b.productSKUs.reduce((sum, sku) => sum + (getSkuDetails(sku).totalStock ?? 0), 0) : -1;
        } else if (sortConfig.key === 'costPrice') {
            const costsA = a.productSKUs.map(sku => getSkuDetails(sku).averageCostPrice).filter(p => typeof p === 'number') as number[];
            const costsB = b.productSKUs.map(sku => getSkuDetails(sku).averageCostPrice).filter(p => typeof p === 'number') as number[];
            valA = costsA.length > 0 ? Math.min(...costsA) : Infinity; 
            valB = costsB.length > 0 ? Math.min(...costsB) : Infinity;
        } else if (sortConfig.key === 'sellPrice') {
            const pricesA = a.productSKUs.map(sku => getSkuDetails(sku).currentSellPrice).filter(p => typeof p === 'number') as number[];
            const pricesB = b.productSKUs.map(sku => getSkuDetails(sku).currentSellPrice).filter(p => typeof p === 'number') as number[];
            valA = pricesA.length > 0 ? Math.min(...pricesA) : Infinity;
            valB = pricesB.length > 0 ? Math.min(...pricesB) : Infinity;
        } else if (sortConfig.key === 'sku') {
            valA = a.sku || ''; 
            valB = b.sku || '';
        } else if (sortConfig.key === 'expiryDate') {
            valA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0; 
            valB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        } else {
            valA = a[sortConfig.key as Exclude<SortableColumns, 'stock'|'costPrice'|'sellPrice'|'sku'|'expiryDate'>];
            valB = b[sortConfig.key as Exclude<SortableColumns, 'stock'|'costPrice'|'sellPrice'|'sku'|'expiryDate'>];
        }

        let comparison = 0;
        if (valA === undefined || valA === null || valA === Infinity) comparison = sortConfig.direction === 'ascending' ? 1 : -1; 
        else if (valB === undefined || valB === null || valB === Infinity) comparison = sortConfig.direction === 'ascending' ? -1 : 1;
        else if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }
        
        return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
      });
    }
    return visibleProducts;
  }, [products, searchTerm, sortConfig, getSkuDetails, showArchived]);

  const requestSort = (key: SortableColumns) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleArchiveProduct = async (productId: string, productName: string) => {
    if (!companyId) {
        toast({ variant: "destructive", title: "Error", description: "Company context is missing." });
        return;
    }
    const success = await archiveProduct(productId, companyId);
    if (success) {
        toast({ title: "Product Archived", description: `${productName} has been archived.` });
    } else {
        toast({ variant: "destructive", title: "Archive Failed", description: `Could not archive ${productName}.` });
    }
  };

  const handleUnarchiveProduct = async (productId: string, productName: string) => {
    if (!companyId) {
        toast({ variant: "destructive", title: "Error", description: "Company context is missing." });
        return;
    }
    const success = await unarchiveProduct(productId, companyId);
    if (success) {
        toast({ title: "Product Restored", description: `${productName} is now active again.` });
    } else {
        toast({ variant: "destructive", title: "Restore Failed", description: `Could not restore ${productName}.` });
    }
  };

  const getProductStockDisplay = (product: Product): string | number | JSX.Element => {
    if (!product.trackQuantity) return <span className="text-xs text-muted-foreground">N/A</span>;
    const totalStock = product.productSKUs.reduce((sum, sku) => sum + (getSkuDetails(sku).totalStock ?? 0), 0);
    return formatQuantity(totalStock, product.unit);
  };

  const getProductPriceDisplay = (product: Product, field: 'averageCostPrice' | 'currentSellPrice'): string => {
    if (product.productSKUs.length === 0) return "N/A";
    
    const prices = product.productSKUs.map(sku => getSkuDetails(sku)[field]).filter(price => typeof price === 'number') as number[];
    
    if (prices.length === 0) return "N/A"; 
    
    const allPricesAreZero = prices.every(price => price === 0);
    if (allPricesAreZero && prices.length > 0) return `${currencySymbol}0.00`;

    const validPrices = prices.filter(price => price > 0); 
    if (validPrices.length === 0 && prices.length > 0) return `${currencySymbol}0.00`; 
    if (validPrices.length === 0) return "N/A"; 

    const minPrice = Math.min(...validPrices);
    const maxPrice = Math.max(...validPrices);

    if (minPrice === maxPrice) return `${currencySymbol}${minPrice.toFixed(2)}`;
    
    return `${currencySymbol}${minPrice.toFixed(2)} - ${currencySymbol}${maxPrice.toFixed(2)}`;
  };
  
  const canAddProducts = useMemo(() => {
    if (!activePlan) return false;
    const planDetails = SUBSCRIPTION_PLANS.find(p => p.id === activePlan.id);
    if (!planDetails) return false;
    
    const isUnlimited = planDetails.features.some(f => f.toLowerCase().includes("unlimited products") || f.toLowerCase().includes("unlimited items"));
    if (isUnlimited) return true;
    
    return true; 
  }, [activePlan, products.length]);

  const addProductButtonTooltipContent = !canAddProducts && activePlan
    ? `Product limit reached for your current plan (${activePlan.name}). Please upgrade.`
    : "Add New Product";


  if (isLoading && hasMounted) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <LoadingSpinner text="Loading products..." />
      </div>
    );
  }
  if (!companyId && hasMounted) {
     return <div className="flex-1 flex items-center justify-center p-6 text-destructive">Error: Company ID not found. Cannot load products.</div>;
  }


  return (
    <TooltipProvider>
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4 p-4 border rounded-xl bg-card shadow-md">
        <Input
          placeholder="Search (name, category, SKU, stock, price, description)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md w-full md:w-auto h-11 text-base"
        />
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Checkbox id="show-archived" checked={showArchived} onCheckedChange={(checked) => setShowArchived(checked as boolean)} />
            <Label htmlFor="show-archived" className="text-sm font-medium">Show archived</Label>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-block flex-grow md:flex-grow-0">
                <Button 
                  asChild={canAddProducts} 
                  disabled={!canAddProducts}
                  className="w-full md:w-auto h-11 text-base"
                >
                  {canAddProducts ? (
                    <Link href="/admin/products/add">
                      <PlusCircle className="mr-2 h-5 w-5" /> Add Product
                    </Link>
                  ) : (
                    <span>
                      <PlusCircle className="mr-2 h-5 w-5" /> Add Product
                    </span>
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {!canAddProducts && (
              <TooltipContent side="bottom" align="end">
                <p>{addProductButtonTooltipContent}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
      
      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-xl overflow-hidden shadow-xl bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead onClick={() => requestSort('name')} className="cursor-pointer hover:bg-muted/80 py-3 px-4">
                <Tooltip>
                  <TooltipTrigger className="flex items-center">Name <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-70" /></TooltipTrigger>
                  <TooltipContent><p>Sort by Name</p></TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead onClick={() => requestSort('category')} className="cursor-pointer hover:bg-muted/80 py-3 px-4 hidden sm:table-cell">
                <Tooltip>
                  <TooltipTrigger className="flex items-center">Category <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-70" /></TooltipTrigger>
                  <TooltipContent><p>Sort by Category</p></TooltipContent>
                </Tooltip>
              </TableHead>
               <TableHead onClick={() => requestSort('sku')} className="cursor-pointer hover:bg-muted/80 py-3 px-4 hidden md:table-cell">
                <Tooltip>
                  <TooltipTrigger className="flex items-center">Base SKU <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-70" /></TooltipTrigger>
                  <TooltipContent><p>Sort by Base Product SKU</p></TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/80 py-3 px-4" onClick={() => requestSort('stock')}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center w-full justify-end">Stock <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-70" /></TooltipTrigger>
                  <TooltipContent><p>Sort by Stock Quantity</p></TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/80 py-3 px-4 hidden lg:table-cell" onClick={() => requestSort('costPrice')}>
                <Tooltip>
                  <TooltipTrigger className="flex items-center w-full justify-end">Avg. Cost <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-70" /></TooltipTrigger>
                  <TooltipContent><p>Sort by Average Cost Price</p></TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right cursor-pointer hover:bg-muted/80 py-3 px-4" onClick={() => requestSort('sellPrice')}>
                 <Tooltip>
                  <TooltipTrigger className="flex items-center w-full justify-end">Sell Price <ArrowUpDown className="ml-1.5 h-4 w-4 opacity-70" /></TooltipTrigger>
                  <TooltipContent><p>Sort by Current Sell Price</p></TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="py-3 px-4 text-center hidden md:table-cell">Tracked</TableHead>
              <TableHead className="text-right py-3 px-4 w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedProducts.length > 0 ? (
              filteredAndSortedProducts.map((product) => {
                const isVariantProduct = product.variants && product.variants.length > 0;
                return (
                <TableRow key={product.id} className={cn("hover:bg-muted/30", product.isArchived && "bg-secondary/10 opacity-60 hover:opacity-100")}>
                  <TableCell className="font-semibold py-3 px-4 align-top text-foreground">
                    <div>{product.name}</div>
                    {product.isArchived && <Badge variant="destructive" className="mt-1">Archived</Badge>}
                    {isVariantProduct && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Variants: {product.variants?.map(v => `${v.name}`).join(' / ')} ({product.productSKUs.length} SKU(s))
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-3 px-4 align-top hidden sm:table-cell">
                    {product.category ? <Badge variant="secondary" className="bg-tertiary text-tertiary-foreground whitespace-nowrap">{product.category}</Badge> : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="py-3 px-4 align-top font-mono text-xs hidden md:table-cell text-muted-foreground">
                    {product.sku || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 align-top font-medium">
                    {getProductStockDisplay(product)}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 align-top hidden lg:table-cell">
                    {getProductPriceDisplay(product, 'averageCostPrice')}
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 align-top">
                     {getProductPriceDisplay(product, 'currentSellPrice')}
                  </TableCell>
                  <TableCell className="py-3 px-4 align-top text-center hidden md:table-cell">
                     <Badge variant={product.trackQuantity ? "default" : "outline"} className={cn(product.trackQuantity ? "bg-primary/80 hover:bg-primary text-primary-foreground" : "text-muted-foreground border-border", "cursor-default text-xs font-medium")}>
                        {product.trackQuantity ? 'Yes' : 'No'}
                     </Badge>
                  </TableCell>
                  <TableCell className="text-right py-3 px-4 align-top">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-primary">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="shadow-xl">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild className="cursor-pointer">
                          <Link href={`/admin/products/${product.id}`}>
                            <Edit3 className="mr-2 h-4 w-4" /> Edit / View Details
                          </Link>
                        </DropdownMenuItem>
                        {!product.isArchived && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/admin/billing?action=new&mode=buy&prefillProductId=${product.id}${isVariantProduct ? "&isVariant=true": ""}`} target="_blank">
                                <PackageSearch className="mr-2 h-4 w-4" /> New Purchase Bill <ExternalLink className="ml-auto h-3 w-3 opacity-70"/>
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {product.isArchived ? (
                          <DropdownMenuItem onSelect={() => handleUnarchiveProduct(product.id, product.name)} className="text-green-600 focus:text-green-700 focus:bg-green-100 dark:text-green-400 dark:focus:bg-green-700/20 cursor-pointer">
                            <ArchiveRestore className="mr-2 h-4 w-4" /> Unarchive
                          </DropdownMenuItem>
                        ) : (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
                                    <Archive className="mr-2 h-4 w-4" /> Archive
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Archive "{product.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Archiving this product will hide it from new bills and searches, but preserve it for historical records. Are you sure?
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleArchiveProduct(product.id, product.name)} className="bg-amber-600 hover:bg-amber-700">
                                    Yes, Archive Product
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )})
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  {isLoading ? <LoadingSpinner text="Loading products..." size={40} /> : (companyId ? (searchTerm ? "No products match your search." : "No products found. Add some to get started!") : "Company ID not available.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

       {/* Mobile Card View */}
       <div className="md:hidden space-y-3">
        {filteredAndSortedProducts.length > 0 ? (
          filteredAndSortedProducts.map((product) => {
            const isVariantProduct = product.variants && product.variants.length > 0;
            return (
              <Card key={`mobile-${product.id}`} className={cn("shadow-md border-t-2 border-t-primary overflow-hidden", product.isArchived && "bg-secondary/10 opacity-70")}>
                 <CardHeader className="p-3 flex flex-row items-center gap-3 bg-muted/30">
                  <div className="flex-1">
                    <CardTitle className="text-sm font-semibold">{product.name}</CardTitle>
                    {product.category && <Badge variant="secondary" className="text-xs mt-0.5">{product.category}</Badge>}
                  </div>
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                         <DropdownMenuItem asChild><Link href={`/admin/products/${product.id}`}><Edit3 className="mr-2 h-4 w-4" /> Edit / View Details</Link></DropdownMenuItem>
                         {/* Other actions from desktop view can be added here */}
                      </DropdownMenuContent>
                    </DropdownMenu>
                 </CardHeader>
                 <CardContent className="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                   <div className="space-y-0.5">
                     <p className="text-muted-foreground">Stock</p>
                     <p className="font-medium">{getProductStockDisplay(product)}</p>
                   </div>
                   <div className="space-y-0.5">
                     <p className="text-muted-foreground">Sell Price</p>
                     <p className="font-medium">{getProductPriceDisplay(product, 'currentSellPrice')}</p>
                   </div>
                   <div className="space-y-0.5">
                     <p className="text-muted-foreground">Tracked</p>
                     <Badge variant={product.trackQuantity ? "default" : "outline"} className={cn(product.trackQuantity ? "bg-primary/80 hover:bg-primary text-primary-foreground" : "text-muted-foreground border-border", "cursor-default text-xs font-medium")}>{product.trackQuantity ? 'Yes' : 'No'}</Badge>
                   </div>
                   {product.isArchived && (
                     <div className="space-y-0.5 col-span-2">
                       <Badge variant="destructive">Archived</Badge>
                     </div>
                   )}
                 </CardContent>
              </Card>
            )
          })
        ) : (
          <div className="text-center py-10">
            {isLoading ? <LoadingSpinner text="Loading products..." size={40} /> : (searchTerm ? "No products match search" : "No products found.")}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
