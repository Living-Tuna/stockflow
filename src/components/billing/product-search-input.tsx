"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Product, ProductSKU, StockLayer } from '@/types';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { cn } from '@/lib/utils';
import { formatQuantity } from '@/lib/units';

export interface ProductSearchSuggestion {
  product: Product;
  sku: ProductSKU;
  layer?: StockLayer;
  displayInfo: {
    name: string;
    stock: string | number | null;
    price: string;
    category?: string;
  };
}

interface ProductSearchInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onProductSelect: (suggestion: ProductSearchSuggestion) => void;
  onEnterWithoutSelection?: (inputValue: string) => void;
  placeholder?: string;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  id?: string;
  currentMode?: 'sell' | 'buy' | 'return';
}

export function ProductSearchInput({
  value,
  onValueChange,
  onProductSelect,
  onEnterWithoutSelection,
  placeholder = "Type product name...",
  className,
  inputRef,
  id,
  currentMode,
}: ProductSearchInputProps) {
  const [suggestions, setSuggestions] = useState<ProductSearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { searchProducts, getSkuDetails, getSkuIdentifier } = useInventoryStore(state => ({
    searchProducts: state.searchProducts,
    getSkuDetails: state.getSkuDetails,
    getSkuIdentifier: state.getSkuIdentifier,
  }));
  const containerRef = useRef<HTMLDivElement>(null);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const effectiveInputRef = inputRef ?? internalInputRef;

  const buildSuggestions = useCallback((searchValue: string) => {
    const trimmedValue = searchValue.trim();
    if (!trimmedValue) {
      return [];
    }

    const foundProducts = searchProducts(trimmedValue);
    const detailedSuggestions: ProductSearchSuggestion[] = [];

    foundProducts.forEach(product => {
      if (product.productSKUs && product.productSKUs.length > 0) {
        product.productSKUs.forEach(sku => {
          const skuDetails = getSkuDetails(sku);
          const baseSkuIdentifier = sku.skuIdentifier || getSkuIdentifier(product.name, sku.optionValues);

          if (currentMode === 'sell' && product.trackQuantity) {
            const availableLayers = sku.stockLayers.filter(layer => layer.quantity > 0);

            if (availableLayers.length > 0) {
              availableLayers.forEach(layer => {
                detailedSuggestions.push({
                  product,
                  sku,
                  layer,
                  displayInfo: {
                    name: baseSkuIdentifier,
                    stock: layer.quantity,
                    price: `₹${layer.sellPrice.toFixed(2)}`,
                    category: product.category,
                  },
                });
              });
            } else {
              detailedSuggestions.push({
                product,
                sku,
                displayInfo: {
                  name: `${baseSkuIdentifier} (Out of Stock)`,
                  stock: 0,
                  price: 'N/A',
                  category: product.category,
                },
              });
            }
          } else {
            const isOutOfStock = product.trackQuantity && (skuDetails.totalStock === null || skuDetails.totalStock === 0);
            const outOfStockLabel = isOutOfStock ? " (Out of Stock)" : "";

            detailedSuggestions.push({
              product,
              sku,
              displayInfo: {
                name: `${baseSkuIdentifier}${outOfStockLabel}`,
                stock: product.trackQuantity ? (skuDetails.totalStock ?? 0) : 'N/A',
                price: skuDetails.currentSellPrice !== null ? `₹${skuDetails.currentSellPrice.toFixed(2)}` : 'N/A',
                category: product.category,
              },
            });
          }
        });
      } else {
        detailedSuggestions.push({
          product,
          sku: { id: product.id + '_defaultSKU', optionValues: {}, stockLayers: [], skuIdentifier: product.name },
          displayInfo: {
            name: product.name,
            stock: product.trackQuantity ? '0 (No Purchases Yet)' : 'N/A',
            price: 'N/A',
            category: product.category,
          },
        });
      }
    });

    return detailedSuggestions;
  }, [currentMode, getSkuDetails, getSkuIdentifier, searchProducts]);

  useEffect(() => {
    const trimmedValue = value.trim();

    if (trimmedValue.length > 0 && document.activeElement === effectiveInputRef.current) {
      const detailedSuggestions = buildSuggestions(trimmedValue);
      setSuggestions(detailedSuggestions);
      setShowSuggestions(detailedSuggestions.length > 0 || Boolean(onEnterWithoutSelection));
      setActiveIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [value, buildSuggestions, effectiveInputRef, onEnterWithoutSelection]);

  const handleSelectSuggestion = useCallback((suggestion: ProductSearchSuggestion) => {
    onProductSelect(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
  }, [onProductSelect]);

  const handleAddTypedProduct = useCallback(() => {
    const trimmedValue = value.trim();
    if (!trimmedValue || !onEnterWithoutSelection) {
      return;
    }

    onEnterWithoutSelection(trimmedValue);
    setShowSuggestions(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }, [onEnterWithoutSelection, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputBlur = () => {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement as Node)) {
        setShowSuggestions(false);
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Shift+Enter always creates the typed text as a new product, even when the
    // search already returned matches. Without this, a partial name that fuzzy-
    // matches an existing product (e.g. "Star" vs "Star Annice") swallows Enter
    // and the create path becomes unreachable.
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleAddTypedProduct();
      return;
    }

    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prevIndex) => (prevIndex + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prevIndex) => (prevIndex - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedSuggestion = activeIndex >= 0 && activeIndex < suggestions.length
          ? suggestions[activeIndex]
          : suggestions[0];

        handleSelectSuggestion(selectedSuggestion);
        setShowSuggestions(false);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTypedProduct();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const activeItem = document.getElementById(`suggestion-${activeIndex}`);
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const trimmedValue = value.trim();
  const canAddTypedProduct = trimmedValue.length > 0 && Boolean(onEnterWithoutSelection);

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <Input
        id={id}
        ref={effectiveInputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          if (e.target.value === "") {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        }}
        onFocus={() => {
          const focusedValue = value.trim();
          if (focusedValue.length > 0) {
            const detailedSuggestions = buildSuggestions(focusedValue);
            setSuggestions(detailedSuggestions);
            setShowSuggestions(detailedSuggestions.length > 0 || Boolean(onEnterWithoutSelection));
            setActiveIndex(-1);
          } else {
            setShowSuggestions(false);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full"
      />
      {showSuggestions && trimmedValue.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-72">
          <ScrollArea className="max-h-72">
            {suggestions.length > 0 && (
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.product.id}-${suggestion.sku.id}-${suggestion.layer?.id || 'no-layer'}-${index}`}
                    id={`suggestion-${index}`}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground",
                      index === activeIndex && "bg-accent text-accent-foreground",
                      suggestion.displayInfo.stock === 0 && suggestion.product.trackQuantity && "text-muted-foreground opacity-75"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectSuggestion(suggestion);
                    }}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="truncate font-medium">{suggestion.displayInfo.name}</span>
                      {suggestion.product.trackQuantity && suggestion.displayInfo.stock !== 'N/A' && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Qty: {formatQuantity(suggestion.displayInfo.stock as number, suggestion.product.unit)}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="truncate">{suggestion.displayInfo.category || '\u00A0'}</span>
                      {suggestion.displayInfo.price !== 'N/A' && (
                        <span className="whitespace-nowrap font-medium text-foreground">{suggestion.displayInfo.price}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canAddTypedProduct && (
              <>
                {suggestions.length > 0 && <div className="my-1 border-t border-border" />}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddTypedProduct();
                  }}
                >
                  <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Shift + Enter
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    Add new product <span className="font-medium">&quot;{trimmedValue}&quot;</span>
                  </span>
                </button>
              </>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
