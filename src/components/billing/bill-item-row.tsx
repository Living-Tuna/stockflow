
"use client";

import type { BillItem, BillMode } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BillItemRowProps {
  item: BillItem;
  mode: BillMode;
  isEstimateMode?: boolean;
  onQuantityChange: (itemId: string, newQuantity: number) => void;
  onPriceChange?: (itemId: string, newPrice: number, priceType: 'cost' | 'sell') => void;
  onRemoveItem: (itemId: string) => void;
  onDiscountChange?: (itemId: string, value: number, type: 'amount' | 'percentage') => void;
  onToggleExchange?: (itemId: string) => void;
  taxType?: 'intra-state' | 'inter-state';
  inputRefs?: {
    quantity: React.RefObject<HTMLInputElement>;
    costPrice?: React.RefObject<HTMLInputElement>;
    sellPrice?: React.RefObject<HTMLInputElement>;
    discountValue?: React.RefObject<HTMLInputElement>;
  };
  onEnterPress?: (field: 'quantity' | 'costPrice' | 'sellPrice' | 'discountValue' | 'nextItem') => void;
}

export function BillItemRow({
  item,
  mode,
  isEstimateMode = false,
  onQuantityChange,
  onPriceChange,
  onDiscountChange,
  onRemoveItem,
  onToggleExchange,
  inputRefs,
  onEnterPress,
  taxType = 'intra-state'
}: BillItemRowProps) {

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'quantity' | 'costPrice' | 'sellPrice' | 'discountValue') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterPress?.(field);
    }
  };

  const calculateTotal = () => {
    const rawSubtotal = mode === 'buy' ? item.quantity * item.costPrice : item.quantity * item.sellPrice;
    if (mode === 'buy') return rawSubtotal;

    // In estimate mode, show clean subtotal without discount/tax
    if (isEstimateMode) return rawSubtotal;

    // Sell Mode Logic
    let discountAmount = 0;
    if (item.discountValue && item.discountValue > 0) {
      if (item.discountType === 'percentage') {
        discountAmount = (rawSubtotal * item.discountValue) / 100;
      } else {
        discountAmount = item.discountValue * item.quantity;
      }
    }

    const taxableValue = Math.max(0, rawSubtotal - discountAmount);
    const sgst = item.sgstAmount || 0;
    const cgst = item.cgstAmount || 0;
    const igst = item.igstAmount || 0;

    return taxableValue + sgst + cgst + igst;
  };

  const itemTotalWithTax = calculateTotal();

  const showTaxColumns = mode === 'sell' && !isEstimateMode && !item.isAdditionalCharge && !item.productId.startsWith('SERVICE_ITEM_');
  const isChargeOrService = item.isAdditionalCharge || item.productId.startsWith('SERVICE_ITEM_');
  const isInterState = taxType === 'inter-state';
  const isReturnMode = mode === 'return';

  const gridTemplate = mode === 'buy'
    ? "grid-cols-[1fr_80px_80px_80px_80px_40px]"
    : (showTaxColumns
      ? (isInterState
        ? "grid-cols-[1fr_70px_80px_100px_60px_80px_40px]" // IGST layout
        : "grid-cols-[1fr_70px_80px_100px_50px_50px_80px_40px]" // SGST+CGST layout
      )
      : isReturnMode
        ? "grid-cols-[1fr_70px_70px_90px_46px_40px]" // Return layout (Product, Qty, Price, Total, Exchange, Del)
        : "grid-cols-[1fr_80px_100px_100px_40px]");

  return (
    <div className={cn(
      "grid items-center gap-2 py-2 border-b border-dashed",
      gridTemplate
    )}>
      <div>
        <span className="truncate text-sm font-medium block" title={item.productName}>{item.productName}</span>
        {item.selectedVariantOptions && Object.keys(item.selectedVariantOptions).length > 0 && (
          <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
            {Object.entries(item.selectedVariantOptions)
              .map(([key, value]) => `${key}: ${value}`)
              .join(', ')}
          </div>
        )}
        {item.isAdditionalCharge && <span className="text-xs text-primary ml-1">(Additional Charge)</span>}
        {isReturnMode && item.isExchange && <span className="text-xs text-violet-600 font-medium ml-1">(Exchange — no refund)</span>}
        {isReturnMode && !item.isExchange && item.isDefective && <span className="text-xs text-destructive font-medium ml-1">(Defective)</span>}
      </div>

      <Input
        ref={inputRefs?.quantity}
        type="number"
        value={item.quantity}
        onChange={(e) => onQuantityChange(item.id, parseFloat(e.target.value) || 0)}
        onKeyDown={(e) => handleKeyDown(e, 'quantity')}
        className="h-8 text-sm w-full px-2"
        step="any"
        min="0.01"
        disabled={item.isAdditionalCharge}
      />

      {mode === 'buy' ? (
        <>
          {/* Buy Mode logic remains mostly same but compacted */}
          <Input
            ref={inputRefs?.costPrice}
            type="number"
            value={item.costPrice}
            onChange={(e) => onPriceChange?.(item.id, parseFloat(e.target.value) || 0, 'cost')}
            onKeyDown={(e) => handleKeyDown(e, 'costPrice')}
            className="h-8 text-sm w-full px-2"
            step="0.01" min="0" disabled={isChargeOrService}
          />
          <span className="text-xs text-muted-foreground text-right truncate">
            {((item.quantity * item.costPrice) || 0).toFixed(2)}
          </span>
          <Input
            ref={inputRefs?.sellPrice}
            type="number"
            value={item.sellPrice}
            onChange={(e) => onPriceChange?.(item.id, parseFloat(e.target.value) || 0, 'sell')}
            onKeyDown={(e) => handleKeyDown(e, 'sellPrice')}
            className="h-8 text-sm w-full px-2"
            step="0.01" min="0" disabled={isChargeOrService}
          />
        </>
      ) : (
        <>
          {/* Sell/Return Mode */}
          {showTaxColumns || mode === 'return' ? (
            <Input
              ref={inputRefs?.sellPrice} // Re-use ref or add new one if needed, keeping sellPrice logic simple
              type="number"
              value={item.sellPrice}
              onChange={(e) => onPriceChange?.(item.id, parseFloat(e.target.value) || 0, 'sell')} // Allow price edit in sell mode too if enabled? Setup allows it.
              // Assuming sell price is editable as per billing-form logic
              className="h-8 text-sm w-full px-2"
              readOnly={item.isAdditionalCharge}
              disabled={item.isAdditionalCharge}
            />
          ) : (
            <span className="text-sm text-right px-2">{item.sellPrice.toFixed(2)}</span>
          )}

          {showTaxColumns && (
            <>
              {/* Discount Column */}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  ref={inputRefs?.discountValue}
                  value={item.discountValue || ''}
                  placeholder="0"
                  onChange={(e) => onDiscountChange?.(item.id, parseFloat(e.target.value) || 0, item.discountType || 'amount')} // Update value, keep type
                  className="h-8 text-sm px-1 w-full min-w-0"
                  onKeyDown={(e) => handleKeyDown(e, 'discountValue')}
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 px-0 text-xs font-bold"
                  onClick={() => onDiscountChange?.(item.id, item.discountValue || 0, item.discountType === 'percentage' ? 'amount' : 'percentage')}
                  tabIndex={-1}
                  title="Toggle Discount Type"
                >
                  {item.discountType === 'percentage' ? '%' : '₹'}
                </Button>
              </div>

              {/* Tax Columns */}
              {isInterState ? (
                <span className="text-xs text-muted-foreground text-right flex items-center justify-end h-8 px-1 truncate bg-muted/20 rounded-sm">
                  {item.igstAmount ? `₹${item.igstAmount.toFixed(2)}` : '-'}
                </span>
              ) : (
                <>
                  <span className="text-xs text-muted-foreground text-right flex items-center justify-end h-8 px-1 truncate bg-muted/20 rounded-sm">
                    {item.sgstAmount ? `₹${item.sgstAmount.toFixed(2)}` : '-'}
                  </span>
                  <span className="text-xs text-muted-foreground text-right flex items-center justify-end h-8 px-1 truncate bg-muted/20 rounded-sm">
                    {item.cgstAmount ? `₹${item.cgstAmount.toFixed(2)}` : '-'}
                  </span>
                </>
              )}
            </>
          )}

          <span className="text-sm font-semibold text-right flex items-center justify-end h-8 px-2 truncate">
            ₹{itemTotalWithTax.toFixed(2)}
          </span>

          {isReturnMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleExchange?.(item.id)}
              className={cn("h-8 w-8", item.isExchange && "bg-violet-100 text-violet-700")}
              title={item.isExchange ? "Exchange: goods return to stock, no refund" : "Mark as exchange instead of refund"}
              tabIndex={-1}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          )}
        </>
      )}

      <Button variant="ghost" size="icon" onClick={() => onRemoveItem(item.id)} className="h-8 w-8">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function BillItemHeader({ mode, isEstimateMode, taxType = 'intra-state' }: { mode: BillMode, isEstimateMode?: boolean, taxType?: 'intra-state' | 'inter-state' }) {
  const showTaxColumns = mode === 'sell' && !isEstimateMode;
  const isInterState = taxType === 'inter-state';
  const isReturnMode = mode === 'return';

  const gridTemplate = mode === 'buy'
    ? "grid-cols-[1fr_80px_80px_80px_80px_40px]"
    : (showTaxColumns
      ? (isInterState
        ? "grid-cols-[1fr_70px_80px_100px_60px_80px_40px]"
        : "grid-cols-[1fr_70px_80px_100px_50px_50px_80px_40px]"
      )
      : isReturnMode
        ? "grid-cols-[1fr_70px_70px_90px_46px_40px]"
        : "grid-cols-[1fr_80px_100px_100px_40px]");

  return (
    <div className={cn(
      "grid items-center gap-2 pb-2 border-b",
      gridTemplate
    )}>
      <span className="text-xs font-semibold text-muted-foreground">Product</span>
      <span className="text-xs font-semibold text-muted-foreground text-center">Qty</span>
      {mode === 'buy' ? (
        <>
          <span className="text-xs font-semibold text-muted-foreground text-right">Cost</span>
          <span className="text-xs font-semibold text-muted-foreground text-right">Sub.</span>
          <span className="text-xs font-semibold text-muted-foreground text-right">Sell</span>
        </>
      ) : (
        <>
          <span className="text-xs font-semibold text-muted-foreground text-center">Price</span>
          {showTaxColumns && (
            <>
              <span className="text-xs font-semibold text-muted-foreground text-center">Discount</span>
              {isInterState ? (
                <span className="text-xs font-semibold text-muted-foreground text-right">IGST</span>
              ) : (
                <>
                  <span className="text-xs font-semibold text-muted-foreground text-right">SGST</span>
                  <span className="text-xs font-semibold text-muted-foreground text-right">CGST</span>
                </>
              )}
            </>
          )}
          <span className="text-xs font-semibold text-muted-foreground text-right">Total</span>
          {isReturnMode && <span className="text-xs font-semibold text-muted-foreground text-center">Exchange</span>}
        </>
      )}
      <span className="text-xs font-semibold text-muted-foreground"></span>
    </div>
  );
}
