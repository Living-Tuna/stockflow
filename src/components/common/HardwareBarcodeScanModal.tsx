"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Barcode as BarcodeIconLucide, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoSpinner } from '@/components/common/logo-spinner';

interface HardwareBarcodeScanModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (barcodeValue: string) => void;
  purpose?: 'addItem' | 'updateProductSku';
  productNameForUpdate?: string;
}

export function HardwareBarcodeScanModal({
  isOpen,
  onOpenChange,
  onScan,
  purpose = 'addItem',
  productNameForUpdate,
}: HardwareBarcodeScanModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setInternalError(null);
      setIsLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) {
      setInternalError("Please enter or scan a barcode.");
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      onScan(inputValue.trim());
      setIsLoading(false);
    }, 100);
  };

  const dialogTitle = purpose === 'updateProductSku'
    ? `Update Barcode for ${productNameForUpdate || 'Product'}`
    : "Scan Hardware Barcode";

  const dialogDescription = purpose === 'updateProductSku'
    ? "Scan the new barcode using your hardware scanner. Press Enter or click Submit."
    : "Ensure your hardware barcode scanner is connected. The scanned barcode will appear below. Press Enter or click Submit.";


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-t-4 border-t-primary shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarcodeIconLucide className="h-6 w-6 text-primary" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="relative h-20 w-full flex items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-primary/50 bg-muted/30">
            <div className="absolute top-0 left-0 h-full w-1 bg-primary animate-scan-line"></div>
            <BarcodeIconLucide className={cn("h-10 w-10 text-primary transition-opacity duration-300", isLoading ? "opacity-30" : "opacity-70")} />
            {isLoading && <LogoSpinner size={32} className="absolute" />}
          </div>

          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (internalError) setInternalError(null);
            }}
            placeholder="Waiting for barcode scan..."
            className="text-center text-lg h-12"
            disabled={isLoading}
          />
          {internalError && (
            <p className="text-sm text-destructive text-center flex items-center justify-center gap-1.5">
              <AlertCircle size={16} /> {internalError}
            </p>
          )}
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !inputValue.trim()}>
              {isLoading ? <LogoSpinner size={16} className="mr-2" alt="" /> : null}
              {isLoading ? 'Processing...' : 'Submit Barcode'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <style jsx global>{`
        @keyframes scan-line-animation {
          0% { transform: translateY(-100%); opacity: 0.7; }
          50% { transform: translateY(100%); opacity: 1; }
          100% { transform: translateY(-100%); opacity: 0.7; }
        }
        .animate-scan-line {
          animation: scan-line-animation 2s linear infinite;
        }
      `}</style>
    </Dialog>
  );
}
