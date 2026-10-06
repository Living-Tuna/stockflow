"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Printer, RefreshCw, Save } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SELECTED_PRINTER_STORAGE_KEY, PAPER_FORMAT_STORAGE_KEY, getPaperFormat, type PaperFormat } from '@/lib/printer-settings';

const DEFAULT_PRINTER_VALUE = '__ecbills_default_printer__';

type DesktopPrinter = {
  name: string;
  displayName?: string;
  description?: string;
  isDefault?: boolean;
  status?: number;
};

export function PrinterSettingsCard() {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState(DEFAULT_PRINTER_VALUE);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [paperFormat, setPaperFormatState] = useState<PaperFormat>('a4');

  const isDesktopPrintingAvailable = hasMounted && Boolean(window.ecbillsPrinter);

  const selectedDeviceName = useMemo(
    () => (selectedPrinter === DEFAULT_PRINTER_VALUE ? undefined : selectedPrinter),
    [selectedPrinter]
  );

  const loadPrinters = useCallback(async () => {
    if (!window.ecbillsPrinter) return;

    setIsLoading(true);
    try {
      const availablePrinters = await window.ecbillsPrinter.getPrinters();
      setPrinters(availablePrinters);

      const savedPrinter = localStorage.getItem(SELECTED_PRINTER_STORAGE_KEY);
      const savedPrinterExists = availablePrinters.some((printer) => printer.name === savedPrinter);
      if (savedPrinter && savedPrinterExists) {
        setSelectedPrinter(savedPrinter);
      } else {
        localStorage.removeItem(SELECTED_PRINTER_STORAGE_KEY);
        setSelectedPrinter(DEFAULT_PRINTER_VALUE);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Printers unavailable',
        description: error instanceof Error ? error.message : 'Could not read printers from this computer.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setHasMounted(true);
    setPaperFormatState(getPaperFormat());
  }, []);

  useEffect(() => {
    if (isDesktopPrintingAvailable) {
      loadPrinters();
    }
  }, [isDesktopPrintingAvailable, loadPrinters]);

  const handleSave = () => {
    if (selectedDeviceName) {
      localStorage.setItem(SELECTED_PRINTER_STORAGE_KEY, selectedDeviceName);
    } else {
      localStorage.removeItem(SELECTED_PRINTER_STORAGE_KEY);
    }

    toast({
      title: 'Printer saved',
      description: selectedDeviceName ? 'Bills will print to the selected printer.' : 'Bills will use the system print dialog.',
    });
  };

  const handlePaperFormatChange = (value: string) => {
    const fmt = value as PaperFormat;
    setPaperFormatState(fmt);
    localStorage.setItem(PAPER_FORMAT_STORAGE_KEY, fmt);
    toast({
      title: 'Print format updated',
      description: `Bills will now print in ${fmt === 'a4' ? 'A4/Letter' : fmt === 'thermal-80mm' ? '80mm Thermal' : '58mm Thermal'} format.`,
    });
  };

  const handleTestPrint = async () => {
    if (!window.ecbillsPrinter) return;

    setIsTesting(true);
    const testHtml = `
      <html>
        <head>
          <title>ecbills.in Printer Test</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .box { border: 1px solid #d1d5db; padding: 18px; max-width: 420px; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            p { margin: 4px 0; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>ecbills.in Printer Test</h1>
            <p>This computer is ready for bill printing.</p>
            <p>${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    try {
      const result = await window.ecbillsPrinter.printHtml(testHtml, selectedDeviceName);
      if (result.success) {
        toast({ title: 'Test sent', description: 'The printer accepted the test page.' });
      } else {
        toast({
          variant: 'destructive',
          title: 'Test print failed',
          description: result.error || 'The selected printer did not accept the test page.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Test print failed',
        description: error instanceof Error ? error.message : 'Could not send the test page.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="shadow-md border-t-2 border-t-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-primary" />
          Printer
        </CardTitle>
        <CardDescription>Select the active printer used for bills on this computer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="paperFormat">Print Format</Label>
          <Select value={paperFormat} onValueChange={handlePaperFormatChange}>
            <SelectTrigger id="paperFormat" className="select-trigger-class w-full md:w-2/3">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4 / Letter (Standard)</SelectItem>
              <SelectItem value="thermal-80mm">80mm Thermal (POS Receipt)</SelectItem>
              <SelectItem value="thermal-58mm">58mm Thermal (Narrow Receipt)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Choose receipt format for printing. Thermal formats use compact monospace layout.</p>
        </div>

        <div className="border-t pt-4" />

        {!isDesktopPrintingAvailable ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Desktop printer selection unavailable</AlertTitle>
            <AlertDescription>
              Open ecbills.in in the desktop app to select installed printers. In a browser, bills use the normal print dialog.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="activePrinter">Active Printer</Label>
              <Select value={selectedPrinter} onValueChange={setSelectedPrinter} disabled={isLoading}>
                <SelectTrigger id="activePrinter" className="select-trigger-class w-full md:w-2/3">
                  <SelectValue placeholder="Select printer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_PRINTER_VALUE}>System print dialog / default printer</SelectItem>
                  {printers.map((printer) => (
                    <SelectItem key={printer.name} value={printer.name}>
                      {printer.displayName || printer.name}
                      {printer.isDefault ? ' (Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {printers.length === 0 && !isLoading ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No printers found</AlertTitle>
                <AlertDescription>Install or enable a printer on this computer, then refresh this list.</AlertDescription>
              </Alert>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {printers.length} printer{printers.length === 1 ? '' : 's'} available on this computer.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSave}>
                <Save className="mr-2 h-4 w-4" />
                Save Printer
              </Button>
              <Button size="sm" variant="outline" onClick={loadPrinters} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={handleTestPrint} disabled={isTesting || isLoading}>
                <Printer className="mr-2 h-4 w-4" />
                Test Print
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
