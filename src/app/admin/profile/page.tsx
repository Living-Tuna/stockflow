
"use client";

import { useState, useEffect } from 'react';
import { PageTitle } from '@/components/common/page-title';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';
import type { SubscriptionPlan, UserProfile, Company } from '@/types';
import { CheckCircle, Edit3, Save, User, BadgeCheck, Mail, Building, Phone, FileText, Image as ImageIcon, PenLine, Info, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import NextImage from 'next/image'; 
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface EditableProfileFieldProps {
  fieldId: keyof Omit<Company, 'id' | 'token' | 'activeSubscriptionId'>; // Exclude fields not directly editable here
  label: string;
  currentValue: string | undefined | null;
  onSave: (newValue: string) => Promise<void> | void;
  inputType?: 'text' | 'textarea' | 'tel' | 'url';
  placeholder?: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

const EditableProfileField: React.FC<EditableProfileFieldProps> = ({
  fieldId,
  label,
  currentValue,
  onSave,
  inputType = 'text',
  placeholder,
  icon: Icon,
  disabled = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentValue || '');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setInputValue(currentValue || '');
  }, [currentValue]);

  const handleSave = async () => {
    if (fieldId === 'name' && inputValue.trim() === '') { 
      toast({ variant: 'destructive', title: 'Error', description: `${label} cannot be empty.` });
      return;
    }
    setIsSaving(true);
    try {
      await onSave(inputValue.trim());
      setIsEditing(false);
      toast({ title: 'Success', description: `${label} updated.` });
    } catch (error) {
      console.error("Error saving profile field:", error);
      toast({ variant: 'destructive', title: 'Save Failed', description: `Could not update ${label}.` });
    } finally {
      setIsSaving(false);
    }
  };

  const InputComponent = inputType === 'textarea' ? Textarea : Input;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId as string} className="flex items-center gap-1.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </Label>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <InputComponent
            id={fieldId as string}
            // @ts-ignore
            type={inputType === 'textarea' ? undefined : inputType}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            className={cn("flex-grow", inputType === 'textarea' && 'min-h-[60px]')}
            rows={inputType === 'textarea' ? 3 : undefined}
            disabled={disabled || isSaving}
          />
        ) : (
          <div className="flex-grow p-2 border border-input rounded-md min-h-[40px] flex items-center bg-muted/30 text-sm">
            {currentValue || <span className="text-muted-foreground italic">Not set</span>}
          </div>
        )}
        {isEditing ? (
          <Button onClick={handleSave} size="sm" disabled={disabled || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => { setInputValue(currentValue || ''); setIsEditing(true); }} disabled={disabled}>
            <Edit3 className="mr-2 h-4 w-4" /> Edit
          </Button>
        )}
      </div>
    </div>
  );
};


export default function ProfilePage() {
  const { 
    userProfile,
    updateUserProfileFields,
  } = useInventoryStore();
  const { toast } = useToast();
  const { ensureLoaded } = useAppData();

  const [activePlanDetails, setActivePlanDetails] = useState<SubscriptionPlan | undefined>(undefined);
  const [loggedInUserName, setLoggedInUserName] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);


  useEffect(() => {
    setHasMounted(true);
    const companyIdFromStorage = localStorage.getItem('companyId');
    const userNameFromStorage = localStorage.getItem('userName');
    
    if (companyIdFromStorage) {
      setCurrentCompanyId(companyIdFromStorage);
      setLoggedInUserName(userNameFromStorage);
      setIsLoadingProfile(true);
      ensureLoaded(['profile']).finally(() => setIsLoadingProfile(false));
    } else {
      toast({ variant: "destructive", title: "Error", description: "Company context not found."});
      setIsLoadingProfile(false);
    }
  }, [ensureLoaded, toast, userProfile.dataMode]);

  useEffect(() => {
    if (hasMounted && userProfile) {
       const plan = SUBSCRIPTION_PLANS.find(p => p.id === userProfile.activeSubscriptionId);
       setActivePlanDetails(plan || SUBSCRIPTION_PLANS.find(p => p.id === SUBSCRIPTION_PLAN_IDS.STARTER));
    }
  }, [hasMounted, userProfile]);
  
  useEffect(() => {
    setLogoPreviewError(false); 
  }, [userProfile.companyLogoUrl]);


  const handleFieldSave = async (fieldId: keyof Omit<Company, 'id' | 'token'| 'activeSubscriptionId'>, newValue: string) => {
    if (!currentCompanyId) {
       toast({ variant: 'destructive', title: 'Error', description: 'Company context not found.' });
       return;
    }
    await updateUserProfileFields({ [fieldId]: newValue } as Partial<Omit<Company, 'id'|'token'>>, currentCompanyId);
  };
  
  const handleSubscriptionSelect = async (planId: string) => {
    if (planId === userProfile.activeSubscriptionId) return;
    if (planId === SUBSCRIPTION_PLAN_IDS.ENTERPRISE) {
      toast({ title: 'Enterprise Plan', description: 'Please contact sales for Enterprise pricing and setup.' });
      return;
    }
    if (!currentCompanyId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Company context not found. Cannot update subscription.' });
        return;
    }

    setIsUpdatingSubscription(true);
    try {
        const updatedCompany = await updateUserProfileFields({ activeSubscriptionId: planId }, currentCompanyId); 
        if (updatedCompany) {
            const selectedPlanDetails = SUBSCRIPTION_PLANS.find(p => p.id === planId);
            if (updatedCompany.pendingSubscriptionId === planId) {
                toast({ title: 'Request Sent', description: `Your request to switch to ${selectedPlanDetails?.name} is pending admin approval.` });
            } else {
                toast({ title: 'Subscription Updated', description: `Your plan has been changed to ${selectedPlanDetails?.name}.` });
            }
        } else {
            throw new Error("Failed to update subscription on server.");
        }
    } catch (error) {
        console.error("Error updating subscription:", error);
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update subscription plan. Previous plan restored.' });
        // Optionally, re-fetch profile to ensure consistency if server update partially failed
        ensureLoaded(['profile']);
    } finally {
        setIsUpdatingSubscription(false);
    }
  };

  if (!hasMounted || isLoadingProfile || !userProfile || !currentCompanyId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <LoadingSpinner text="Loading profile & subscription information..." />
      </div>
    );
  }
  
  const currentActivePlan = activePlanDetails;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Company Profile & Subscription" icon={User} />

      <Card className="shadow-md border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary"/>Company Information
          </CardTitle>
          <CardDescription>Manage your company details. These may be used in invoices and other documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EditableProfileField
              fieldId="name"
              label="Company Name*"
              currentValue={userProfile.companyName}
              onSave={(value) => handleFieldSave('name', value)}
              icon={Building}
            />
            <EditableProfileField
              fieldId="slogan"
              label="Company Slogan"
              currentValue={userProfile.companySlogan}
              onSave={(value) => handleFieldSave('slogan', value)}
              icon={PenLine}
              placeholder="e.g., Quality products, best service!"
            />
          </div>
          <EditableProfileField
            fieldId="address"
            label="Company Address"
            currentValue={userProfile.companyAddress}
            onSave={(value) => handleFieldSave('address', value)}
            inputType="textarea"
            icon={Info}
            placeholder="Enter full company address"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EditableProfileField
              fieldId="phone"
              label="Company Phone"
              currentValue={userProfile.companyPhone}
              onSave={(value) => handleFieldSave('phone', value)}
              inputType="tel"
              icon={Phone}
              placeholder="e.g., +91 98765 43210"
            />
            <EditableProfileField
              fieldId="gstNo"
              label="Company GST No."
              currentValue={userProfile.companyGstNo}
              onSave={(value) => handleFieldSave('gstNo', value)}
              icon={FileText}
              placeholder="e.g., 29ABCDE1234F1Z5"
            />
          </div>
           <EditableProfileField
            fieldId="logoUrl"
            label="Company Logo URL"
            currentValue={userProfile.companyLogoUrl}
            onSave={(value) => handleFieldSave('logoUrl', value)}
            inputType="url"
            icon={ImageIcon}
            placeholder="https://example.com/logo.png"
          />
          {userProfile.companyLogoUrl && (
            <div className="mt-2 space-y-1.5">
                <Label className="flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" /> Logo Preview
                </Label>
                <div className="p-2 border border-input rounded-md bg-muted/30 flex items-center justify-center min-h-[100px]">
                {logoPreviewError ? (
                    <p className="text-xs text-destructive">Could not load image. Check URL.</p>
                ) : (
                    <NextImage
                        src={userProfile.companyLogoUrl}
                        alt={`${userProfile.companyName || 'Company'} Logo`}
                        width={128}
                        height={128}
                        className="object-contain max-h-[100px] max-w-full rounded"
                        onError={() => setLogoPreviewError(true)}
                        unoptimized={true} 
                    />
                )}
                </div>
            </div>
           )}
           <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" /> Logged-in Admin
            </Label>
            <p className="text-sm text-foreground p-2 border border-input rounded-md min-h-[40px] flex items-center bg-muted/30">
              {loggedInUserName || 'Admin User'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-t-2 border-t-primary">
        <CardHeader>
          <CardTitle>Subscription Plan</CardTitle>
          <CardDescription>Choose the plan that best fits your business needs. Your current plan is highlighted.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <Card 
              key={plan.id} 
              className={cn(
                "flex flex-col transition-all hover:shadow-xl",
                currentActivePlan?.id === plan.id ? 'border-primary ring-2 ring-primary shadow-xl relative' : 'border-border hover:border-primary/50'
              )}
            >
              {currentActivePlan?.id === plan.id && (
                <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground p-1.5 rounded-full shadow-md">
                  <BadgeCheck className="h-5 w-5" />
                </div>
              )}
               {plan.isPopular && currentActivePlan?.id !== plan.id && (
                <div className="absolute top-2 right-2 bg-accent text-accent-foreground px-2 py-0.5 text-xs rounded-full font-semibold shadow">
                  Popular
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className={cn("text-xl mb-1", currentActivePlan?.id === plan.id && "text-primary")}>{plan.name}</CardTitle>
                {plan.price === -1 ? (
                    <span className="text-3xl font-bold">Contact Us</span>
                ) : (
                    <div className="flex items-baseline">
                        <span className="text-3xl font-bold text-foreground">₹{plan.price}</span>
                        <span className="text-sm text-muted-foreground ml-1">{plan.priceSuffix}</span>
                    </div>
                )}
              </CardHeader>
              <CardContent className="flex-grow space-y-3 pt-0">
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.price === -1 ? (
                    <Button asChild className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                        <a href="mailto:sales@ecbills.in" target="_blank" rel="noopener noreferrer"> 
                            <Mail className="mr-2 h-4 w-4" /> Contact Sales <ExternalLink className="ml-1 h-3 w-3 opacity-70"/>
                        </a>
                    </Button>
                ) : (
                    <Button
                    className={cn("w-full", 
                        currentActivePlan?.id === plan.id ? "bg-primary/80 hover:bg-primary/70" : 
                        userProfile.pendingSubscriptionId === plan.id ? "bg-amber-500 hover:bg-amber-600 text-white" :
                        "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    )}
                    onClick={() => handleSubscriptionSelect(plan.id)}
                    disabled={currentActivePlan?.id === plan.id || isUpdatingSubscription || (!!userProfile.pendingSubscriptionId && userProfile.pendingSubscriptionId !== plan.id)}
                    >
                    {isUpdatingSubscription && currentActivePlan?.id !== plan.id && userProfile.pendingSubscriptionId !== plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {currentActivePlan?.id === plan.id ? 'Current Plan' : 
                        userProfile.pendingSubscriptionId === plan.id ? 'Pending Approval' :
                        (isUpdatingSubscription ? 'Updating...' : 'Choose Plan')}
                    </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
