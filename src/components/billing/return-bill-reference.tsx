"use client";

import React from 'react';
import { Package, Plus, Undo2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { Bill, BillItem } from '@/types';
import { getReturnableQuantity, getNetBillAmount, computeReturnRefundAmount } from '@/lib/return-utils';
import { roundMoney } from '@/lib/units';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Per-line money the customer gets back if this line is returned (not exchanged). */
function lineRefundValue(item: BillItem): number {
  const raw = (item.sellPrice || 0) * (item.quantity || 0);
  const taxable = Math.max(0, raw - (item.discountAmount || 0));
  return roundMoney(taxable + (item.sgstAmount || 0) + (item.cgstAmount || 0) + (item.igstAmount || 0));
}

interface ReturnBillReferenceProps {
  sourceBill: Bill | null;
  sourceBillId: string;
  sourceOptions: ComboboxOption[];
  onSourceBillChange: (id: string) => void;
  currentItems: BillItem[];
  onAddSourceItem: (sourceItem: BillItem, quantity: number) => void;
}

export const ReturnBillReference: React.FC<ReturnBillReferenceProps> = ({
  sourceBill,
  sourceBillId,
  sourceOptions,
  onSourceBillChange,
  currentItems,
  onAddSourceItem,
}) => {
  if (!sourceBill) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor="returnSourceBill" className="text-sm font-medium">
          Return / Exchange Against (Original Sale Bill)
        </Label>
        <Combobox
          id="returnSourceBill"
          options={sourceOptions}
          value={sourceBillId}
          onValueChange={onSourceBillChange}
          placeholder="Search & select the original sale bill..."
          searchPlaceholder="Search bill id, customer, amount..."
          emptyText="No sale bills available to return against."
        />
        <p className="text-xs text-muted-foreground">
          Pick the bill to list its products, see what is still returnable, and track the
          amount owed back to the customer.
        </p>
      </div>
    );
  }

  const billTotal = sourceBill.totalAmount || 0;
  const alreadyRefunded = sourceBill.refundedAmount || 0;
  const availableToCustomer = getNetBillAmount(sourceBill);

  const refundSoFar = computeReturnRefundAmount(currentItems);
  const exchangeValue = roundMoney(
    currentItems
      .filter((i) => i.isExchange)
      .reduce((sum, i) => sum + lineRefundValue(i), 0)
  );
  const stillAvailable = roundMoney(Math.max(0, availableToCustomer - refundSoFar));

  // Real (non-service, non-charge) lines that still have quantity to give back.
  const returnableLines = sourceBill.items.filter(
    (i) => !i.productId.startsWith('SERVICE_ITEM_') && !i.productId.startsWith('CHARGE_ITEM_') && i.quantity > 0
  );
  const openLines = returnableLines.filter((i) => getReturnableQuantity(i) > 0);
  const settledLines = returnableLines.filter((i) => getReturnableQuantity(i) === 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="returnSourceBill" className="text-sm font-medium">
            Return / Exchange Against (Original Sale Bill)
          </Label>
          <Combobox
            id="returnSourceBill"
            options={sourceOptions}
            value={sourceBillId}
            onValueChange={onSourceBillChange}
            placeholder="Search & select the original sale bill..."
            searchPlaceholder="Search bill id, customer, amount..."
            emptyText="No sale bills available to return against."
          />
          <p className="text-xs text-muted-foreground">
            #{sourceBill.invoiceNumber || sourceBill.id} · {sourceBill.vendorOrCustomerName || 'Walk-in Customer'} ·{' '}
            {format(new Date(sourceBill.date), 'dd MMM yyyy')}
          </p>
        </div>

        {/* Money owed back to the customer, updating live as the bill changes. */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <AmountTile label="Bill total" value={billTotal} tone="neutral" />
          <AmountTile
            label="Already refunded"
            value={alreadyRefunded}
            tone="positive"
            hint={alreadyRefunded > 0 ? 'previous returns' : undefined}
          />
          <AmountTile
            label="Available to return"
            value={availableToCustomer}
            tone={availableToCustomer > 0 ? 'positive' : 'neutral'}
          />
          <AmountTile
            label="Still available"
            value={stillAvailable}
            tone={refundSoFar > 0 ? 'negative' : availableToCustomer > 0 ? 'positive' : 'neutral'}
            hint={refundSoFar > 0 ? `after this ${refundSoFar > 0 ? 'return' : ''}` : undefined}
          />
        </div>
      </div>

      {currentItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border bg-background px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Undo2 className="h-4 w-4 text-destructive" />
            <span className="text-muted-foreground">Refund to customer</span>
            <span className={cn("font-semibold tabular-nums", refundSoFar > 0 ? "text-destructive" : "text-muted-foreground")}>
              −₹{refundSoFar.toFixed(2)}
            </span>
          </span>
          {exchangeValue > 0 && (
            <span className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
              <span className="text-muted-foreground">Exchange value</span>
              <span className="font-semibold tabular-nums text-emerald-600">+₹{exchangeValue.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">(no money back)</span>
            </span>
          )}
        </div>
      )}

      {/* Products on the entered bill — click to add them to this return. */}
      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Products on this bill
          </span>
          <span className="text-xs text-muted-foreground">
            {openLines.length} of {returnableLines.length} still returnable
          </span>
        </div>

        {returnableLines.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">This bill has no products to return.</p>
        ) : (
          <ul className="max-h-64 divide-y overflow-y-auto">
            {returnableLines.map((item) => {
              const remaining = getReturnableQuantity(item);
              const alreadyHandled = (item.quantity || 0) - remaining;
              const disabled = remaining <= 0;
              return (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-medium", disabled && "text-muted-foreground line-through")}>
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Billed {item.quantity} @ ₹{(item.sellPrice || 0).toFixed(2)} · refund ₹{lineRefundValue(item).toFixed(2)}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {disabled ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Fully settled
                      </span>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {alreadyHandled > 0 ? `${alreadyHandled} handled · ` : ''}
                          <span className="font-semibold text-foreground">{remaining} left</span>
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1 h-7 gap-1 px-2 text-xs"
                          onClick={() => onAddSourceItem(item, remaining)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {settledLines.length > 0 && openLines.length === 0 && (
          <p className="border-t px-3 py-2 text-xs text-amber-600">
            Every product on this bill has already been returned or exchanged.
          </p>
        )}
      </div>
    </div>
  );
};

/** A single labelled money figure. `tone` drives the red/green colouring. */
function AmountTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'positive' | 'negative';
  hint?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === 'positive' && value > 0 && "text-emerald-600",
          tone === 'negative' && "text-destructive"
        )}
      >
        ₹{value.toFixed(2)}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
