
"use client";

import React, { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { useToast } from '@/hooks/use-toast';
import type { Product, ProductVariant as ProductVariantType, ProductOption as ProductOptionType, AdditionalChargeDefinition } from '@/types';
import { CategorySearchInput } from './category-search-input';
import { PlusCircle, Trash2, Percent, DollarSign, BadgePercent, HandCoins, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PRODUCT_UNITS, DEFAULT_UNIT_VALUE, getUnit } from '@/lib/units';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { v4 as uuidv4 } from 'uuid';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const additionalChargeDefinitionDialogSchema = z.object({
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


const productOptionSchema = z.object({
  id: z.string().optional(),
  value: z.string().min(1, "Option value cannot be empty"),
  // Allow per-variant pricing and stock
  costPrice: z.preprocess((val) => (val === "" ? undefined : parseFloat(String(val))), z.number().optional()),
  sellPrice: z.preprocess((val) => (val === "" ? undefined : parseFloat(String(val))), z.number().optional()),
  initialStock: z.preprocess((val) => (val === "" ? undefined : parseFloat(String(val))), z.number().optional()),
});

const productVariantFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Variant name cannot be empty"),
  options: z.array(productOptionSchema).min(1, "At least one option is required for a variant."),
});

const newProductDialogSchema = z.object({
  name: z.string().min(2, { message: "Product name must be at least 2 characters." }),
  description: z.string().optional(),
  category: z.string().optional().default(''),
  trackQuantity: z.boolean().default(true),
  unit: z.string().optional(),
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
    z.number({ invalid_type_error: "Initial stock must be a number" }).optional()
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
  additionalChargeDefinitions: z.array(additionalChargeDefinitionDialogSchema).optional(),
});

type NewProductDialogFormData = z.infer<typeof newProductDialogSchema>;

interface VariantFormSectionProps {
  variantIndex: number;
  removeVariant: (index: number) => void;
}

const VariantFormSection: React.FC<VariantFormSectionProps> = ({
  variantIndex,
  removeVariant,
}) => {
  const { control, register, formState: { errors }, watch, setFocus } = useFormContext<NewProductDialogFormData>();

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control,
    name: `variants.${variantIndex}.options` as const,
  });

  const variantName = watch(`variants.${variantIndex}.name`);
  const mainCostPrice = watch('costPrice');
  const mainSellPrice = watch('sellPrice');
  const trackQuantity = watch('trackQuantity');

  const handleOptionEnter = (e: React.KeyboardEvent<HTMLInputElement>, currentOptionIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentOptionValue = watch(`variants.${variantIndex}.options.${currentOptionIndex}.value`);
      if (currentOptionValue && currentOptionValue.trim() !== '') {
        appendOption({ value: '', costPrice: mainCostPrice, sellPrice: mainSellPrice, initialStock: 0 });
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
        appendOption({ value: '', costPrice: mainCostPrice, sellPrice: mainSellPrice, initialStock: 0 });
        setTimeout(() => setFocus(`variants.${variantIndex}.options.0.value`), 50);
      } else {
        setTimeout(() => setFocus(`variants.${variantIndex}.options.0.value`), 50);
      }
    }
  }

  return (
    <div className="space-y-4 border border-primary/20 p-4 rounded-md bg-tertiary shadow-sm">
      <div className="flex justify-between items-center">
        <Label htmlFor={`variants.${variantIndex}.name`} className="text-sm font-medium text-primary">Variant Type {variantIndex + 1}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(variantIndex)} aria-label="Remove Variant Type">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>Remove this variant type</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Input
        {...register(`variants.${variantIndex}.name`)}
        placeholder="e.g. Color, Size"
        aria-label={`Variant ${variantIndex + 1} Name`}
        onKeyDown={handleVariantNameEnter}
      />
      {errors.variants?.[variantIndex]?.name && <p className="text-xs text-destructive mt-0.5">{errors.variants[variantIndex]?.name?.message}</p>}

      <Label className="text-xs text-muted-foreground mt-2 block">Options for {variantName || `Variant Type ${variantIndex + 1}`}</Label>
      <div className="space-y-3">
        {optionFields.map((optionValueField, optionIndex) => (
          <div key={optionValueField.id} className="p-3 bg-background border rounded-md space-y-3">
            <div className="flex items-center gap-2">
              <Input
                {...register(`variants.${variantIndex}.options.${optionIndex}.value`)}
                placeholder={`Option Value (e.g. Red)`}
                className="font-medium"
                onKeyDown={(e) => handleOptionEnter(e, optionIndex)}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(optionIndex)} className="h-9 w-9 shrink-0 text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className={trackQuantity ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cost (â‚¹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register(`variants.${variantIndex}.options.${optionIndex}.costPrice` as any)}
                  defaultValue={mainCostPrice}
                  placeholder="Cost"
                  className="h-8 text-xs bg-muted/20"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sell (â‚¹)</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register(`variants.${variantIndex}.options.${optionIndex}.sellPrice` as any)}
                  defaultValue={mainSellPrice}
                  placeholder="Sell"
                  className="h-8 text-xs bg-muted/20"
                />
              </div>
              {trackQuantity && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Qty</Label>
                  <Input
                    type="number"
                    step="any"
                    {...register(`variants.${variantIndex}.options.${optionIndex}.initialStock` as any)}
                    placeholder="Qty"
                    className="h-8 text-xs bg-muted/20"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        {errors.variants?.[variantIndex]?.options?.root && <p className="text-xs text-destructive mt-0.5">{errors.variants[variantIndex]?.options?.root?.message}</p>}
        {Array.isArray(errors.variants?.[variantIndex]?.options) && (errors.variants?.[variantIndex]?.options as any).map((err: any, i: number) => err?.value?.message && <p key={i} className="text-xs text-destructive mt-0.5">{err.value.message}</p>)}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs w-full"
        onClick={() => {
          appendOption({ value: '', costPrice: mainCostPrice, sellPrice: mainSellPrice, initialStock: 0 });
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

interface AdditionalChargesDialogSectionProps {
  control: any;
  register: any;
  errors: any;
  watch: any;
  setValue: any;
  setFocus: any;
}

const AdditionalChargesDialogSection: React.FC<AdditionalChargesDialogSectionProps> = ({ control, register, errors, watch, setValue, setFocus }) => {
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
        append({ name: "", type: 'fixed', value: undefined });
        setTimeout(() => setFocus(`additionalChargeDefinitions.${fields.length}.name`), 50);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium text-primary">Additional Charges</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => {
            append({ name: "", type: "fixed", value: undefined });
            setTimeout(() => setFocus(`additionalChargeDefinitions.${fields.length}.name`), 50);
          }}
        >
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Charge
        </Button>
      </div>
      {fields.map((field, index) => {
        const chargeType = watch(`additionalChargeDefinitions.${index}.type`);
        return (
          <div key={field.id} className="p-3 border rounded-md bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`additionalChargeDefinitions.${index}.name`} className="text-xs font-medium">Charge Name*</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-7 w-7" aria-label="Remove Charge">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Remove this charge</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              {...register(`additionalChargeDefinitions.${index}.name`)}
              id={`additionalChargeDefinitions.${index}.name`}
              placeholder="e.g., Making Charge"
              className="h-9 text-sm"
              onKeyDown={(e) => handleChargeNameEnter(e, index)}
            />
            {errors.additionalChargeDefinitions?.[index]?.name && (
              <p className="text-xs text-destructive mt-0.5">{errors.additionalChargeDefinitions[index].name.message}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Label className="text-xs">Type:</Label>
              <Controller
                control={control}
                name={`additionalChargeDefinitions.${index}.type`}
                render={({ field: { onChange, value } }) => (
                  <RadioGroup
                    defaultValue="fixed"
                    value={value}
                    onValueChange={(val) => onChange(val as 'fixed' | 'percentage')}
                    className="flex items-center gap-2"
                  >
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="fixed" id={`ac-type-fixed-${index}`} />
                      <Label htmlFor={`ac-type-fixed-${index}`} className={cn("text-xs cursor-pointer", value === 'fixed' && "text-primary font-semibold")}>Fixed (â‚¹)</Label>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="percentage" id={`ac-type-percentage-${index}`} />
                      <Label htmlFor={`ac-type-percentage-${index}`} className={cn("text-xs cursor-pointer", value === 'percentage' && "text-primary font-semibold")}>Percentage (%)</Label>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>

            <div className="relative">
              <Label htmlFor={`additionalChargeDefinitions.${index}.value`} className="text-xs">
                {chargeType === 'fixed' ? 'Price (â‚¹)*' : 'Rate (%)*'}
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {chargeType === 'fixed' ?
                    <HandCoins className={cn("h-4 w-4 text-muted-foreground", chargeType === 'fixed' && "text-primary/80")} /> :
                    <BadgePercent className={cn("h-4 w-4 text-muted-foreground", chargeType === 'percentage' && "text-primary/80")} />
                  }
                </div>
                <Input
                  {...register(`additionalChargeDefinitions.${index}.value`)}
                  id={`additionalChargeDefinitions.${index}.value`}
                  type="number"
                  step={chargeType === 'fixed' ? "0.01" : "0.1"}
                  placeholder={chargeType === 'fixed' ? "0.00" : "0.0"}
                  className="h-9 text-sm pl-10"
                  onKeyDown={(e) => handleChargeValueEnter(e, index)}
                />
              </div>
            </div>
            {errors.additionalChargeDefinitions?.[index]?.value && (
              <p className="text-xs text-destructive mt-0.5">{errors.additionalChargeDefinitions[index].value.message}</p>
            )}
            {errors.additionalChargeDefinitions?.[index]?.type && (
              <p className="text-xs text-destructive mt-0.5">{errors.additionalChargeDefinitions[index].type.message}</p>
            )}
          </div>
        )
      })}
      {errors.additionalChargeDefinitions?.root && (
        <p className="text-xs text-destructive mt-0.5">{errors.additionalChargeDefinitions.root.message}</p>
      )}
      {Array.isArray(errors.additionalChargeDefinitions) && errors.additionalChargeDefinitions.map((err: any, i: number) => (
        (err?.name?.message || err?.value?.message || err?.type?.message) && (
          <div key={i} className="text-xs text-destructive mt-0.5">
            {err.name?.message && <p>Charge {i + 1} Name: {err.name.message}</p>}
            {err.type?.message && <p>Charge {i + 1} Type: {err.type.message}</p>}
            {err.value?.message && <p>Charge {i + 1} Value: {err.value.message}</p>}
          </div>
        )
      ))}
    </div>
  );
};


interface NewProductDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProductAdded: (newProduct: Product) => void;
  initialValues?: {
    name?: string;
    quantity?: string;
    costPrice?: string;
    sellPrice?: string;
  } | null;
  editingProduct?: Product | null;
}

export function NewProductDialog({
  isOpen,
  onOpenChange,
  onProductAdded,
  initialValues,
  editingProduct,
}: NewProductDialogProps) {
  const { addProduct, updateProduct, categories, addCategory: addCategoryToStore } = useInventoryStore();
  const { toast } = useToast();
  const { ensureLoaded } = useAppData();
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);

  const form = useForm<NewProductDialogFormData>({
    resolver: zodResolver(newProductDialogSchema),
    defaultValues: {
      name: initialValues?.name || '',
      description: '',
      category: '',
      trackQuantity: initialValues?.quantity ? true : true,
      unit: DEFAULT_UNIT_VALUE,
      costPrice: initialValues?.costPrice ? parseFloat(initialValues.costPrice) : undefined,
      sellPrice: initialValues?.sellPrice ? parseFloat(initialValues.sellPrice) : undefined,
      initialStock: initialValues?.quantity ? parseFloat(initialValues.quantity) : undefined,
      sgstRate: undefined,
      cgstRate: undefined,
      hsnCode: '',
      variants: [],
      additionalChargeDefinitions: [],
    },
  });

  const { control, register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setFocus, setValue } = form;

  const trackQuantityValue = watch('trackQuantity');
  const currentVariants = watch('variants');
  const hasVariants = Array.isArray(currentVariants) && currentVariants.length > 0;
  const mainCostPrice = watch('costPrice');
  const mainSellPrice = watch('sellPrice');

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: "variants",
  });

  useEffect(() => {
    const companyIdFromStorage = localStorage.getItem('companyId');
    if (companyIdFromStorage) {
      setCurrentCompanyId(companyIdFromStorage);
      if (isOpen) {
        ensureLoaded(['categories']);
      }
    }
  }, [isOpen, ensureLoaded]);


  useEffect(() => {
    if (isOpen) {
    if (editingProduct) {
        const defaultSku = editingProduct.productSKUs?.[0];
        const layerStock = defaultSku?.stockLayers?.reduce((sum, l) => sum + (l.quantity || 0), 0);
        reset({
          name: editingProduct.name || '',
          description: editingProduct.description || '',
          category: editingProduct.category || '',
          trackQuantity: editingProduct.trackQuantity ?? true,
          unit: editingProduct.unit || DEFAULT_UNIT_VALUE,
          costPrice: defaultSku?.stockLayers?.[0]?.costPrice ?? undefined,
          sellPrice: defaultSku?.stockLayers?.[0]?.sellPrice ?? undefined,
          initialStock: layerStock || undefined,
          sgstRate: editingProduct.sgstRate ?? undefined,
          cgstRate: editingProduct.cgstRate ?? undefined,
          hsnCode: editingProduct.hsnCode || '',
          variants: (editingProduct.variants || []).map(v => ({
            id: v.id || '',
            name: v.name,
            options: (v.options || []).map((opt: any) => ({
              id: opt.id || '',
              value: opt.value,
              costPrice: opt.costPrice ?? undefined,
              sellPrice: opt.sellPrice ?? undefined,
              initialStock: undefined,
            })),
          })),
          additionalChargeDefinitions: editingProduct.additionalChargeDefinitions || [],
        });
      } else {
        const defaultTrackQuantity = initialValues?.quantity ? true : true;
        reset({
          name: initialValues?.name || '',
          description: '',
          category: '',
          trackQuantity: defaultTrackQuantity,
          unit: DEFAULT_UNIT_VALUE,
          costPrice: initialValues?.costPrice ? parseFloat(initialValues.costPrice) : undefined,
          sellPrice: initialValues?.sellPrice ? parseFloat(initialValues.sellPrice) : undefined,
          initialStock: defaultTrackQuantity && initialValues?.quantity ? parseFloat(initialValues.quantity) : undefined,
          sgstRate: undefined,
          cgstRate: undefined,
          hsnCode: '',
          variants: [],
          additionalChargeDefinitions: [],
        });
      }
      setTimeout(() => setFocus('name'), 100);
    }
  }, [isOpen, initialValues, editingProduct, reset, setFocus]);

  const onSubmit = async (data: NewProductDialogFormData) => {
    if (!currentCompanyId) {
      toast({ variant: "destructive", title: "Error", description: "Company context is missing." });
      return;
    }

    const productVariantsPayload: any[] = (data.variants || []).map(v_form => ({
      id: v_form.id || `variant-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: v_form.name,
      options: v_form.options.map((opt_form: any) => ({
        id: opt_form.id || `option-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        value: opt_form.value,
        costPrice: opt_form.costPrice,
        sellPrice: opt_form.sellPrice,
        initialStock: opt_form.initialStock
      }))
    }));

    if (data.category && !categories.find(c => c.name.toLowerCase() === data.category!.toLowerCase() && c.companyId === currentCompanyId)) {
      await addCategoryToStore(data.category!, currentCompanyId);
    }

    const productToSaveBase: Omit<Product, 'id' | 'imageUrl' | 'productSKUs' | 'companyId'> & { costPriceForNonTracked?: number, sellPriceForNonTracked?: number } = {
      name: data.name,
      description: data.description,
      category: data.category,
      trackQuantity: data.trackQuantity,
      unit: data.unit || DEFAULT_UNIT_VALUE,
      variants: productVariantsPayload,
      sgstRate: data.sgstRate,
      cgstRate: data.cgstRate,
      hsnCode: data.hsnCode,
      additionalChargeDefinitions: data.additionalChargeDefinitions?.map(ac => ({
        ...ac,
        id: ac.id || uuidv4(),
        type: ac.type || 'fixed',
      })) || [],
    };

    const noVariants = !productVariantsPayload || productVariantsPayload.length === 0;

    if (noVariants) {
      if (data.trackQuantity) {
        // For tracked products, pass cost/sell/stock as transient fields
        // (the API strips them and uses them for the initial stock layer)
        (productToSaveBase as any).initialStock = data.initialStock;
        (productToSaveBase as any).costPrice = data.costPrice;
        (productToSaveBase as any).sellPrice = data.sellPrice;
      } else {
        productToSaveBase.costPriceForNonTracked = data.costPrice;
        productToSaveBase.sellPriceForNonTracked = data.sellPrice;
      }
    }

    if (editingProduct) {
      const updatedProduct = await updateProduct(editingProduct.id, productToSaveBase, currentCompanyId);
      if (updatedProduct) {
        toast({ title: "Product Updated", description: `${updatedProduct.name} has been updated.` });
        onProductAdded(updatedProduct);
        onOpenChange(false);
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update product via API." });
      }
    } else {
      const newProduct = await addProduct(productToSaveBase, currentCompanyId);
      if (newProduct) {
        toast({ title: "Product Added", description: `${newProduct.name} has been added.` });
        onProductAdded(newProduct);
        onOpenChange(false);
      } else {
        toast({ variant: "destructive", title: "Add Failed", description: "Could not add product via API." });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] border-t-4 border-t-primary shadow-lg p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product (Quick Add)'}</DialogTitle>
          <DialogDescription>
            {editingProduct ? 'Update product details.' : 'Quickly add a new product. For more detailed setup, use the main Products page.'}
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 overflow-hidden flex-1">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="dialog-product-name">Product Name*</Label>
                  <Input id="dialog-product-name" {...register("name")} placeholder="Enter product name" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="dialog-category">Category</Label>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <CategorySearchInput
                          id="dialog-category"
                          value={field.value || ''}
                          onValueChange={(value) => field.onChange(value)}
                          onCategorySelect={(categoryName) => field.onChange(categoryName)}
                          placeholder="Type or select category"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-1.5 flex items-center pt-6">
                    <Controller
                      name="trackQuantity"
                      control={control}
                      render={({ field }) => (
                        <Checkbox id="dialog-trackQuantity" checked={field.value} onCheckedChange={field.onChange} />
                      )}
                    />
                    <Label htmlFor="dialog-trackQuantity" className="font-normal text-sm ml-2">Track inventory quantity</Label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dialog-unit">Unit</Label>
                  <Controller
                    name="unit"
                    control={control}
                    render={({ field }) => {
                      const selected = getUnit(field.value) ?? getUnit(DEFAULT_UNIT_VALUE)!;
                      const Icon = selected.icon;
                      return (
                        <Select value={field.value ?? DEFAULT_UNIT_VALUE} onValueChange={field.onChange}>
                          <SelectTrigger id="dialog-unit" aria-label="Unit of measure">
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

                <div className="space-y-1.5">
                  <Label htmlFor="dialog-description">Description</Label>
                  <Textarea id="dialog-description" {...register("description")} placeholder="Enter product description (optional)" rows={2} />
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-md font-semibold text-primary flex items-center gap-2"><Percent size={18} />Tax Rates (%)</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="dialog-sgstRate">SGST Rate (%)</Label>
                      <Input id="dialog-sgstRate" type="number" step="0.01" {...register("sgstRate")} placeholder="e.g., 9 for 9%" />
                      {errors.sgstRate && <p className="text-xs text-destructive mt-1">{errors.sgstRate.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dialog-cgstRate">CGST Rate (%)</Label>
                      <Input id="dialog-cgstRate" type="number" step="0.01" {...register("cgstRate")} placeholder="e.g., 9 for 9%" />
                      {errors.cgstRate && <p className="text-xs text-destructive mt-1">{errors.cgstRate.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dialog-hsnCode">HSN Code</Label>
                      <Input id="dialog-hsnCode" {...register("hsnCode")} placeholder="e.g. 123456" />
                    </div>
                  </div>
                </div>

                {/* Main Cost/Sell Price - only for products WITHOUT variants.
                    Variant products ask prices per option below instead. */}
                {!hasVariants && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="dialog-costPrice">Cost Price</Label>
                      <Input id="dialog-costPrice" type="number" step="0.01" {...register("costPrice")} placeholder="0.00" />
                      {errors.costPrice && <p className="text-xs text-destructive mt-1">{errors.costPrice.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="dialog-sellPrice">Sell Price</Label>
                      <Input id="dialog-sellPrice" type="number" step="0.01" {...register("sellPrice")} placeholder="0.00" />
                      {errors.sellPrice && <p className="text-xs text-destructive mt-1">{errors.sellPrice.message}</p>}
                    </div>
                  </div>
                )}

                {hasVariants && (
                  <div className="text-xs text-muted-foreground italic p-3 border border-dashed rounded-md bg-tertiary/30 flex items-start gap-2">
                    <Info size={16} className="shrink-0 mt-0.5 text-primary" />
                    <span>
                      This product has variants â€” set the price (and quantity, if tracked) for each option in its variant section below.
                    </span>
                  </div>
                )}
                {!hasVariants && trackQuantityValue && (
                  <div className="space-y-1.5 mt-2">
                    <Label htmlFor="dialog-initialStock">Initial Stock Quantity</Label>
                    <Input id="dialog-initialStock" type="number" step="any" {...register("initialStock")} placeholder="0" />
                    {errors.initialStock && <p className="text-xs text-destructive mt-1">{errors.initialStock.message}</p>}
                  </div>
                )}

                <Separator className="my-4" />
                <AdditionalChargesDialogSection control={control} register={register} errors={errors} watch={watch} setValue={setValue} setFocus={setFocus} />

                <Separator className="my-4" />
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-md font-semibold text-primary">Variants (Max 2)</Label>
                    {variantFields.length < 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => appendVariant({ name: "", options: [{ value: "", costPrice: mainCostPrice, sellPrice: mainSellPrice, initialStock: 0 }] })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Variant Type
                      </Button>
                    )}
                  </div>
                  {errors.variants?.root && <p className="text-xs text-destructive mt-1">{errors.variants.root.message}</p>}
                  {variantFields.map((variantField, variantIndex) => (
                    <VariantFormSection
                      key={variantField.id}
                      variantIndex={variantIndex}
                      removeVariant={removeVariant}
                    />
                  ))}
                  {errors.variants && typeof errors.variants.message === 'string' && <p className="text-xs text-destructive mt-1">{errors.variants.message}</p>}
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" isLoading={isSubmitting} disabled={!currentCompanyId}>{editingProduct ? 'Update Product' : 'Add Product'}</Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
