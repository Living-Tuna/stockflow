
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import type { Product, ProductSKU, ProductVariant, Bill, BillItem, Company, Store } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { SUBSCRIPTION_PLANS } from '@/lib/constants';

const routeNamePrefix = "[API_PRODUCTS_COLLECTION /api/products]";
const generateId = () => uuidv4();

export async function GET(req: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) return NextResponse.json({ success: false, message: 'Company ID is required.' }, { status: 400 });

    const limit = parseInt(searchParams.get('limit') || '0', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Run the page query and the count in parallel — each is a full network
    // round trip to Supabase, so sequential execution doubles latency.
    let cursor = db.collection<Product>('products').find({ companyId });
    if (offset > 0) cursor = cursor.skip(offset);
    if (limit > 0) cursor = cursor.limit(limit);

    const [companyProducts, totalCount] = await Promise.all([
      cursor.toArray(),
      db.collection<Product>('products').countDocuments({ companyId }),
    ]);

    return NextResponse.json({ success: true, data: companyProducts, totalCount, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await req.json();
    const { productData, companyId } = body;

    if (!companyId || !productData || !productData.name) {
      return NextResponse.json({ success: false, message: 'Company ID and product data are required.' }, { status: 400 });
    }

    const [company, companyProductsCount] = await Promise.all([
      db.collection<Company>('companies').findOne({ id: companyId }),
      db.collection<Product>('products').countDocuments({ companyId: companyId, isArchived: { $ne: true } }),
    ]);
    if (!company) return NextResponse.json({ success: false, message: 'Company not found.' }, { status: 404 });

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === company.activeSubscriptionId);
    if (plan && companyProductsCount >= plan.maxProducts) {
      return NextResponse.json({ success: false, message: `Product limit reached for your current plan.` }, { status: 403 });
    }

    // Strip transient fields that have no corresponding DB columns.
    // initialStock/costPrice/sellPrice are consumed below for the initial purchase bill only.
    const { initialStock: mainInitialStock, costPrice: mainCostPrice, sellPrice: mainSellPrice, ...productFields } = productData;
    const numOrUndef = (v: any) => (v === '' || v === null || v === undefined ? undefined : Number(v));

    const newProduct: Product = {
      ...productFields,
      id: generateId(),
      companyId: companyId,
      productSKUs: [],
      imageUrl: productData.imageUrl || `https://placehold.co/100x100.png?text=${encodeURIComponent(productData.name.substring(0, 10))}&font=roboto`,
    };

    const initialBillItems: BillItem[] = [];
    const skuCombinations: { sku: ProductSKU; cost: number; sell: number; stock: number }[] = [];

    if (!productData.variants || productData.variants.length === 0) {
      const skuId = generateId();
      newProduct.productSKUs.push({
        id: skuId,
        optionValues: {},
        skuIdentifier: productData.name,
        stockLayers: [],
      });
      // Handle single product initial stock
      if (productData.trackQuantity && numOrUndef(mainInitialStock) !== undefined && numOrUndef(mainInitialStock)! > 0) {
        initialBillItems.push({
          id: uuidv4(),
          productId: newProduct.id,
          productName: newProduct.name,
          quantity: numOrUndef(mainInitialStock)!,
          costPrice: numOrUndef(mainCostPrice) || 0,
          sellPrice: numOrUndef(mainSellPrice) || 0,
          selectedVariantOptions: {}
        });
      }
    } else {
      // Generate all possible SKU combinations from variants, capturing metadata
      const generateCombinations = (variants: any[]): { optionValues: Record<string, string>, metadata: any }[] => {
        if (variants.length === 0) return [{ optionValues: {}, metadata: {} }];
        const firstVariant = variants[0];
        const restCombinations = generateCombinations(variants.slice(1));
        const combinations: { optionValues: Record<string, string>, metadata: any }[] = [];

        firstVariant.options.forEach((option: any) => {
          restCombinations.forEach(combination => {
            // Logic: Variant 0 (Top level) takes precedence for price/stock if defined, otherwise inherit from lower levels
            // Actually, usually the 'lowest' specific level might override? 
            // But here, let's assume if you set price on Color (Var 1), it applies.
            const meta = {
              costPrice: option.costPrice !== undefined ? option.costPrice : combination.metadata.costPrice,
              sellPrice: option.sellPrice !== undefined ? option.sellPrice : combination.metadata.sellPrice,
              initialStock: option.initialStock !== undefined ? option.initialStock : combination.metadata.initialStock,
            };

            combinations.push({
              optionValues: {
                [firstVariant.name]: option.value,
                ...combination.optionValues
              },
              metadata: meta
            });
          });
        });
        return combinations;
      };

      const combinations = generateCombinations(productData.variants);

      newProduct.productSKUs = combinations.map(combination => {
        const skuId = generateId();
        const skuCost = numOrUndef(combination.metadata.costPrice) ?? (numOrUndef(mainCostPrice) ?? 0);
        const skuSell = numOrUndef(combination.metadata.sellPrice) ?? (numOrUndef(mainSellPrice) ?? 0);
        const skuStock = numOrUndef(combination.metadata.initialStock) ?? 0;

        // Create bill item if this variant/SKU has stock
        if (productData.trackQuantity && skuStock > 0) {
          initialBillItems.push({
            id: uuidv4(),
            productId: newProduct.id,
            productName: newProduct.name,
            quantity: skuStock,
            costPrice: skuCost,
            sellPrice: skuSell,
            selectedVariantOptions: combination.optionValues
          });
        }

        const sku: ProductSKU = {
          id: skuId,
          optionValues: combination.optionValues,
          skuIdentifier: `${newProduct.name} (${Object.values(combination.optionValues).join(' - ')})`,
          stockLayers: [] // Populated below so the response reflects prices/stock immediately
        };
        skuCombinations.push({ sku, cost: skuCost, sell: skuSell, stock: skuStock });
        return sku;
      });
    }

    // Populate stockLayers BEFORE persisting so both the DB row and the response
    // reflect prices/stock immediately (they are otherwise only rebuilt from bills
    // on later purchases).
    const initialBillId = initialBillItems.length > 0 ? `INIT_PURCHASE_${newProduct.id.slice(0, 8)}` : null;
    const nowIso = new Date().toISOString();
    const buildLayer = (billId: string, qty: number, cost: number | null, sell: number | null) => ({
      id: uuidv4(),
      purchaseBillId: billId,
      purchaseDate: nowIso,
      initialQuantity: qty,
      quantity: qty,
      costPrice: cost ?? 0,
      sellPrice: sell ?? 0,
    });

    if (!productData.variants || productData.variants.length === 0) {
      const sku = newProduct.productSKUs[0];
      if (productData.trackQuantity) {
        if (initialBillId) {
          const item = initialBillItems[0];
          sku.stockLayers = [buildLayer(initialBillId, item.quantity, item.costPrice || null, item.sellPrice || null)];
        }
      } else if (sku) {
        const cost = numOrUndef((productData as any).costPriceForNonTracked) ?? numOrUndef(mainCostPrice) ?? null;
        const sell = numOrUndef((productData as any).sellPriceForNonTracked) ?? numOrUndef(mainSellPrice) ?? null;
        sku.stockLayers = [buildLayer('STANDARD_PRICE_LAYER', 0, cost, sell)];
      }
    } else {
      skuCombinations.forEach(({ sku, cost, sell, stock }) => {
        if (productData.trackQuantity) {
          if (initialBillId && stock > 0) {
            sku.stockLayers = [buildLayer(initialBillId, stock, cost || null, sell || null)];
          }
        } else {
          sku.stockLayers = [buildLayer('STANDARD_PRICE_LAYER', 0, cost || null, sell || null)];
        }
      });
    }

    try {
      await db.collection<Product>('products').insertOne(newProduct);
    } catch (insertError: any) {
      // Graceful degradation if the `unit` column hasn't been added yet (migration 003).
      if (String(insertError?.message || '').includes("'unit'")) {
        const { unit: _unitOmitted, ...productWithoutUnit } = newProduct as any;
        await db.collection<Product>('products').insertOne(productWithoutUnit);
      } else {
        throw insertError;
      }
    }

    // Create Initial Purchase Bill if items exist
    if (initialBillItems.length > 0 && initialBillId) {
      const firstStore = await db.collection<Store>('stores').findOne({ companyId: companyId });
      let totalAmount = 0;
      initialBillItems.forEach(item => {
        totalAmount += (item.quantity * item.costPrice);
      });

      const conceptualBill: Bill = {
        id: initialBillId,
        type: 'buy',
        date: new Date().toISOString(),
        timestamp: Date.now(),
        items: initialBillItems,
        totalAmount: totalAmount,
        companyId: companyId,
        billedByStaffId: 'SYSTEM_INIT',
        storeId: firstStore?.id,
        storeName: firstStore?.name,
        paymentStatus: company.defaultPurchasePaymentStatus || 'paid',
        notes: 'Initial stock entry from product creation.'
      };
      await db.collection<Bill>('bills').insertOne(conceptualBill);
    }

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An internal server error occurred.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
