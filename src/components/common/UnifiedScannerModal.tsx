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
import { Barcode as BarcodeIconLucide, AlertCircle, Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogoSpinner } from '@/components/common/logo-spinner';

interface UnifiedScannerModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (value: string) => void;
    purpose?: 'addItem' | 'updateProductSku';
    productNameForUpdate?: string;
}

export function UnifiedScannerModal({
    isOpen,
    onOpenChange,
    onScan,
    purpose = 'addItem',
    productNameForUpdate,
}: UnifiedScannerModalProps) {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [internalError, setInternalError] = useState<string | null>(null);
    const [isCameraMode, setIsCameraMode] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReaderRef = useRef<any>(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setInternalError(null);
            setIsLoading(false);
            setIsCameraMode(false);
            setIsScanning(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            stopScanning();
        }
    }, [isOpen]);

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

    const startCameraScanning = async () => {
        setIsCameraMode(true);
        setIsScanning(true);
        setInternalError(null);

        try {
            // First, request camera permission explicitly
            const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });

            if (permissionStatus.state === 'denied') {
                setInternalError('Camera permission denied. Please enable camera access in your browser settings and try again.');
                setIsScanning(false);
                return;
            }

            // Dynamically import ZXing library
            const { BrowserMultiFormatReader } = await import('@zxing/browser');

            const codeReader = new BrowserMultiFormatReader();
            codeReaderRef.current = codeReader;

            // Get available video devices (static method)
            const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();

            if (videoInputDevices.length === 0) {
                setInternalError('No camera found. Please connect a camera or enter code manually.');
                setIsScanning(false);
                return;
            }

            // Use the first available camera
            const selectedDeviceId = videoInputDevices[0].deviceId;

            // Start decoding from video device
            codeReader.decodeFromVideoDevice(
                selectedDeviceId,
                videoRef.current!,
                (result, error) => {
                    if (result) {
                        const scannedText = result.getText();
                        setInputValue(scannedText);
                        stopScanning();
                        // Auto-submit after successful scan
                        setTimeout(() => {
                            handleSubmit(scannedText);
                        }, 300);
                    }
                    if (error && !(error.name === 'NotFoundException')) {
                        console.error('Scan Error:', error);
                    }
                }
            );

            // Get the stream for cleanup later
            if (videoRef.current && videoRef.current.srcObject) {
                setStream(videoRef.current.srcObject as MediaStream);
            }
        } catch (error: any) {
            console.error('Failed to start camera scanner:', error);

            // Provide specific error messages based on error type
            let errorMessage = 'Failed to access camera. ';

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = 'Camera permission denied. Please click "Allow" when prompted, or enable camera access in your browser settings.';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = 'No camera found. Please connect a camera or enter code manually.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = 'Camera is already in use by another application. Please close other apps using the camera.';
            } else {
                errorMessage += 'Please check permissions or enter code manually.';
            }

            setInternalError(errorMessage);
            setIsScanning(false);
        }
    };

    const handleSubmit = (valueToSubmit?: string) => {
        const finalValue = valueToSubmit || inputValue;
        if (!finalValue.trim()) {
            setInternalError('Please enter or scan a code.');
            return;
        }
        setIsLoading(true);
        setTimeout(() => {
            onScan(finalValue.trim());
            setIsLoading(false);
            setInputValue('');
            onOpenChange(false);
        }, 100);
    };

    const dialogTitle = purpose === 'updateProductSku'
        ? `Update Code for ${productNameForUpdate || 'Product'}`
        : 'Scan Barcode/QR Code';

    const dialogDescription = purpose === 'updateProductSku'
        ? 'Scan the new code using your hardware scanner or camera.'
        : 'Use your hardware scanner or click the camera icon to scan with your device camera.';

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

                <div className="space-y-4 pt-2">
                    {!isCameraMode ? (
                        <>
                            {/* Hardware Scanner Mode */}
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
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSubmit();
                                    }
                                }}
                                placeholder="Waiting for hardware scanner..."
                                className="text-center text-lg h-12"
                                disabled={isLoading}
                            />

                            {/* Camera Switch Button */}
                            <div className="flex items-center justify-center gap-2 pt-2">
                                <div className="flex-1 h-px bg-border"></div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={startCameraScanning}
                                    disabled={isLoading}
                                    className="text-xs text-muted-foreground hover:text-primary"
                                >
                                    <Camera className="mr-2 h-3.5 w-3.5" />
                                    Hardware not working? Use Camera
                                </Button>
                                <div className="flex-1 h-px bg-border"></div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Camera Scanner Mode */}
                            {isScanning ? (
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
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                stopScanning();
                                                setIsCameraMode(false);
                                                setTimeout(() => inputRef.current?.focus(), 100);
                                            }}
                                        >
                                            <X className="mr-2 h-4 w-4" />
                                            Back to Hardware Scanner
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-muted-foreground mb-4">Camera scanner is ready</p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsCameraMode(false);
                                            setTimeout(() => inputRef.current?.focus(), 100);
                                        }}
                                    >
                                        Back to Hardware Scanner
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Error Display */}
                    {internalError && (
                        <p className="text-sm text-destructive text-center flex items-center justify-center gap-1.5">
                            <AlertCircle size={16} /> {internalError}
                        </p>
                    )}
                </div>

                <DialogFooter className="pt-2">
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
                    {!isScanning && (
                        <Button
                            type="button"
                            onClick={() => handleSubmit()}
                            disabled={isLoading || !inputValue.trim()}
                        >
                            {isLoading ? <LogoSpinner size={16} className="mr-2" alt="" /> : null}
                            {isLoading ? 'Processing...' : 'Submit'}
                        </Button>
                    )}
                </DialogFooter>
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
