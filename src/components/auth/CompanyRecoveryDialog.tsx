"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, Building, PenLine, Phone, FileText, Info, Save, LogOut } from 'lucide-react';
import type { Company } from '@/types';

const recoveryFormSchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters."),
  slogan: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  gstNo: z.string().optional(),
});

type RecoveryFormData = z.infer<typeof recoveryFormSchema>;

interface CompanyRecoveryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CompanyRecoveryDialog({ isOpen, onOpenChange, onSuccess }: CompanyRecoveryDialogProps) {
  const { toast } = useToast();
  const { updateUserProfileFields, userProfile } = useInventoryStore();
  const [companyId, setCompanyId] = useState<string | null>(null);

  const form = useForm<RecoveryFormData>({
    resolver: zodResolver(recoveryFormSchema),
    defaultValues: {
      name: '', slogan: '', address: '', phone: '', gstNo: '',
    },
  });
  
  const { register, handleSubmit, formState: { isSubmitting, errors }, reset } = form;

  useEffect(() => {
    if (isOpen) {
      const storedCompanyId = localStorage.getItem('companyId');
      setCompanyId(storedCompanyId);
      // Even if profile fetch failed, some stale data might be in userProfile.
      reset({
        name: userProfile.companyName || '',
        slogan: userProfile.companySlogan || '',
        address: userProfile.companyAddress || '',
        phone: userProfile.companyPhone || '',
        gstNo: userProfile.companyGstNo || '',
      });
    }
  }, [isOpen, userProfile, reset]);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };
  
  const onSubmit = async (data: RecoveryFormData) => {
    if (!companyId) {
      toast({ variant: "destructive", title: "Error", description: "Company context is missing. Cannot recover profile." });
      return;
    }
    
    const updatedCompany = await updateUserProfileFields({
      name: data.name,
      slogan: data.slogan,
      address: data.address,
      phone: data.phone,
      gstNo: data.gstNo,
    }, companyId);

    if (updatedCompany) {
      toast({ title: "Profile Recovered", description: "Company details have been saved. Re-verifying session." });
      onSuccess(); // This will trigger re-fetch in the layout
    } else {
      toast({ variant: "destructive", title: "Recovery Failed", description: "Could not save company details. Please try again or log out." });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-3">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-center">Company Profile Error</DialogTitle>
          <DialogDescription className="text-center">
            We couldn't load your company profile. This might be due to a temporary issue. Please verify and re-save your company details to continue, or log out.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="rec-name" className="flex items-center gap-1.5"><Building size={14}/> Company Name*</Label>
            <Input id="rec-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-slogan" className="flex items-center gap-1.5"><PenLine size={14}/> Slogan</Label>
            <Input id="rec-slogan" {...register("slogan")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-address" className="flex items-center gap-1.5"><Info size={14}/> Address</Label>
            <Input id="rec-address" {...register("address")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rec-phone" className="flex items-center gap-1.5"><Phone size={14}/> Phone</Label>
            <Input id="rec-phone" type="tel" {...register("phone")} />
          </div>
           <div className="space-y-1">
            <Label htmlFor="rec-gst" className="flex items-center gap-1.5"><FileText size={14}/> GST No.</Label>
            <Input id="rec-gst" {...register("gstNo")} />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4"/> Logout
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <Save className="mr-2 h-4 w-4"/>
              Save and Retry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
