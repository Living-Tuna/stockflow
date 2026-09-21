
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import type { Bill, Product, ProductSKU, StockLayer, BillItem, Company, User, Store } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { format, startOfDay } from 'date-fns';
import { roundMoney, roundQuantity } from '@/lib/units';
import { buildUpdatedOriginalBill, computeReturnRefundAmount, validateReturnAgainstOriginal } from '@/lib/return-utils';

const routeNamePrefix = "[API_BILLS_COLLECTION /api/bills]";

export async function GET(req: NextRequest) {
  const routeLogName = `${routeNamePrefix} GET`;
  console.log(`${routeLogName} Received request.`);
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });
    }

    const limit = parseInt(searchParams.get('limit') || '0', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const storeIdFilter = searchParams.get('storeId');

    const query: any = { companyId: companyId };
    if (storeIdFilter) {
      query.storeId = storeIdFilter;
    }

    // Page query and count run in parallel — each is a full round trip.
    let cursor = db.collection<Bill>('bills')
      .find(query)
      .sort({ timestamp: -1 });
    if (offset > 0) cursor = cursor.skip(offset);
    if (limit > 0) cursor = cursor.limit(limit);

    const [companyBills, totalCount] = await Promise.all([
      cursor.toArray(),
      db.collection<Bill>('bills').countDocuments(query),
    ]);

    // Attach metadata to response if pagination is active, otherwise keeping strict array shape might be safer for existing clients unless we know they handle extra props.
    // For now, we return the data array as is. If the client requested a limit, they get that many.
    // Ideally, we wrap this: { data: bills, meta: { total: totalCount } }
    // But to preserve 'data: companyBills' (array) contract:

    console.log(`${routeLogName} Found ${companyBills.length} bills (Total: ${totalCount}) for company ${companyId}.`);

    // We can return the total count in a separate field 'totalCount' which won't break the 'data' array contract.
    return NextResponse.json({ success: true, data: companyBills, totalCount, limit, offset });
  } catch (error) {
    console.error(`${routeNamePrefix} Error:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const routeLogName = `${routeNamePrefix} POST`;
  console.log(`${routeLogName} Received request to create a new bill.`);
  try {
    const { db } = await connectToDatabase();
    const body = await req.json();
    const billData = body?.billData;
    const itemsData = body?.itemsData;

    // Accept both canonical (`type`, `storeId`) and legacy (`billType`,
    // `storeIdForBill`) field names — older clients send the latter.
    const companyId = billData?.companyId;
    const storeId = billData?.storeId || billData?.storeIdForBill;
    const billType = billData?.type || billData?.billType;
    const isEstimate = billData?.isEstimate;
    const billedByStaffId = billData?.billedByStaffId;
    const taxType = billData?.taxType;
    const providedDate = billData?.date;
    const originalBillId = billType === 'return' ? billData?.originalBillId : undefined;
    const skipStockProductIds = new Set(billData?.skipStockProductIds || []);

    if (!companyId || !billType || !Array.isArray(itemsData) || itemsData.length === 0) {
      return NextResponse.json({ success: false, message: 'Company ID, bill type, and at least one item are required.' }, { status: 400 });
    }
    if (!['sell', 'buy', 'return'].includes(billType)) {
      return NextResponse.json({ success: false, message: 'Invalid bill type provided.' }, { status: 400 });
    }

    const productsCollection = db.collection<Product>('products');
    const productIds = itemsData.map((item: any) => item.productId).filter((id: string) => !id.startsWith('SERVICE_ITEM_') && !id.startsWith('CHARGE_ITEM_'));

    const currentDate = providedDate ? new Date(providedDate) : new Date();
    const datePrefix = format(currentDate, 'ddMMyy');

    // These lookups are independent — run them in one parallel batch instead of
    // four sequential network round trips to Supabase.
    const [company, allBillsTodayCount, storeDetails, productsToUpdateRaw, staffUser, originalBill] = await Promise.all([
      db.collection<Company>('companies').findOne({ id: companyId }),
      db.collection<Bill>('bills').countDocuments({
        id: { $gte: datePrefix + '0000', $lt: datePrefix + '9999' }
      }),
      storeId
        ? db.collection<Store>('stores').findOne({ id: storeId, companyId: companyId })
        : Promise.resolve(null as Store | null),
      productsCollection.find({ id: { $in: productIds }, companyId: companyId }).toArray(),
      billedByStaffId
        ? db.collection<User>('users').findOne({ id: billedByStaffId, companyId: companyId })
        : Promise.resolve(null as User | null),
      originalBillId
        ? db.collection<Bill>('bills').findOne({ id: originalBillId, companyId: companyId })
        : Promise.resolve(null as Bill | null),
    ]);
    const productsToUpdate: Product[] = productsToUpdateRaw as Product[];

    if (!company) {
      return NextResponse.json({ success: false, message: 'Company not found.' }, { status: 404 });
    }

    if (billType === 'return' && originalBillId && !originalBill) {
      return NextResponse.json({ success: false, message: 'The original sales bill for this return was not found.' }, { status: 404 });
    }
    if (originalBill) {
      const validationError = validateReturnAgainstOriginal(originalBill, itemsData as BillItem[]);
      if (validationError) {
        return NextResponse.json({ success: false, message: validationError }, { status: 400 });
      }
    }

    let newBillNumber = allBillsTodayCount + 1;
    let newBillId = `${datePrefix}${newBillNumber.toString().padStart(4, '0')}`;

    let processedBillItems: BillItem[] = [];
    let billSubTotal = 0;
    let billTotalSGST = 0;
    let billTotalCGST = 0;
    let billTotalIGST = 0;
    let billTotalDiscount = 0;

    for (const item of itemsData) {
      const isServiceOrCharge = item.productId.startsWith('SERVICE_ITEM_') || item.productId.startsWith('CHARGE_ITEM_');
      const productIndex = !isServiceOrCharge ? productsToUpdate.findIndex(p => p.id === item.productId) : -1;

      const product = productIndex !== -1 ? productsToUpdate[productIndex] : null;

      if (!isServiceOrCharge && !product) {
        return NextResponse.json({ success: false, message: `Product with ID ${item.productId} not found.` }, { status: 404 });
      }

      let sku: ProductSKU | undefined;
      if (product && item.selectedVariantOptions && Object.keys(item.selectedVariantOptions).length > 0) {
        const stringifiedTargetOptions = JSON.stringify(Object.fromEntries(Object.entries(item.selectedVariantOptions || {}).sort()));
        sku = product.productSKUs.find(s => JSON.stringify(Object.fromEntries(Object.entries(s.optionValues).sort())) === stringifiedTargetOptions);
      } else if (product) {
        sku = product.productSKUs.find(s => Object.keys(s.optionValues || {}).length === 0) || product.productSKUs[0];
      }

      const itemProductNameForBill = sku?.skuIdentifier || product?.name || item.productName || "Service/Charge";
      let itemCostPrice = item.costPrice || 0;
      let itemSellPrice = item.sellPrice || 0;

      if (billType === 'sell' && !isEstimate && product && sku) {
        if (product.trackQuantity) {
          let quantityToSell = item.quantity;
          let costOfGoodsSoldThisItem = 0;
          let relevantLayers = (sku?.stockLayers || [])
            .filter(l => (l.storeId === storeId || !l.storeId || storeId === undefined) && l.quantity > 0)
            .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
          // Fallback: if filtering by storeId yielded nothing, try without storeId filter
          if (relevantLayers.reduce((sum, l) => sum + l.quantity, 0) < quantityToSell) {
            relevantLayers = (sku?.stockLayers || [])
              .filter(l => l.quantity > 0)
              .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());
          }
          if (relevantLayers.reduce((sum, l) => sum + l.quantity, 0) < quantityToSell) {
            return NextResponse.json({ success: false, message: `Insufficient stock for ${itemProductNameForBill}.` }, { status: 400 });
          }
          for (const layer of relevantLayers) {
            if (quantityToSell <= 0) break;
            const sellFromThisLayer = Math.min(quantityToSell, layer.quantity);
            costOfGoodsSoldThisItem += sellFromThisLayer * layer.costPrice;
            layer.quantity = roundQuantity(layer.quantity - sellFromThisLayer);
            quantityToSell = roundQuantity(quantityToSell - sellFromThisLayer);
          }
          itemCostPrice = item.quantity > 0 ? costOfGoodsSoldThisItem / item.quantity : 0;
        }
      } else if (billType === 'buy' && product && sku) {
        if (product.trackQuantity && !skipStockProductIds.has(item.productId)) {
          const newLayer: StockLayer = {
            id: uuidv4(), purchaseBillId: newBillId, purchaseDate: currentDate.toISOString(),
            initialQuantity: item.quantity, quantity: item.quantity,
            costPrice: itemCostPrice, sellPrice: itemSellPrice, storeId: storeId,
          };
          sku.stockLayers.push(newLayer);
        }
      } else if (billType === 'return' && product && sku) {
        itemCostPrice = item.costPrice || sku?.stockLayers.find(sl => sl.quantity > 0)?.costPrice || 0;
        if (product.trackQuantity && !item.isDefective && !skipStockProductIds.has(item.productId)) {
          const returnLayer: StockLayer = {
            id: uuidv4(), purchaseBillId: newBillId, purchaseDate: currentDate.toISOString(),
            initialQuantity: item.quantity, quantity: item.quantity,
            costPrice: itemCostPrice, sellPrice: itemSellPrice, storeId: storeId,
          };
          sku.stockLayers.push(returnLayer);
        }
      }

      let itemSgstAmount = 0, itemCgstAmount = 0, itemIgstAmount = 0;
      let itemDiscountAmount = 0;

      if (!isServiceOrCharge) {
        if ((billType === 'sell' || billType === 'return')) {
          if (item.discountValue && item.discountValue > 0) {
            if (item.discountType === 'percentage') {
              itemDiscountAmount = roundMoney(((itemSellPrice * item.quantity) * item.discountValue) / 100);
            } else {
              itemDiscountAmount = roundMoney(item.discountValue * item.quantity);
            }
          }
        }
      }

      if (!isEstimate && product && !isServiceOrCharge) {
        const rawLineTotal = billType === 'buy' ? itemCostPrice * item.quantity : itemSellPrice * item.quantity;
        const taxableValue = Math.max(0, rawLineTotal - itemDiscountAmount);

        if (taxType === 'inter-state') {
          const rate = product.igstRate !== undefined ? product.igstRate : ((product.sgstRate || 0) + (product.cgstRate || 0));
          itemIgstAmount = roundMoney((taxableValue * rate) / 100);
        } else {
          itemSgstAmount = roundMoney((taxableValue * (product.sgstRate || 0)) / 100);
          itemCgstAmount = roundMoney((taxableValue * (product.cgstRate || 0)) / 100);
        }
      } else if (!isEstimate && isServiceOrCharge && billType === 'sell') {
        // Basic tax logic for services if they had rates, but currently assuming 0 or explicit charges.
        // Charges usually have tax? Assuming no tax on charges for now unless product definition has it.
        // If it's a "CHARGE_ITEM", we just take sellPrice.
      }

      const preTaxLineTotal = (billType === 'buy' ? itemCostPrice * item.quantity : itemSellPrice * item.quantity);
      // Note: subTotal usually represents the sum of prices * quantity (Gross), or Net?
      // Standard: SubTotal is sum of (Price * Qty). Discount is separate line or subtracted from Grand Total.
      // But tax is calculated on Net.
      // Let's keep billSubTotal as Gross (Price * Qty).

      billSubTotal += preTaxLineTotal;
      billTotalDiscount += itemDiscountAmount;
      billTotalSGST += itemSgstAmount;
      billTotalCGST += itemCgstAmount;
      billTotalIGST += itemIgstAmount;

      processedBillItems.push({
        id: uuidv4(), productId: product?.id || item.productId, productName: itemProductNameForBill,
        quantity: item.quantity, costPrice: itemCostPrice, sellPrice: itemSellPrice,
        isDefective: item.isDefective, isExchange: item.isExchange,
        selectedVariantOptions: item.selectedVariantOptions,
        sgstAmount: itemSgstAmount, cgstAmount: itemCgstAmount, igstAmount: itemIgstAmount,
        discountValue: item.discountValue, discountType: item.discountType, discountAmount: itemDiscountAmount,
        isAdditionalCharge: item.isAdditionalCharge, sourceChargeDefinitionId: item.sourceChargeDefinitionId,
      });
    }

    // When a return is linked to its original sale bill, compute how much money is
    // credited back (everything EXCEPT exchanged lines), decide the bill's
    // returnType, and annotate the original bill so its amount is effectively reduced.
    const linkedReturnRefund =
      originalBill && billType === 'return' ? computeReturnRefundAmount(processedBillItems) : 0;
    const linkedReturnType: Bill['returnType'] =
      originalBill && billType === 'return'
        ? (itemsData as BillItem[]).every((i) => i.isExchange === true) ? 'exchange' : 'return'
        : undefined;

    const newBill = {
      id: newBillId, type: billType, date: currentDate.toISOString(), timestamp: currentDate.getTime(),
      vendorOrCustomerName: billData.vendorOrCustomerName, customerPhone: billData.customerPhone,
      items: processedBillItems, subTotal: roundMoney(billSubTotal), totalSGST: isEstimate ? 0 : roundMoney(billTotalSGST),
      totalCGST: isEstimate ? 0 : roundMoney(billTotalCGST), totalIGST: isEstimate ? 0 : roundMoney(billTotalIGST),
      totalDiscount: roundMoney(billTotalDiscount),
      totalAmount: isEstimate ? roundMoney(billSubTotal - billTotalDiscount) : roundMoney((billSubTotal - billTotalDiscount) + billTotalSGST + billTotalCGST + billTotalIGST),
      isEstimate: !!isEstimate, notes: billData.notes || company.defaultBillNotes || '',
      paymentStatus: billData.paymentStatus, billedByStaffId: staffUser?.id,
      billedByStaffName: staffUser?.name, storeId: storeDetails?.id, storeName: storeDetails?.name,
      companyId: companyId, taxType: taxType,
      originalBillId: originalBillId, returnType: linkedReturnType, refundAmount: linkedReturnRefund > 0 ? linkedReturnRefund : undefined,
    };

    let insertedBill: Bill | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      newBill.id = newBillId;
      try {
        await db.collection<Bill>('bills').insertOne(newBill);
        insertedBill = newBill;
        break;
      } catch (e: any) {
        const msg = e?.message || '';
        if (/duplicate key/i.test(msg)) {
          newBillNumber++;
          newBillId = `${datePrefix}${newBillNumber.toString().padStart(4, '0')}`;
          continue;
        }
        throw e;
      }
    }
    if (!insertedBill) {
      return NextResponse.json({ success: false, message: 'Could not generate unique bill ID after retries.' }, { status: 500 });
    }
    for (const product of productsToUpdate) {
      await productsCollection.updateOne({ id: product.id }, { $set: { productSKUs: product.productSKUs } });
    }

    // Annotate the linked original sale bill: its amount is effectively reduced by
    // the refunded amount and its lines remember how much was returned/exchanged.
    if (originalBill && billType === 'return') {
      const updatedOriginal = buildUpdatedOriginalBill(originalBill, insertedBill.id, processedBillItems, currentDate.toISOString(), linkedReturnRefund);
      await db.collection<Bill>('bills').updateOne(
        { id: updatedOriginal.id },
        { $set: { items: updatedOriginal.items, refundedAmount: updatedOriginal.refundedAmount, linkedReturnBillIds: updatedOriginal.linkedReturnBillIds } }
      );
    }

    console.log(`${routeLogName} New bill (ID: ${insertedBill.id}) created successfully for company ${companyId}.`);
    return NextResponse.json({ success: true, data: insertedBill }, { status: 201 });

  } catch (error) {
    console.error(`${routeNamePrefix} Error creating bill:`, error);
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
