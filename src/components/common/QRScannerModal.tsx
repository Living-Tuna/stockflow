"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, AlertCircle, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoSpinner } from '@/components/common/logo-spinner';

interface QRScannerModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (qrValue: string) => void;
    purpose?: 'addItem' | 'updateProductSku';
    productNameForUpdate?: string;
}

export function QRScannerModal({
    isOpen,
    onOpenChange,
    onScan,
    purpose = 'addItem',
    productNameForUpdate,
}: QRScannerModalProps) {
    const [qrValue, setQrValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [internalError, setInternalError] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const codeReaderRef = useRef<any>(null);

    useEffect(() => {
        if (isOpen) {
            setQrValue('');
            setInternalError('');
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            stopScanning();
        }
    }, [isOpen]);

    const startScanning = async () => {
        setIsScanning(true);
        setInternalError('');

        try {
            // Dynamically import ZXing library
            const { BrowserQRCodeReader } = await import('@zxing/browser');

            const codeReader = new BrowserQRCodeReader();
            codeReaderRef.current = codeReader;

            // Get available video devices
            const videoInputDevices = await codeReader.listVideoInputDevices();

            if (videoInputDevices.length === 0) {
                setInternalError('No camera found. Please connect a camera or enter QR code manually.');
                setIsScanning(false);
                return;
            }

            // Use the first available camera (usually back camera on mobile, default on desktop)
            const selectedDeviceId = videoInputDevices[0].deviceId;

            // Start decoding from video device
            codeReader.decodeFromVideoDevice(
                selectedDeviceId,
                videoRef.current!,
                (result, error) => {
                    if (result) {
                        const scannedText = result.getText();
                        setQrValue(scannedText);
                        stopScanning();
                        // Auto-submit after successful scan
                        setTimeout(() => {
                            handleSubmit(scannedText);
                        }, 300);
                    }
                    if (error && !(error.name === 'NotFoundException')) {
                        console.error('QR Scan Error:', error);
                    }
                }
            );

            // Get the stream for cleanup later
            if (videoRef.current && videoRef.current.srcObject) {
                setStream(videoRef.current.srcObject as MediaStream);
            }
        } catch (error) {
            console.error('Failed to start QR scanner:', error);
            setInternalError('Failed to access camera. Please check permissions or enter QR code manually.');
            setIsScanning(false);
        }
    };

    const stopScanning = () => {
        if (codeReaderRef.current) {
            codeReaderRef.current.reset();
            codeReaderRef.current = null;
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setIsScanning(false);
    };

    const handleSubmit = (valueToSubmit?: string) => {
        const finalValue = valueToSubmit || qrValue;
        if (!finalValue.trim()) {
            setInternalError('Please enter or scan a QR code.');
            return;
        }
        setIsLoading(true);
        onScan(finalValue.trim());
        setTimeout(() => {
            setIsLoading(false);
            setQrValue('');
            onOpenChange(false);
        }, 300);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    const dialogTitle =
        purpose === 'updateProductSku'
            ? `Update QR Code for ${productNameForUpdate || 'Product'}`
            : 'Scan QR Code';

    const dialogDescription =
        purpose === 'updateProductSku'
            ? 'Scan the new QR code using your camera or enter it manually.'
            : 'Use your camera to scan a QR code or enter the code manually.';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-6 w-6 text-primary" />
                        {dialogTitle}
                    </DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Camera Scanner Section */}
                    <div className="space-y-3">
                        {!isScanning ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={startScanning}
                                disabled={isLoading}
                            >
                                <Camera className="mr-2 h-4 w-4" />
                                Start Camera Scanner
                            </Button>
                        ) : (
                            <div className="space-y-2">
                                <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-primary bg-black">
                                    <video
                                        ref={videoRef}
                                        className="h-full w-full object-cover"
                                        autoPlay
                                        playsInline
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="h-48 w-48 border-4 border-primary rounded-lg opacity-50"></div>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    onClick={stopScanning}
                                >
                                    Stop Scanner
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Manual Input Section */}
                    <div className="space-y-2">
                        <Label htmlFor="qr-input">Or Enter QR Code Manually</Label>
                        <Input
                            id="qr-input"
                            ref={inputRef}
                            type="text"
                            value={qrValue}
                            onChange={(e) => {
                                setQrValue(e.target.value);
                                setInternalError('');
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter QR code value..."
                            disabled={isLoading || isScanning}
                            className="w-full"
                        />
                    </div>

                    {/* Error Display */}
                    {internalError && (
                        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{internalError}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            stopScanning();
                            onOpenChange(false);
                        }}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={() => handleSubmit()}
                        disabled={isLoading || !qrValue.trim() || isScanning}
                    >
                        {isLoading ? (
                            <>
                                <LogoSpinner size={16} className="mr-2" alt="" />
                                Processing...
                            </>
                        ) : (
                            'Submit QR Code'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
