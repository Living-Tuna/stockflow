
"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useForm, Controller, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductVariant as ProductVariantType, Bill, StockLayer, ProductSKU, ProductOption as ProductOptionType, AdditionalChargeDefinition } from '@/types';
import { CategorySearchInput } from '@/components/billing/category-search-input';
import { PlusCircle, Trash2, ListCollapse, PackageSearch, CalendarDays, Info, Percent, DollarSign, BadgePercent, HandCoins } from 'lucide-react';
import { UnifiedScannerModal } from '@/components/common/UnifiedScannerModal';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_UNITS, DEFAULT_UNIT_VALUE, getUnit } from '@/lib/units';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const additionalChargeDefinitionSchema = z.object({
  id: z.string().default(() => uuidv4()),
  name: z.string().min(1, "Charge name cannot be empty"),
  type: z.enum(['fixed', 'percentage']).default('fixed'),
  value: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
    z.number({ invalid_type_error: "Charge value must be a number" }).min(0, "Value must be non-negative")
  ),
}).refine(data => {
  if (data.type === 'percentage' && (data.value < 0 || data.value > 100)) {
    return false;
  }
  return true;
}, {
  message: "Percentage value must be between 0 and 100.",
  path: ["value"],
});

const optionalNumber = () => z.preprocess(
  (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
  z.number().optional()
);

const productOptionSchema = z.object({
  id: z.string().optional(),
  value: z.string().min(1, "Option value cannot be empty"),
  costPrice: optionalNumber(),
  sellPrice: optionalNumber(),
  initialStock: optionalNumber(),
});

const productVariantFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Variant name cannot be empty"),
  options: z.array(productOptionSchema).min(1, "At least one option is required for a variant."),
});

const productFormSchema = z.object({
  name: z.string().min(2, { message: "Product name must be at least 2 characters." }),
  description: z.string().optional(),
  category: z.string().optional().default(''),
  trackQuantity: z.boolean().default(true),
  unit: z.string().optional(),
  sku: z.string().optional(),
  expiryDate: z.string().optional(),
  costPrice: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
    z.number({ invalid_type_error: "Cost price must be a number" }).optional()
  ),
  sellPrice: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
    z.number({ invalid_type_error: "Sell price must be a number" }).optional()
  ),
  initialStock: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
    z.number({ invalid_type_error: "Initial stock must be a number" }).min(0).optional()
  ),
  sgstRate: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
    z.number({ invalid_type_error: "SGST rate must be a number" }).min(0, "SGST rate cannot be negative").optional()
  ),
  cgstRate: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : parseFloat(String(val))),
    z.number({ invalid_type_error: "CGST rate must be a number" }).min(0, "CGST rate cannot be negative").optional()
  ),
  hsnCode: z.string().optional(),
  variants: z.array(productVariantFormSchema).max(2, "Maximum of 2 variant types allowed").optional(),
  additionalChargeDefinitions: z.array(additionalChargeDefinitionSchema).optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface VariantFormSectionProps {
  variantIndex: number;
  removeVariant: (index: number) => void;
}

const VariantFormSection: React.FC<VariantFormSectionProps> = ({
  variantIndex,
  removeVariant,
}) => {
  const { control, register, formState: { errors }, watch, setFocus } = useFormContext<ProductFormData>();

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: `variants.${variantIndex}.options` as const,
  });

  const variantName = watch(`variants.${variantIndex}.name`);
  const trackQuantity = watch('trackQuantity');

  const handleOptionEnter = (e: React.KeyboardEvent<HTMLInputElement>, currentOptionIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentOptionValue = watch(`variants.${variantIndex}.options.${currentOptionIndex}.value`);
      if (currentOptionValue && currentOptionValue.trim() !== '') {
        appendOption({ value: '' });
        setTimeout(() => {
          setFocus(`variants.${variantIndex}.options.${optionFields.length}.value`);
        }, 50);
      }
    }
  };

  const handleVariantNameEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (optionFields.length === 0) {
        appendOption({ value: '' });
        setTimeout(() => setFocus(`variants.${variantIndex}.options.0.value`), 50);
      } else {
        setTimeout(() => setFocus(`variants.${variantIndex}.options.0.value`), 50);
      }
    }
  }

  return (
    <div className="space-y-3 border border-primary/20 p-4 rounded-md bg-tertiary shadow-sm">
      <div className="flex justify-between items-center">
        <Label htmlFor={`variants.${variantIndex}.name`} className="text-base font-medium text-primary">Variant Type {variantIndex + 1}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(variantIndex)} aria-label="Remove Variant Type">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Remove this variant type (e.g., Color, Size)</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        {...register(`variants.${variantIndex}.name`)}
        placeholder="e.g. Color, Size"
        aria-label={`Variant ${variantIndex + 1} Name`}
        onKeyDown={handleVariantNameEnter}
      />
      {errors.variants?.[variantIndex]?.name && <p className="text-sm text-destructive mt-1">{errors.variants[variantIndex]?.name?.message}</p>}

      <Label className="text-sm text-muted-foreground mt-2 block">
        Options for {variantName || `Variant Type ${variantIndex + 1}`}
        <span className="text-xs ml-2">{trackQuantity ? "(price & quantity per option)" : "(price per option)"}</span>
      </Label>
      <div className="space-y-2">
        {optionFields.map((optionValueField, optionIndex) => (
          <div key={optionValueField.id} className="p-3 bg-background border rounded-md space-y-3">
            <div className="flex items-center gap-2">
              <Input
                {...register(`variants.${variantIndex}.options.${optionIndex}.value`)}
                placeholder={`Option ${optionIndex + 1} Value (e.g. Red, Small)`}
                aria-label={`Variant ${variantIndex + 1} Option ${optionIndex + 1} Value`}
                onKeyDown={(e) => handleOptionEnter(e, optionIndex)}
              />
              {optionFields.length > 1 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(optionIndex)} className="h-8 w-8" aria-label="Remove Option Value">
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Remove this option value</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className={trackQuantity ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Cost (â‚¹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register(`variants.${variantIndex}.options.${optionIndex}.costPrice` as any)}
                  placeholder="Cost"
                  className="h-9 text-sm bg-muted/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Sell (â‚¹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register(`variants.${variantIndex}.options.${optionIndex}.sellPrice` as any)}
                  placeholder="Sell"
                  className="h-9 text-sm bg-muted/20"
                />
              </div>
              {trackQuantity && (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground uppercase tracking-wider">Qty</Label>
                  <Input
                    type="number"
                    step="any"
                    {...register(`variants.${variantIndex}.options.${optionIndex}.initialStock` as any)}
                    placeholder="Qty"
                    className="h-9 text-sm bg-muted/20"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {errors.variants?.[variantIndex]?.options?.root && <p className="text-sm text-destructive mt-1">{errors.variants[variantIndex]?.options?.root?.message}</p>}
        {Array.isArray(errors.variants?.[variantIndex]?.options) && (errors.variants?.[variantIndex]?.options as any).map((err: any, i: number) => err?.value?.message && <p key={i} className="text-sm text-destructive mt-1">{err.value.message}</p>)}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => {
          appendOption({ value: '' });
          setTimeout(() => {
            setFocus(`variants.${variantIndex}.options.${optionFields.length}.value`);
          }, 50);
        }}
      >
        <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Option Value
      </Button>
    </div>
  );
};


interface AdditionalChargesFormSectionProps {
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  setFocus: any;
}

const AdditionalChargesFormSection: React.FC<AdditionalChargesFormSectionProps> = ({ control, register, errors, watch, setValue, setFocus }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "additionalChargeDefinitions",
  });

  const handleChargeNameEnter = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setFocus(`additionalChargeDefinitions.${index}.value`);
    }
  };

  const handleChargeValueEnter = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const chargeType = watch(`additionalChargeDefinitions.${index}.type`);
      const chargeValue = watch(`additionalChargeDefinitions.${index}.value`);
      if (index === fields.length - 1 && watch(`additionalChargeDefinitions.${index}.name`) && chargeValue !== undefined) {
        append({ name: "", type: "fixed", value: undefined });
        setTimeout(() => setFocus(`additionalChargeDefinitions.${fields.length}.name`), 50);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-lg font-semibold text-primary flex items-center gap-2">
          <DollarSign size={20} /> Additional Charges (Optional)
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ name: "", type: "fixed", value: undefined })}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add Charge Definition
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2 mb-2">
        Define fixed or percentage-based charges associated with this product (e.g., Making Charges, Service Fee). These will be added as separate line items in sales bills. Percentage is based on the product's line item price.
      </p>
      {fields.map((field, index) => {
        const chargeType = watch(`additionalChargeDefinitions.${index}.type`);
        return (
          <Card key={field.id} className="p-4 bg-tertiary/50 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-4 items-start">
              <div className="space-y-1.5">
                <Label htmlFor={`additionalChargeDefinitions.${index}.name`}>Charge Name*</Label>
                <Input
                  {...register(`additionalChargeDefinitions.${index}.name`)}
                  id={`additionalChargeDefinitions.${index}.name`}
                  placeholder="e.g., Making Charge"
                  onKeyDown={(e) => handleChargeNameEnter(e, index)}
                />
                {errors.additionalChargeDefinitions?.[index]?.name && (
                  <p className="text-sm text-destructive mt-1">{errors.additionalChargeDefinitions[index].name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Charge Type*</Label>
                <Controller
                  control={control}
                  name={`additionalChargeDefinitions.${index}.type`}
                  render={({ field: { onChange, value } }) => (
                    <RadioGroup
                      defaultValue="fixed"
                      value={value}
                      onValueChange={(val) => onChange(val as 'fixed' | 'percentage')}
                      className="flex items-center gap-3 h-10"
                    >
                      <div className="flex items-center space-x-1.5">
                        <RadioGroupItem value="fixed" id={`ac-type-fixed-${index}-form`} />
                        <Label htmlFor={`ac-type-fixed-${index}-form`} className={cn("text-sm cursor-pointer flex items-center", value === 'fixed' && "text-primary font-semibold")}>
                          <HandCoins className={cn("mr-1.5 h-4 w-4", value === 'fixed' ? "text-primary" : "text-muted-foreground")} /> Fixed
                        </Label>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <RadioGroupItem value="percentage" id={`ac-type-percentage-${index}-form`} />
                        <Label htmlFor={`ac-type-percentage-${index}-form`} className={cn("text-sm cursor-pointer flex items-center", value === 'percentage' && "text-primary font-semibold")}>
                          <BadgePercent className={cn("mr-1.5 h-4 w-4", value === 'percentage' ? "text-primary" : "text-muted-foreground")} /> Percentage
                        </Label>
                      </div>
                    </RadioGroup>
                  )}
                />
              </div>

              <div className="flex items-end gap-2 md:col-span-2">
                <div className="space-y-1.5 flex-grow">
                  <Label htmlFor={`additionalChargeDefinitions.${index}.value`}>
                    {chargeType === 'fixed' ? 'Price (â‚¹)*' : 'Rate (%)*'}
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {chargeType === 'fixed' ?
                        <HandCoins className={cn("h-4 w-4", chargeType === 'fixed' ? "text-primary/70" : "text-muted-foreground")} /> :
                        <BadgePercent className={cn("h-4 w-4", chargeType === 'percentage' ? "text-primary/70" : "text-muted-foreground")} />
                      }
                    </div>
                    <Input
                      {...register(`additionalChargeDefinitions.${index}.value`)}
                      id={`additionalChargeDefinitions.${index}.value`}
                      type="number"
                      step={chargeType === 'fixed' ? "0.01" : "0.1"}
                      placeholder={chargeType === 'fixed' ? "0.00" : "0.0"}
                      className="pl-10"
                      onKeyDown={(e) => handleChargeValueEnter(e, index)}
                    />
                  </div>
                  {errors.additionalChargeDefinitions?.[index]?.value && (
                    <p className="text-sm text-destructive mt-1">{errors.additionalChargeDefinitions[index].value.message}</p>
                  )}
                  {errors.additionalChargeDefinitions?.[index]?.type && (
                    <p className="text-sm text-destructive mt-1">{errors.additionalChargeDefinitions[index].type.message}</p>
                  )}
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="self-center mb-1" aria-label="Remove Additional Charge">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Remove this charge definition</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </Card>
        )
      })}
      {errors.additionalChargeDefinitions?.root && (
        <p className="text-sm text-destructive mt-1">{errors.additionalChargeDefinitions.root.message}</p>
      )}
    </div>
  );
};


interface ProductFormProps {
  initialData?: Product | null;
  searchParams?: { [key: string]: string | string[] | undefined };
}

export function ProductForm({ initialData: initialProductProp, searchParams: routeSearchParamsProp }: ProductFormProps) {
  const {
    addProduct: addProductToStore,
    updateProduct: updateProductInStore,
    categories,
    addCategory: addCategoryToStore,
    getBillsForProduct, getSkuDetails,
  } = useInventoryStore();
  const { ensureLoaded } = useAppData();

  const { toast } = useToast();
  const router = useRouter();
  const nextSearchParams = useNextSearchParams();

  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<Product | null | undefined>(initialProductProp);
  const [isScannerOpen, setIsScannerOpen] = useState(false);


  const isEditing = !!initialData;

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '', description: '', category: '', trackQuantity: true, sku: '',
      costPrice: undefined, sellPrice: undefined,
      expiryDate: '', sgstRate: undefined, cgstRate: undefined, variants: [],
      additionalChargeDefinitions: [],
    },
  });

  const { control, register, handleSubmit, formState: { errors, isSubmitting }, watch, reset: formReset, setValue, setFocus } = form;

  const trackQuantityValue = watch('trackQuantity');
  const currentVariants = watch('variants');
  const hasVariants = Array.isArray(currentVariants) && currentVariants.length > 0;

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control, name: "variants",
  });

  useEffect(() => {
    setHasMounted(true);
    const storedCompanyId = localStorage.getItem('companyId');
    if (storedCompanyId) {
      setCurrentCompanyId(storedCompanyId);
      ensureLoaded(['categories']);
    } else {
      console.error("ProductForm: Company ID not found in localStorage.");
      toast({ variant: "destructive", title: "Error", description: "Company context is missing. Cannot manage products." });
    }
  }, [toast, ensureLoaded]);


  useEffect(() => {
    if (!hasMounted || !currentCompanyId) return;

    let defaults: ProductFormData = {
      name: '', description: '', category: '', trackQuantity: true, unit: DEFAULT_UNIT_VALUE, sku: '',
      costPrice: undefined, sellPrice: undefined, initialStock: undefined,
      expiryDate: '', sgstRate: undefined, cgstRate: undefined, variants: [],
      additionalChargeDefinitions: [],
    };

    if (isEditing && initialData) {
      const currentTrackQuantity = initialData.trackQuantity;
      const defaultSku = (!initialData.variants || initialData.variants.length === 0) && initialData.productSKUs.length > 0
        ? initialData.productSKUs[0]
        : undefined;
      const defaultSkuDetails = getSkuDetails(defaultSku);

      defaults = {
        name: initialData.name,
        description: initialData.description || '',
        category: initialData.category || '',
        trackQuantity: currentTrackQuantity,
        unit: initialData.unit || DEFAULT_UNIT_VALUE,
        sku: initialData.sku || '',
        costPrice: !currentTrackQuantity ? defaultSkuDetails.averageCostPrice ?? undefined : undefined,
        sellPrice: !currentTrackQuantity ? defaultSkuDetails.currentSellPrice ?? undefined : undefined,
        expiryDate: initialData.expiryDate ? initialData.expiryDate.split('T')[0] : '',
        sgstRate: initialData.sgstRate,
        cgstRate: initialData.cgstRate,
        hsnCode: initialData.hsnCode || '',
        variants: initialData.variants?.map(v => ({
          id: v.id, name: v.name,
          options: v.options.map(o => ({
            id: o.id, value: o.value,
            costPrice: (o as any).costPrice,
            sellPrice: (o as any).sellPrice,
            initialStock: (o as any).initialStock,
          }))
        })) || [],
        additionalChargeDefinitions: initialData.additionalChargeDefinitions?.map(ac => ({
          id: ac.id || uuidv4(),
          name: ac.name,
          type: ac.type || 'fixed',
          value: ac.value,
        })) || [],
      };
    } else if (!isEditing && routeSearchParamsProp && Object.keys(routeSearchParamsProp).length > 0) {
      defaults = {
        name: typeof routeSearchParamsProp.name === 'string' ? routeSearchParamsProp.name : '',
        description: '', category: '', trackQuantity: true, unit: DEFAULT_UNIT_VALUE, sku: '',
        costPrice: routeSearchParamsProp.costPrice ? parseFloat(routeSearchParamsProp.costPrice as string) : undefined,
        sellPrice: routeSearchParamsProp.sellPrice ? parseFloat(routeSearchParamsProp.sellPrice as string) : undefined,
        expiryDate: '', sgstRate: undefined, cgstRate: undefined, variants: [],
        additionalChargeDefinitions: [],
        initialStock: undefined
      };
    }
    formReset(defaults);
    setTimeout(() => setFocus('name'), 50);

  }, [hasMounted, currentCompanyId, initialData, isEditing, routeSearchParamsProp, formReset, setFocus, getSkuDetails]);


  const onSubmit = async (data: ProductFormData) => {
    if (!currentCompanyId) {
      toast({ variant: "destructive", title: "Error", description: "Company context is missing. Cannot save product." });
      return;
    }
    setIsLoading(true);

    if (data.category && !categories.find(c => c.name.toLowerCase() === data.category!.toLowerCase() && c.companyId === currentCompanyId)) {
      await addCategoryToStore(data.category!, currentCompanyId);
    }

    const productPayload: Omit<Product, 'id' | 'imageUrl' | 'productSKUs' | 'companyId'> & {
      costPriceForNonTracked?: number,
      sellPriceForNonTracked?: number,
      costPrice?: number,
      sellPrice?: number,
      initialStock?: number,
    } = {
      name: data.name, description: data.description, category: data.category,
      trackQuantity: data.trackQuantity, unit: data.unit || DEFAULT_UNIT_VALUE, sku: data.sku, expiryDate: data.expiryDate,
      sgstRate: data.sgstRate, cgstRate: data.cgstRate, hsnCode: data.hsnCode,
      variants: (data.variants || []).map(v_form => ({
        id: v_form.id || `variant-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: v_form.name,
        options: v_form.options.map(opt_form => ({
          id: opt_form.id || `option-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          value: opt_form.value,
          costPrice: opt_form.costPrice,
          sellPrice: opt_form.sellPrice,
          initialStock: opt_form.initialStock,
        }))
      })),
      additionalChargeDefinitions: data.additionalChargeDefinitions?.map(ac => ({
        id: ac.id || uuidv4(), name: ac.name, type: ac.type || 'fixed', value: ac.value
      })),
      initialStock: data.initialStock,
      costPrice: data.costPrice,
      sellPrice: data.sellPrice
    };

    if (!data.trackQuantity && (!productPayload.variants || productPayload.variants.length === 0)) {
      productPayload.costPriceForNonTracked = data.costPrice;
      productPayload.sellPriceForNonTracked = data.sellPrice;
    }

    let savedProduct: Product | null = null;

    if (isEditing && initialData) {
      savedProduct = await updateProductInStore(initialData.id, productPayload, currentCompanyId);
      if (savedProduct) {
        toast({ title: "Product Updated", description: `${data.name} has been updated successfully.` });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update product." });
      }
    } else {
      savedProduct = await addProductToStore(productPayload, currentCompanyId);
      if (savedProduct) {
        toast({ title: "Product Added", description: `${data.name} has been added to your inventory.` });
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: "Could not add product." });
      }
    }
    setIsLoading(false);

    if (savedProduct) {
      const returnToParam = nextSearchParams.get('returnTo');
      if (returnToParam) {
        const isNewProductFlow = !isEditing;
        const finalReturnUrl = isNewProductFlow
          ? `${decodeURIComponent(returnToParam)}&newlyAddedProductId=${savedProduct.id}`
          : decodeURIComponent(returnToParam);
        router.push(finalReturnUrl);
      } else {
        router.push('/admin/products');
      }
    }
  };

  if (!hasMounted && isEditing) {
    return <div className="flex-1 flex items-center justify-center p-6">Loading product form...</div>;
  }
  if (!currentCompanyId && hasMounted) {
    return <div className="flex-1 flex items-center justify-center p-6 text-destructive">Error: Company ID is missing. Cannot load product form.</div>;
  }


  const handleCodeScanned = (codeValue: string) => {
    setValue('sku', codeValue);
    setIsScannerOpen(false);
    toast({ title: "Code Scanned", description: `Product code set to: ${codeValue}` });
  };

  return (
    <div className="space-y-6">
      <UnifiedScannerModal
        isOpen={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleCodeScanned}
        purpose="updateProductSku"
        productNameForUpdate={watch('name') || 'Product'}
      />
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
                <CardDescription>Basic details for your product.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Product Name*</Label>
                  <Input id="name" {...register("name")} placeholder="Enter product name" />
                  {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <CategorySearchInput
                        id="category"
                        value={field.value || ''}
                        onValueChange={(value) => field.onChange(value)}
                        onCategorySelect={(categoryName) => field.onChange(categoryName)}
                        placeholder="Type or select category"
                      />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sku">Product Code/Base SKU <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                  <div className="flex items-center gap-2">
                    <Input id="sku" {...register("sku")} placeholder="e.g., PRD-00123" className="flex-1" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setIsScannerOpen(true)}
                            aria-label="Scan Barcode/QR"
                          >
                            <PackageSearch className="h-5 w-5 text-primary" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Scan Barcode/QR Code</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register("description")} placeholder="Enter detailed product description..." rows={4} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory & Pricing</CardTitle>
                <CardDescription>Manage stock tracking and pricing for this product.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2 pb-2">
                  <div className="flex items-center space-x-3">
                    <Controller
                      name="trackQuantity"
                      control={control}
                      render={({ field }) => (
                        <Checkbox id="trackQuantity" checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <Label htmlFor="trackQuantity" className="font-normal text-sm">Track inventory quantity for this product</Label>
                  </div>
                  <Controller
                    name="unit"
                    control={control}
                    render={({ field }) => {
                      const selected = getUnit(field.value) ?? getUnit(DEFAULT_UNIT_VALUE)!;
                      const Icon = selected.icon;
                      return (
                        <Select value={field.value ?? DEFAULT_UNIT_VALUE} onValueChange={field.onChange}>
                          <SelectTrigger id="product-unit" aria-label="Unit of measure">
                            <span className="flex items-center gap-2 min-w-0">
                              <Icon className="h-4 w-4 text-primary shrink-0" />
                              <SelectValue placeholder="Unit" />
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCT_UNITS.map(u => (
                              <SelectItem key={u.value} value={u.value}>
                                <span className="flex items-center gap-2">
                                  <u.icon className="h-4 w-4 text-muted-foreground" />
                                  {u.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                </div>

                {trackQuantityValue ? (
                  !hasVariants && (
                    <div className="space-y-4 border rounded-md p-4 bg-tertiary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <PackageSearch className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold text-sm">Initial Stock Entry (Optional)</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
                        You can add starting stock now. This will create an initial purchase record.
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="initialStock">Initial Quantity</Label>
                          <Input id="initialStock" type="number" step="any" {...register("initialStock")} placeholder="0" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="costPrice">Unit Cost Price</Label>
                          <Input id="costPrice" type="number" step="0.01" {...register("costPrice")} placeholder="0.00" />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="sellPrice">Unit Sell Price</Label>
                          <Input id="sellPrice" type="number" step="0.01" {...register("sellPrice")} placeholder="0.00" />
                        </div>
                      </div>
                      {errors.initialStock && <p className="text-sm text-destructive">{errors.initialStock.message}</p>}
                    </div>
                  )
                ) : (
                  !hasVariants && (
                    <>
                      <div className="text-xs text-muted-foreground italic p-3 border border-dashed rounded-md bg-tertiary/30 flex items-start gap-2">
                        <Info size={20} className="shrink-0 mt-0.5 text-primary" />
                        <span>
                          For non-tracked items (like services or digital goods without variants), set their standard cost and sell price below.
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor="costPrice">Cost Price</Label>
                          <Input id="costPrice" type="number" step="0.01" {...register("costPrice")} placeholder="0.00" />
                          {errors.costPrice && <p className="text-sm text-destructive mt-1">{errors.costPrice.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="sellPrice">Sell Price</Label>
                          <Input id="sellPrice" type="number" step="0.01" {...register("sellPrice")} placeholder="0.00" />
                          {errors.sellPrice && <p className="text-sm text-destructive mt-1">{errors.sellPrice.message}</p>}
                        </div>
                      </div>
                    </>
                  )
                )}

                {!trackQuantityValue && hasVariants && (
                  <div className="text-xs text-muted-foreground italic p-3 border border-dashed rounded-md bg-tertiary/30 flex items-start gap-2">
                    <Info size={20} className="shrink-0 mt-0.5 text-primary" />
                    <span>
                      This product has variants and quantity tracking is off â€” set the standard cost &amp; sell price for each option in its variant section below.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tax & Additional Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 pt-2">
                  <Label className="text-md font-semibold text-primary flex items-center gap-2"><Percent size={18} />Tax Rates (%)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="sgstRate">SGST Rate (%)</Label>
                      <Input id="sgstRate" type="number" step="0.01" {...register("sgstRate")} placeholder="e.g., 9 for 9%" />
                      {errors.sgstRate && <p className="text-sm text-destructive mt-1">{errors.sgstRate.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cgstRate">CGST Rate (%)</Label>
                      <Input id="cgstRate" type="number" step="0.01" {...register("cgstRate")} placeholder="e.g., 9 for 9%" />
                      {errors.cgstRate && <p className="text-sm text-destructive mt-1">{errors.cgstRate.message}</p>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hsnCode">HSN Code <span className="text-xs text-muted-foreground">(Optional for some businesses)</span></Label>
                  <Input id="hsnCode" {...register("hsnCode")} placeholder="e.g. 123456" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiryDate">Expiry Date <span className="text-xs text-muted-foreground">(Optional)</span></Label>
                  <Input id="expiryDate" type="date" {...register("expiryDate")} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
                <CardDescription>Define product variants like color or size. Maximum of 2 types.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {errors.variants?.root && <p className="text-sm text-destructive mt-1">{errors.variants.root.message}</p>}
                {variantFields.map((variantField, variantIndex) => (
                  <VariantFormSection
                    key={variantField.id}
                    variantIndex={variantIndex}
                    removeVariant={removeVariant}
                  />
                ))}
                {errors.variants && typeof errors.variants.message === 'string' && <p className="text-sm text-destructive mt-1">{errors.variants.message}</p>}
              </CardContent>
              {variantFields.length < 2 && (
                <CardFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendVariant({ name: "", options: [{ value: "" }] })}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Variant Type
                  </Button>
                </CardFooter>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Additional Charges</CardTitle>
                <CardDescription>Define fixed or percentage-based charges automatically added when this product is sold.</CardDescription>
              </CardHeader>
              <CardContent>
                <AdditionalChargesFormSection control={control} register={register} errors={errors} watch={watch} setValue={setValue} setFocus={setFocus} />
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push('/admin/products')} disabled={isSubmitting || isLoading}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting || isLoading} disabled={!currentCompanyId}>
                {isEditing ? 'Save Changes' : 'Add Product'}
              </Button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
