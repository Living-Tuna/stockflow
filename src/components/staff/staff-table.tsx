
"use client";

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit3, Trash2, PlusCircle, ArrowUpDown } from 'lucide-react';
import type { Staff } from '@/types';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import { StaffFormDialog } from './staff-form-dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SUBSCRIPTION_PLAN_IDS } from '@/lib/constants';

type SortableStaffColumns = keyof Pick<Staff, 'name' | 'email' | 'phone'>;

export function StaffTable() {
  const { staffs, deleteStaff, getAllStores, getActiveSubscriptionPlan, getStaffDetailsByIds } = useInventoryStore();
  const { toast } = useToast();
  const { ensureLoaded } = useAppData();

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortableStaffColumns; direction: 'ascending' | 'descending' } | null>(null);

  const stores = getAllStores();
  const activePlan = getActiveSubscriptionPlan();
  const userCanAddStaff = activePlan ? staffs.length < activePlan.maxEmployees : false; // Recalculate based on activePlan
  const isAdminOnlyPlan = activePlan?.id === SUBSCRIPTION_PLAN_IDS.ADMIN_ONLY;

  const filteredAndSortedStaff = useMemo(() => {
    let sortableStaff = [...staffs];
    if (searchTerm) {
      sortableStaff = sortableStaff.filter(staff =>
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (staff.email && staff.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (staff.phone && staff.phone.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (sortConfig !== null) {
      sortableStaff.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }
        return sortConfig.direction === 'ascending' ? comparison : comparison * -1;
      });
    }
    return sortableStaff;
  }, [staffs, searchTerm, sortConfig]);

  const requestSort = (key: SortableStaffColumns) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleOpenEditDialog = (staff: Staff) => {
    if (isAdminOnlyPlan) {
      toast({ variant: "destructive", title: "Feature Locked", description: "Staff management is not available on the Basic Admin plan. Please upgrade." });
      return;
    }
    setEditingStaff(staff);
    ensureLoaded(['staff']); // Refresh to get latest data including passwords
    setIsFormDialogOpen(true);
  };

  const handleDeleteStaff = (staffId: string, staffName: string) => {
    if (isAdminOnlyPlan) {
      toast({ variant: "destructive", title: "Feature Locked", description: "Staff management is not available on the Basic Admin plan. Please upgrade." });
      return;
    }
    const companyId = localStorage.getItem('companyId');
    if (!companyId) {
      toast({ variant: "destructive", title: "Error", description: "Company ID not found." });
      return;
    }
    deleteStaff(staffId, companyId);
    toast({ title: "Staff Deleted", description: `${staffName} has been removed.` });
  };

  const onFormDialogSubmit = () => {
    setIsFormDialogOpen(false);
    setEditingStaff(null);
  };

  const addStaffButtonTooltipContent = isAdminOnlyPlan
    ? "Staff management is not available on the Basic Admin plan. Please upgrade."
    : !userCanAddStaff
      ? `You have reached the maximum of ${activePlan?.maxEmployees} employees for your current plan. Please upgrade.`
      : "Add New Staff";


  return (
    <TooltipProvider>
      <StaffFormDialog
        isOpen={isFormDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditingStaff(null);
          setIsFormDialogOpen(open);
        }}
        editingStaff={editingStaff}
        onFormSubmit={onFormDialogSubmit}
        allStores={stores}
      />
      <div className="flex items-center justify-between mb-4 gap-2">
        <Input
          placeholder="Search staff (name, email, phone)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-block">
              <Button
                onClick={() => {
                  if (isAdminOnlyPlan) {
                    toast({ variant: "destructive", title: "Feature Locked", description: "Staff management is not available on the Basic Admin plan. Please upgrade." });
                    return;
                  }
                  if (!userCanAddStaff) {
                    toast({ variant: "destructive", title: "Limit Reached", description: `Cannot add more staff. Max ${activePlan?.maxEmployees} allowed on current plan.` });
                    return;
                  }
                  setEditingStaff(null);
                  ensureLoaded(['staff']); // Force refresh on add intent
                  setIsFormDialogOpen(true);
                }}
                disabled={!userCanAddStaff || isAdminOnlyPlan}
                aria-disabled={!userCanAddStaff || isAdminOnlyPlan}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Staff
              </Button>
            </div>
          </TooltipTrigger>
          {(!userCanAddStaff || isAdminOnlyPlan) && (
            <TooltipContent side="bottom" align="end">
              <p>{addStaffButtonTooltipContent}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
      <div className="border rounded-lg overflow-hidden shadow-lg border-t-2 border-t-primary">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => requestSort('name')} className="cursor-pointer hover:bg-muted/50 py-3 px-4">
                Name <ArrowUpDown className="ml-2 h-3 w-3 inline" />
              </TableHead>
              <TableHead onClick={() => requestSort('email')} className="cursor-pointer hover:bg-muted/50 py-3 px-4">
                Email <ArrowUpDown className="ml-2 h-3 w-3 inline" />
              </TableHead>
              <TableHead onClick={() => requestSort('phone')} className="cursor-pointer hover:bg-muted/50 py-3 px-4">
                Phone <ArrowUpDown className="ml-2 h-3 w-3 inline" />
              </TableHead>
              <TableHead className="py-3 px-4">Emp ID</TableHead>
              <TableHead className="py-3 px-4">Accessible Stores</TableHead>
              <TableHead className="text-right py-3 px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedStaff.length > 0 ? (
              filteredAndSortedStaff.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium py-3 px-4">{staff.name}</TableCell>
                  <TableCell className="py-3 px-4">{staff.email}</TableCell>
                  <TableCell className="py-3 px-4">{staff.phone}</TableCell>
                  <TableCell className="py-3 px-4 font-mono text-xs bg-muted/30 rounded-full px-2">{staff.employeeId || 'N/A'}</TableCell>
                  <TableCell className="py-3 px-4 text-xs">
                    {(staff.assignedStoreIds || []).length === 0
                      ? <span className="text-muted-foreground">All Stores</span>
                      : staff.assignedStoreIds?.map(storeId => stores.find(s => s.id === storeId)?.name || 'Unknown Store').join(', ')
                    }
                  </TableCell>
                  <TableCell className="text-right py-3 px-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isAdminOnlyPlan} aria-disabled={isAdminOnlyPlan}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleOpenEditDialog(staff as Staff)} disabled={isAdminOnlyPlan}>
                          <Edit3 className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              disabled={isAdminOnlyPlan}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the staff member "{staff.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteStaff(staff.id, staff.name)} className="bg-destructive hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No staff found. {isAdminOnlyPlan && "Staff management is not available on your current plan."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
