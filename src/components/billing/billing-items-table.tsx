
"use client";

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BillItemRow, BillItemHeader } from './bill-item-row';
import { BillItem, BillMode } from '@/types';

interface BillingItemsTableProps {
    items: BillItem[];
    mode: BillMode;
    isEstimateMode: boolean;
    taxType: 'intra-state' | 'inter-state';
    updateQuantity: (id: string, qty: number) => void;
    updatePrice: (id: string, price: number, type: 'cost' | 'sell') => void;
    updateDiscount: (id: string, val: number, type: 'amount' | 'percentage') => void;
    updateItemFlag?: (id: string, flag: 'isExchange') => void;
    removeItem: (id: string) => void;
    onEnterPress: () => void;
}

export const BillingItemsTable: React.FC<BillingItemsTableProps> = ({
    items, mode, isEstimateMode, taxType,
    updateQuantity, updatePrice, updateDiscount, updateItemFlag, removeItem, onEnterPress
}) => {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const bottomRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [items.length]);

    return (
        <div className="flex-grow flex flex-col overflow-hidden min-h-[300px]">
            <BillItemHeader mode={mode} isEstimateMode={isEstimateMode} taxType={taxType} />
            <ScrollArea className="flex-1 h-0" ref={scrollRef as any}>
                <div className="flex flex-col gap-1 pb-2">
                    {items.map((item) => (
                        <BillItemRow
                            key={item.id}
                            item={item}
                            mode={mode}
                            isEstimateMode={isEstimateMode}
                            onQuantityChange={updateQuantity}
                            onPriceChange={updatePrice}
                            onDiscountChange={updateDiscount}
                            onToggleExchange={mode === 'return' ? (id) => updateItemFlag?.(id, 'isExchange') : undefined}
                            onRemoveItem={removeItem}
                            onEnterPress={onEnterPress}
                            taxType={taxType}
                        />
                    ))}
                    <div ref={bottomRef} className="h-1" />
                </div>
            </ScrollArea>
        </div>
    );
};
