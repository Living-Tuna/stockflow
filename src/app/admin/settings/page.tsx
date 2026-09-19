
"use client";

import React, { useState, useEffect } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, Company, CurrencyOption } from '@/types';
import { Settings as SettingsIcon, Save, StickyNote, CreditCard, Palette, Info, Globe, Languages, Check } from 'lucide-react';
import { useTheme } from "next-themes";
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { PrinterSettingsCard } from '@/components/settings/printer-settings-card';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY_CODE } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const THEME_STORAGE_KEY = "app-color-theme";

const themes = [
  { name: 'default', color: 'hsl(142.1 76.2% 36.3%)' },
  { name: 'zinc', color: 'hsl(240 5.9% 10%)' },
  { name: 'slate', color: 'hsl(215.4 16.3% 46.9%)' },
  { name: 'red', color: 'hsl(0 72.2% 50.6%)' },
  { name: 'orange', color: 'hsl(24.6 95% 53.1%)' },
  { name: 'green', color: 'hsl(142.1 76.2% 36.3%)' },
  { name: 'blue', color: 'hsl(221.2 83.2% 53.3%)' },
  { name: 'violet', color: 'hsl(262.1 83.3% 57.8%)' },
  { name: 'rose', color: 'hsl(346.8 77.2% 49.8%)' },
];

function ThemeSelector() {
  const [activeTheme, setActiveTheme] = useState('default');
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'default';
    setActiveTheme(savedTheme);
  }, []);

  const handleThemeChange = (themeName: string) => {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    setActiveTheme(themeName);
  };

  if (!hasMounted) {
    return null; // or a skeleton loader
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-3">
      {themes.map((theme) => (
        <TooltipProvider key={theme.name}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-14 w-14 rounded-full border-2 transition-all",
                  activeTheme === theme.name ? "border-primary ring-2 ring-primary/50" : "border-muted-foreground/30 hover:border-primary/50"
                )}
                style={{ backgroundColor: theme.color }}
                onClick={() => handleThemeChange(theme.name)}
                aria-label={`Select ${theme.name} theme`}
              >
                {activeTheme === theme.name && <Check className="h-6 w-6 text-white" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="capitalize">{theme.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}


export default function SettingsPage() {
  const { 
    userProfile, 
    updateUserProfileFields, 
  } = useInventoryStore();
  const { toast } = useToast();
  const { theme } = useTheme();

  const [defaultBillNotes, setDefaultBillNotes] = useState('');
  const [defaultSalesPaymentStatus, setDefaultSalesPaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [defaultPurchasePaymentStatus, setDefaultPurchasePaymentStatus] = useState<'paid' | 'unpaid'>('paid');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(DEFAULT_CURRENCY_CODE);
  
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const { ensureLoaded } = useAppData();

  useEffect(() => {
    setHasMounted(true);
    const companyIdFromStorage = localStorage.getItem('companyId');
    if (companyIdFromStorage) {
      setCurrentCompanyId(companyIdFromStorage);
      setIsLoading(true);
      ensureLoaded(['profile'])
        .then(() => setIsLoading(false))
        .catch(() => {
          toast({ variant: "destructive", title: "Error", description: "Could not load company settings." });
          setIsLoading(false);
        });
    } else {
      toast({ variant: "destructive", title: "Error", description: "Company context not found."});
      setIsLoading(false);
    }
  }, [ensureLoaded, toast]);

  useEffect(() => {
    if (hasMounted && !isLoading && userProfile) {
      setDefaultBillNotes(userProfile.defaultBillNotes || '');
      setDefaultSalesPaymentStatus(userProfile.defaultSalesPaymentStatus || 'paid');
      setDefaultPurchasePaymentStatus(userProfile.defaultPurchasePaymentStatus || 'paid');
      setSelectedCurrency(userProfile.companyCurrency || DEFAULT_CURRENCY_CODE);
    }
  }, [hasMounted, isLoading, userProfile]);

  const handleSaveSetting = async (
    field: keyof Pick<Company, 'defaultBillNotes' | 'defaultSalesPaymentStatus' | 'defaultPurchasePaymentStatus' | 'currency'>, 
    value: any, 
    successMessage: string
  ) => {
    if (!currentCompanyId) {
      toast({ variant: "destructive", title: "Error", description: "Company context missing. Cannot save settings."});
      return;
    }
    try {
      await updateUserProfileFields({ [field]: value } as Partial<Omit<Company, 'id'|'token'>>, currentCompanyId);
      toast({ title: 'Setting Saved', description: successMessage });
    } catch (error) {
      toast({ variant: "destructive", title: "Save Failed", description: "Could not save setting." });
    }
  };

  if (!hasMounted || isLoading || !userProfile || !currentCompanyId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <SettingsIcon className="h-12 w-12 text-muted-foreground mb-4 animate-pulse" />
        <p className="text-lg text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Application Settings" icon={SettingsIcon} />

      <PrinterSettingsCard />

      <Card className="shadow-md border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary"/>Appearance</CardTitle>
          <CardDescription>Manage application theme and color preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Color Theme</Label>
            <p className="text-xs text-muted-foreground">Select a color scheme for the application interface.</p>
            <ThemeSelector />
          </div>
          <div className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
              <div className="space-y-0.5">
                  <Label className="text-sm">Light/Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">
                      Current mode: <span className="font-semibold capitalize text-foreground">{theme}</span>.
                  </p>
              </div>
              <ThemeToggle />
          </div>
        </CardContent>
      </Card>


      <Card className="shadow-md border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><StickyNote className="h-5 w-5 text-primary"/>Billing Defaults</CardTitle>
          <CardDescription>Set default values for new bills to speed up your workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-1.5">
            <Label htmlFor="defaultBillNotes">Default Bill Notes</Label>
            <Textarea
              id="defaultBillNotes"
              value={defaultBillNotes}
              onChange={(e) => setDefaultBillNotes(e.target.value)}
              placeholder="e.g., Thank you for your business!"
              rows={3}
            />
             <Button 
              size="sm" 
              onClick={() => handleSaveSetting('defaultBillNotes', defaultBillNotes, 'Default bill notes updated.')}
              className="mt-2"
            >
              <Save className="mr-2 h-4 w-4"/> Save Notes
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label htmlFor="defaultSalesStatus">Default Sales Bill Payment Status</Label>
              <Select
                value={defaultSalesPaymentStatus}
                onValueChange={(value: 'paid' | 'unpaid') => {
                  setDefaultSalesPaymentStatus(value); 
                  handleSaveSetting('defaultSalesPaymentStatus', value, 'Default sales payment status updated.');
                }}
              >
                <SelectTrigger id="defaultSalesStatus" className="select-trigger-class">
                  <SelectValue placeholder="Select default status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="defaultPurchaseStatus">Default Purchase Bill Payment Status</Label>
              <Select
                value={defaultPurchasePaymentStatus}
                onValueChange={(value: 'paid' | 'unpaid') => {
                  setDefaultPurchasePaymentStatus(value); 
                  handleSaveSetting('defaultPurchasePaymentStatus', value, 'Default purchase payment status updated.');
                }}
              >
                <SelectTrigger id="defaultPurchaseStatus" className="select-trigger-class">
                  <SelectValue placeholder="Select default status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary"/>Localization</CardTitle>
          <CardDescription>Manage currency and language preferences for the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currencySelect">Default Currency</Label>
              <Select
                value={selectedCurrency}
                onValueChange={(value: string) => {
                  setSelectedCurrency(value);
                  handleSaveSetting('currency', value, `Default currency updated to ${value}.`);
                }}
              >
                <SelectTrigger id="currencySelect" className="select-trigger-class w-full md:w-1/2">
                  <SelectValue placeholder="Select default currency" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((currency: CurrencyOption) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.name} ({currency.symbol} - {currency.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selected currency will be used for displaying monetary values across the application.
              </p>
            </div>
             <div className="space-y-1.5">
                <Label htmlFor="languageSelect" className="flex items-center gap-1.5">
                    <Languages className="h-4 w-4 text-muted-foreground"/> Application Language
                </Label>
                <Select disabled value="en">
                    <SelectTrigger id="languageSelect" className="select-trigger-class w-full md:w-1/2">
                        <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="en">English (United States)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                    Multi-language support is planned for a future update. Currently, only English is available.
                </p>
            </div>
        </CardContent>
      </Card>
      
       <Card className="shadow-md border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary"/>More Settings</CardTitle>
          <CardDescription>
            This section can be expanded with more application-wide settings as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Examples of future settings:
          </p>
          <ul className="list-disc list-inside mt-2 text-xs text-muted-foreground space-y-1">
            <li>Date and time zone settings.</li>
            <li>Notification preferences (e.g., low stock alerts).</li>
            <li>Data import/export options for various modules.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
